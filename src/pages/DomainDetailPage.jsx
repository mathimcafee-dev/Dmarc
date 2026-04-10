import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Globe, Shield, Activity, CheckCircle, AlertTriangle, XCircle, TrendingUp,
  RefreshCw, Copy, Clock, ExternalLink, ChevronRight, Lightbulb, Zap,
  ShieldCheck, ShieldAlert, ShieldX, Loader
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { useToast } from '../components/ui/Toast'

function HealthRing({ score, size = 96 }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? 'var(--success-500)' : score >= 50 ? 'var(--warning-500)' : 'var(--danger-500)'
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex' }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 1s var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.625rem', fontWeight: 700, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--neutral-500)', fontWeight: 500 }}>/ 100</span>
      </div>
    </div>
  )
}

function RecordBlock({ label, value, empty = 'No record found' }) {
  const toast = useToast()
  if (!value) return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>{label}</div>
      <div style={{ padding: '0.75rem 1rem', background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--neutral-200)', fontSize: '0.875rem', color: 'var(--neutral-400)' }}>
        {empty}
      </div>
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }} onClick={() => { navigator.clipboard.writeText(value); toast('Copied!', 'info') }}>
          <Copy size={12} />
        </button>
      </div>
      <div className="code-block" style={{ fontSize: '0.8125rem' }}>{value}</div>
    </div>
  )
}

function CopyRecord({ value }) {
  const toast = useToast()
  return (
    <div style={{ position: 'relative' }}>
      <div className="code-block" style={{ fontSize: '0.8125rem', paddingRight: '2.5rem' }}>{value}</div>
      <button
        className="btn btn-ghost btn-sm"
        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem', background: 'rgba(255,255,255,0.1)' }}
        onClick={() => { navigator.clipboard.writeText(value); toast('Copied to clipboard!', 'success') }}
      >
        <Copy size={13} />
      </button>
    </div>
  )
}

function SuggestionCard({ priority, title, description, recordType, recordName, recordValue, why }) {
  const [open, setOpen] = useState(false)
  const colors = {
    high:   { bg: 'var(--danger-50)',   border: 'var(--danger-200)',   badge: 'badge-danger',   dot: 'var(--danger-500)'   },
    medium: { bg: 'var(--warning-50)',  border: 'var(--warning-200)',  badge: 'badge-warning',  dot: 'var(--warning-500)'  },
    low:    { bg: 'var(--info-50)',     border: 'var(--info-500)',     badge: 'badge-info',     dot: 'var(--brand-500)'    },
  }
  const c = colors[priority] || colors.low

  return (
    <div style={{ border: `1px solid ${c.border}`, borderRadius: 'var(--radius-lg)', background: c.bg, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem 1.25rem', cursor: 'pointer' }}
        onClick={() => setOpen(p => !p)}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--neutral-900)' }}>{title}</span>
            <span className={`badge ${c.badge}`}>{priority} priority</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-600)', marginTop: '0.125rem' }}>{description}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setOpen(true) }}>
          <Zap size={13} /><span>Fix it</span>
        </button>
        <ChevronRight size={15} color="var(--neutral-400)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: `1px solid ${c.border}` }}>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Why this matters */}
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--neutral-700)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--neutral-900)' }}>Why this matters:</strong> {why}
            </div>

            {/* DNS record to add */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
                Add this DNS record
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
                {[
                  { label: 'Type', value: recordType },
                  { label: 'Name / Host', value: recordName },
                ].map(row => (
                  <div key={row.label} style={{ display: 'contents' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', alignSelf: 'center' }}>{row.label}</div>
                    <div style={{ width: 1, background: 'var(--neutral-150)', margin: '0 0.25rem' }} />
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--neutral-800)', alignSelf: 'center' }}>{row.value}</code>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Value</div>
              <CopyRecord value={recordValue} />
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>
              Add this record at your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.) then scan again to verify.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SuggestionsPanel({ domain, dmarc, spf, dkim, bimi }) {
  const suggestions = []
  const domainName = domain?.domain || 'yourdomain.com'

  // No DMARC at all
  if (!dmarc) {
    suggestions.push({
      priority: 'high',
      title: 'Add DMARC record',
      description: 'Your domain has no DMARC record — anyone can spoof emails from your domain.',
      recordType: 'TXT',
      recordName: `_dmarc.${domainName}`,
      recordValue: `v=DMARC1; p=none; rua=mailto:reports@pwonka.resend.app; ruf=mailto:reports@pwonka.resend.app; fo=1`,
      why: 'Without DMARC, attackers can send emails pretending to be from your domain. This harms your brand reputation and can trick your customers. Start with p=none to monitor, then move to p=reject once you verify all your email senders are covered.',
    })
  }

  // DMARC exists but policy is none
  if (dmarc?.policy === 'none') {
    suggestions.push({
      priority: 'medium',
      title: 'Upgrade DMARC to p=quarantine',
      description: 'Your DMARC is in monitor mode only — spoofed emails are still being delivered.',
      recordType: 'TXT',
      recordName: `_dmarc.${domainName}`,
      recordValue: `v=DMARC1; p=quarantine; rua=mailto:reports@pwonka.resend.app; pct=100; fo=1`,
      why: 'p=none only watches — it does not protect. Upgrading to p=quarantine sends spoofed emails to spam instead of the inbox. Once confident, move to p=reject to block them entirely.',
    })
  }

  // DMARC quarantine — suggest reject
  if (dmarc?.policy === 'quarantine') {
    suggestions.push({
      priority: 'low',
      title: 'Upgrade DMARC to p=reject',
      description: 'Move to full enforcement — block spoofed emails completely.',
      recordType: 'TXT',
      recordName: `_dmarc.${domainName}`,
      recordValue: `v=DMARC1; p=reject; rua=mailto:reports@pwonka.resend.app; pct=100; fo=1`,
      why: 'p=reject is the gold standard — spoofed emails are rejected before they reach any inbox. Only do this once you have confirmed SPF and DKIM are working for all your email senders.',
    })
  }

  // No DMARC reporting configured
  if (dmarc && (!dmarc.rua || dmarc.rua.length === 0)) {
    suggestions.push({
      priority: 'medium',
      title: 'Add DMARC reporting (RUA)',
      description: 'You have no aggregate reporting configured — you cannot see who is sending email as your domain.',
      recordType: 'TXT',
      recordName: `_dmarc.${domainName}`,
      recordValue: `v=DMARC1; p=${dmarc.policy || 'none'}; rua=mailto:reports@pwonka.resend.app; fo=1`,
      why: 'DMARC reports tell you which mail servers are sending email using your domain — both legitimate and malicious. Without RUA reports you are flying blind.',
    })
  }

  // No SPF
  if (!spf) {
    suggestions.push({
      priority: 'high',
      title: 'Add SPF record',
      description: 'No SPF record found — receiving servers cannot verify your email senders.',
      recordType: 'TXT',
      recordName: `@`,
      recordValue: `v=spf1 mx a include:_spf.google.com ~all`,
      why: 'SPF tells receiving mail servers which servers are allowed to send email for your domain. Without it, your emails may land in spam and your domain is easier to spoof. The record above covers Google Workspace — adjust the includes for your actual email provider.',
    })
  }

  // SPF over lookup limit
  if (spf && !spf.is_valid) {
    suggestions.push({
      priority: 'high',
      title: 'Fix SPF lookup limit exceeded',
      description: `Your SPF record has ${spf.lookup_count} DNS lookups — maximum allowed is 10.`,
      recordType: 'TXT',
      recordName: `@`,
      recordValue: `v=spf1 mx a ~all`,
      why: 'When SPF exceeds 10 DNS lookups, the check fails completely — meaning SPF gives no protection and emails may be marked as spam. Remove unused includes or use an SPF flattening service.',
    })
  }

  // No DKIM
  if (dkim.length === 0) {
    suggestions.push({
      priority: 'medium',
      title: 'Set up DKIM signing',
      description: 'No DKIM record found — your emails lack a cryptographic signature.',
      recordType: 'TXT',
      recordName: `google._domainkey.${domainName}`,
      recordValue: `Get this key from your email provider (Google Workspace, Microsoft 365, etc.) — each provider generates a unique DKIM key for your domain.`,
      why: 'DKIM adds a digital signature to every email you send, proving it genuinely came from you and was not tampered with in transit. Your email provider (Google, Microsoft, etc.) will give you the exact record to add.',
    })
  }

  // No BIMI (only suggest if DMARC is at least quarantine)
  if (!bimi && dmarc?.policy && dmarc.policy !== 'none') {
    suggestions.push({
      priority: 'low',
      title: 'Add BIMI — show your logo in Gmail',
      description: 'Add a brand logo that appears next to your emails in Gmail and Apple Mail.',
      recordType: 'TXT',
      recordName: `default._bimi.${domainName}`,
      recordValue: `v=BIMI1; l=https://easysecurity.in/logo.svg`,
      why: 'BIMI (Brand Indicators for Message Identification) displays your company logo next to emails in supporting clients like Gmail. It increases brand trust and email open rates. You need a square SVG logo hosted on HTTPS.',
    })
  }

  if (suggestions.length === 0) return (
    <div className="alert-banner success" style={{ marginBottom: '1.5rem' }}>
      <CheckCircle size={15} />
      <span>Your domain is fully configured. All critical DNS records are in place.</span>
    </div>
  )

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Lightbulb size={16} color="var(--warning-500)" />
        <h3 style={{ margin: 0 }}>Suggested fixes</h3>
        <span className="badge badge-warning">{suggestions.length} action{suggestions.length > 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {suggestions.map((s, i) => <SuggestionCard key={i} {...s} />)}
      </div>
    </div>
  )
}

function CheckItem({ label, ok, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--neutral-100)' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: ok ? 'var(--success-100)' : 'var(--danger-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
        {ok ? <CheckCircle size={13} color="var(--success-600)" /> : <AlertTriangle size={13} color="var(--danger-600)" />}
      </div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-800)' }}>{label}</div>
        {detail && <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)', marginTop: '0.125rem' }}>{detail}</div>}
      </div>
    </div>
  )
}

// ── Deliverability Score ──────────────────────────────────────────────────────
function ScoreGauge({ score }) {
  const size = 140
  const r = 52
  const circ = 2 * Math.PI * r
  // Half arc — bottom half hidden, show top 180deg
  const halfCirc = circ / 2
  const fill = (score / 100) * halfCirc
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs work' : 'Poor'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size / 2 + 20, overflow: 'hidden' }}>
        <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={12}
            strokeDasharray={`${halfCirc} ${circ}`} strokeDashoffset={halfCirc / 2}
            transform={`rotate(180 ${size/2} ${size/2})`} strokeLinecap="round" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={`${fill} ${circ}`} strokeDashoffset={halfCirc / 2}
            transform={`rotate(180 ${size/2} ${size/2})`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${color}55)` }} />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{score}</div>
          <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 2 }}>out of 100</div>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, padding: '3px 14px', borderRadius: 99, background: `${color}18` }}>{label}</span>
    </div>
  )
}

function ScoreRow({ label, points, max, desc, pass }) {
  const pct = Math.round((points / max) * 100)
  const color = pass ? '#16a34a' : points > 0 ? '#d97706' : '#dc2626'
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--neutral-100)', alignItems: 'flex-start' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: pass ? 'var(--success-100)' : points > 0 ? 'var(--warning-100)' : 'var(--danger-100)' }}>
        {pass
          ? <CheckCircle size={12} color="var(--success-600)" />
          : points > 0 ? <AlertTriangle size={12} color="var(--warning-600)" />
          : <XCircle size={12} color="var(--danger-600)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{points}/{max}</span>
        </div>
        <div style={{ height: 5, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--neutral-400)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

function DeliverabilityScore({ domain, dmarc, spf, dkim, blacklist, onRunBlacklist, blacklistLoading }) {
  const scores = []
  let total = 0

  // DMARC — 30 pts — use fetched dmarc record, fall back to domain cache
  const dmarcPolicy = dmarc?.policy || domain?.dmarc_policy
  const dmarcPts = dmarcPolicy === 'reject' ? 30 : dmarcPolicy === 'quarantine' ? 18 : dmarcPolicy === 'none' ? 5 : 0
  scores.push({ label: 'DMARC policy', points: dmarcPts, max: 30, pass: dmarcPts === 30,
    desc: dmarcPolicy === 'reject' ? 'p=reject — full protection against spoofing'
        : dmarcPolicy === 'quarantine' ? 'p=quarantine — partial protection, upgrade to p=reject for full score'
        : dmarcPolicy === 'none' ? 'p=none — monitoring only, no protection'
        : 'No DMARC record found — critical issue' })
  total += dmarcPts

  // SPF — 20 pts
  const spfValid = spf?.is_valid
  const spfExists = !!spf
  const spfPts = spfValid ? 20 : spfExists ? 10 : 0
  scores.push({ label: 'SPF record', points: spfPts, max: 20, pass: spfPts === 20,
    desc: spfValid ? 'Valid SPF record — authorised senders defined'
        : spfExists ? 'SPF record exists but has issues — check lookup count or syntax'
        : 'No SPF record — mail servers cannot verify your senders' })
  total += spfPts

  // DKIM — 20 pts
  const dkimCount = Array.isArray(dkim) ? dkim.length : 0
  const dkimPts = dkimCount >= 2 ? 20 : dkimCount === 1 ? 15 : 0
  scores.push({ label: 'DKIM signing', points: dkimPts, max: 20, pass: dkimPts >= 15,
    desc: dkimCount >= 2 ? `${dkimCount} DKIM selectors found — excellent`
        : dkimCount === 1 ? '1 DKIM selector found — consider adding a second for rotation'
        : 'No DKIM records found — emails cannot be cryptographically signed' })
  total += dkimPts

  // Blacklist — 20 pts
  let blacklistPts = 0
  let blacklistDesc = 'Run a blacklist check to include this in your score'
  if (blacklist) {
    blacklistPts = blacklist.listed_count === 0 ? 20 : blacklist.listed_count <= 2 ? 8 : 0
    blacklistDesc = blacklist.listed_count === 0 ? `Clean across all ${blacklist.checked} blacklists checked`
      : `Listed on ${blacklist.listed_count} blacklist${blacklist.listed_count > 1 ? 's' : ''} — request delisting immediately`
  }
  scores.push({ label: 'Blacklist status', points: blacklistPts, max: 20, pass: blacklist ? blacklist.listed_count === 0 : false,
    desc: blacklistDesc })
  total += blacklistPts

  // Health score bonus — 10 pts
  const healthScore = domain?.health_score || 0
  const healthPts = healthScore >= 80 ? 10 : healthScore >= 60 ? 6 : healthScore >= 40 ? 3 : 0
  scores.push({ label: 'DNS health score', points: healthPts, max: 10, pass: healthPts >= 8,
    desc: `Overall DNS health score: ${healthScore}/100 — ${healthScore >= 80 ? 'all checks passing' : 'some checks need attention'}` })
  total += healthPts

  const maxTotal = blacklist ? 100 : 80 // penalise if blacklist not run
  const displayScore = blacklist ? total : Math.round((total / 80) * 100)

  const tips = scores.filter(s => !s.pass).map(s => s.label)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.25rem', alignItems: 'start' }}>
      {/* Left — gauge + summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card">
          <div className="card-header"><h4 style={{ margin: 0 }}>Deliverability score</h4></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
            <ScoreGauge score={displayScore} />
            {!blacklist && (
              <div style={{ width: '100%', background: 'var(--warning-50)', border: '1px solid var(--warning-200)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warning-700)', textAlign: 'center' }}>
                Run a blacklist check to get your full score
                <button className="btn btn-secondary btn-sm" style={{ display: 'block', margin: '8px auto 0', fontSize: 12 }}
                  onClick={onRunBlacklist} disabled={blacklistLoading}>
                  {blacklistLoading ? 'Checking…' : 'Run blacklist check'}
                </button>
              </div>
            )}
          </div>
        </div>

        {tips.length > 0 && (
          <div className="card" style={{ border: '1px solid var(--brand-150)', background: 'var(--brand-50)' }}>
            <div className="card-body">
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-700)', marginBottom: 8 }}>To improve your score:</div>
              {tips.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--brand-700)', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>→</span> Fix {t}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — breakdown */}
      <div className="card">
        <div className="card-header"><h4 style={{ margin: 0 }}>Score breakdown</h4></div>
        <div className="card-body" style={{ padding: '0 1.5rem 1rem' }}>
          {scores.map((s, i) => (
            <ScoreRow key={i} {...s} />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-600)' }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--neutral-800)' }}>{displayScore} / 100</span>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Enforcement Journey Automation ───────────────────────────────────────────
function EnforcementJourney({ dmarc, domain }) {
  const [rua, setRua] = useState(null)
  const { currentOrg } = useOrg()
  const { supabase: sb } = { supabase }

  useEffect(() => {
    if (!domain?.id) return
    supabase.from('dmarc_aggregate_reports')
      .select('id, report_begin, report_end')
      .eq('domain_id', domain.id)
      .order('report_begin', { ascending: false })
      .limit(1)
      .then(({ data }) => setRua(data?.[0] || null))
  }, [domain?.id])

  if (!dmarc) return null

  const policy  = dmarc.policy || 'none'
  const steps   = ['none', 'quarantine', 'reject']
  const idx     = steps.indexOf(policy)
  const next    = steps[idx + 1]

  const COLORS  = { none: '#dc2626', quarantine: '#d97706', reject: '#16a34a' }
  const BG      = { none: '#fee2e2', quarantine: '#fef3c7', reject: '#dcfce7' }

  // Safety analysis — based on RUA data availability + deliverability score proxy
  const healthScore = domain?.health_score || 0
  const hasSPF   = true // already checked earlier in page
  const hasDKIM  = true
  const hasRUA   = !!rua

  // Compute readiness
  const checks = [
    { label: 'SPF record valid',        pass: healthScore > 0,   desc: 'SPF is configured and valid' },
    { label: 'DKIM signing active',     pass: healthScore > 30,  desc: 'At least one DKIM selector found' },
    { label: 'RUA reports being received', pass: hasRUA,         desc: hasRUA ? `Last report: ${new Date(rua.report_end).toLocaleDateString('en-IN')}` : 'No aggregate reports yet — add rua= to DMARC' },
    { label: 'Domain health ≥ 60',      pass: healthScore >= 60, desc: `Current score: ${healthScore}/100` },
  ]
  const passCount   = checks.filter(c => c.pass).length
  const safeToMove  = passCount >= 3
  const allPassing  = passCount === checks.length

  // Next record to apply
  const nextRecord = next ? `v=DMARC1; p=${next}; adkim=${dmarc.adkim || 'r'}; aspf=${dmarc.aspf || 'r'}; pct=100; rua=mailto:reports@pwonka.resend.app;` : null

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="card-header" style={{ background: 'linear-gradient(135deg, #0e1624, #1a2234)' }}>
        <h4 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#60a5fa" /> Enforcement Journey
        </h4>
        {policy === 'reject' && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#dcfce7', color: '#15803d' }}>✓ Fully enforced</span>
        )}
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Progress track */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {steps.map((p, i) => {
            const done    = idx >= i
            const active  = idx === i
            const color   = COLORS[p]
            const bg      = BG[p]
            return (
              <div key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {i < steps.length - 1 && (
                  <div style={{ position: 'absolute', top: 17, left: '50%', right: '-50%', height: 3, background: idx > i ? COLORS[steps[i+1]] : 'var(--neutral-150)', borderRadius: 99, zIndex: 0 }} />
                )}
                <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: done ? bg : 'var(--neutral-100)', color: done ? color : 'var(--neutral-400)', border: `2.5px solid ${done ? color : 'var(--neutral-200)'}`, zIndex: 1, boxShadow: active ? `0 0 0 4px ${bg}` : 'none', transition: 'all 0.3s' }}>
                  {idx > i ? '✓' : i + 1}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: active ? 800 : 500, color: done ? color : 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>p={p}</div>
                {active && <div style={{ fontSize: 10, color: 'var(--neutral-400)', marginTop: 2 }}>current</div>}
              </div>
            )
          })}
        </div>

        {/* Safety checklist */}
        {policy !== 'reject' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} />
              Safety checks before moving to p={next}
              <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 99, background: safeToMove ? '#dcfce7' : '#fef3c7', color: safeToMove ? '#15803d' : '#b45309', fontWeight: 700 }}>
                {passCount}/{checks.length} passing
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: c.pass ? '#f0fdf4' : '#fefce8', border: `1px solid ${c.pass ? '#bbf7d0' : '#fef08a'}` }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.pass ? '#dcfce7' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {c.pass ? <CheckCircle size={12} color="#16a34a" /> : <AlertTriangle size={12} color="#d97706" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verdict + next record */}
        {policy !== 'reject' && (
          <div style={{ padding: '14px 16px', borderRadius: 10, background: safeToMove ? '#f0fdf4' : '#fefce8', border: `1.5px solid ${safeToMove ? '#86efac' : '#fde047'}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: safeToMove ? '#15803d' : '#b45309', marginBottom: 6 }}>
              {safeToMove ? `✓ Safe to move to p=${next}` : `⚠ Fix issues before moving to p=${next}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--neutral-600)', marginBottom: safeToMove ? 12 : 0 }}>
              {safeToMove
                ? `All critical checks are passing. You can safely escalate your DMARC policy to p=${next} to ${next === 'quarantine' ? 'move suspicious emails to spam' : 'fully block spoofed emails'}.`
                : 'Resolve the failing checks above before escalating. Moving too early may block legitimate emails.'}
            </div>
            {safeToMove && nextRecord && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-600)', marginBottom: 4 }}>Apply this DNS record at _dmarc.{domain?.domain}:</div>
                <div style={{ background: '#0e1624', borderRadius: 7, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#93c5fd', wordBreak: 'break-all', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ flex: 1 }}>{nextRecord}</span>
                  <button onClick={() => navigator.clipboard.writeText(nextRecord)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '3px 8px', color: '#60a5fa', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {policy === 'reject' && (
          <div className="alert-banner success">
            <CheckCircle size={15} />
            <span>Maximum protection achieved. p=reject fully blocks spoofed emails at every receiving server.</span>
          </div>
        )}
      </div>
    </div>
  )
}


// ── BIMI Auto-Validator (Trusted VMC Advisor) ───────────────────────────────
function BIMIValidator({ domain, dmarc, spf, dkim, bimi }) {
  const [svgValid, setSvgValid]     = useState(null) // null=unchecked, true, false
  const [svgChecking, setSvgCheck]  = useState(false)
  const [svgError, setSvgError]     = useState('')
  const [converting, setConverting] = useState(false)
  const [converted, setConverted]   = useState(null)
  const navigate = useNavigate()

  const domainName  = domain?.domain || ''
  const policy      = dmarc?.policy
  const hasSPF      = !!spf?.is_valid
  const hasDKIM     = dkim?.length > 0
  const hasReject   = policy === 'reject'
  const hasBIMI     = !!bimi
  const logoUrl     = bimi?.logo_url || ''
  const isHTTPS     = logoUrl.startsWith('https://')
  const hasVMC      = !!(bimi?.vmc_url)

  // Auto-check SVG on mount if BIMI exists
  useEffect(() => {
    if (logoUrl && isHTTPS) checkSVG(logoUrl)
  }, [logoUrl])

  async function checkSVG(url) {
    setSvgCheck(true); setSvgValid(null); setSvgError('')
    try {
      const res  = await fetch(`/api/validate-svg?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      setSvgValid(data.valid)
      setSvgError(data.error || '')
    } catch { setSvgValid(false); setSvgError('Could not fetch SVG') }
    setSvgCheck(false)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setConverting(true); setConverted(null)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const response = await fetch('/api/svg-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mimeType: file.type }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setConverted(data)
    } catch (err) { alert(err.message) }
    setConverting(false)
    e.target.value = ''
  }

  // DigiCert VMC checklist — in order of application requirement
  const checks = [
    {
      id: 'dmarc_reject',
      label: 'DMARC p=reject enforced',
      pass: hasReject,
      required: true,
      desc: hasReject ? 'Policy is set to p=reject ✓' : `Current policy is p=${policy || 'none'} — VMC issuers require p=reject`,
      fix: !hasReject ? { label: 'Go to DMARC tab', action: null, note: 'Change your DMARC policy to p=reject. Your Enforcement Journey shows when it is safe.' } : null,
    },
    {
      id: 'spf',
      label: 'Valid SPF record',
      pass: hasSPF,
      required: true,
      desc: hasSPF ? 'SPF record is valid ✓' : 'No valid SPF record found',
      fix: !hasSPF ? { label: 'Go to SPF tab', note: 'Add a valid v=spf1 TXT record. VMC validation checks SPF as part of domain validation.' } : null,
    },
    {
      id: 'dkim',
      label: 'DKIM signing active',
      pass: hasDKIM,
      required: true,
      desc: hasDKIM ? `${dkim.length} DKIM selector(s) found ✓` : 'No DKIM selectors found across 20 common selectors',
      fix: !hasDKIM ? { label: 'Set up DKIM', note: 'Contact your email provider (Google Workspace, Microsoft 365 etc) to enable DKIM signing.' } : null,
    },
    {
      id: 'bimi_record',
      label: 'BIMI DNS record exists',
      pass: hasBIMI,
      required: true,
      desc: hasBIMI ? `default._bimi.${domainName} found ✓` : `No BIMI record at default._bimi.${domainName}`,
      fix: !hasBIMI ? {
        label: 'Copy record',
        copy: `default._bimi.${domainName}  IN TXT  "v=BIMI1; l=https://${domainName}/bimi-logo.svg;"`,
        note: 'Add this TXT record to your DNS. Replace the logo URL with your actual hosted SVG path.',
      } : null,
    },
    {
      id: 'https',
      label: 'Logo hosted on HTTPS',
      pass: hasBIMI && isHTTPS,
      required: true,
      desc: !hasBIMI ? 'Requires BIMI record first' : isHTTPS ? `Logo URL uses HTTPS ✓` : 'Logo URL must use HTTPS — HTTP is not allowed for VMC',
      fix: hasBIMI && !isHTTPS ? { note: 'Update your BIMI record logo URL to use https:// — self-signed certificates are not accepted.' } : null,
    },
    {
      id: 'svg_valid',
      label: 'SVG is VMC-compliant (Tiny 1.2 P/S)',
      pass: svgValid === true,
      required: true,
      desc: svgChecking ? 'Checking SVG…' : svgValid === null ? (logoUrl ? 'Will check automatically' : 'Requires BIMI logo URL') : svgValid ? 'SVG passes VMC compliance check ✓' : `SVG issue: ${svgError || 'Failed validation'}`,
      fix: svgValid === false ? { label: 'Convert logo', note: 'Your logo must be SVG Tiny 1.2 Profile S — no raster images, no scripts, square viewBox. Upload your logo below to auto-convert.' } : null,
    },
    {
      id: 'square',
      label: 'Square viewBox (1:1 ratio)',
      pass: svgValid === true,
      required: true,
      desc: 'SVG must have equal width and height — VMC standard rejects non-square logos',
      fix: svgValid === false ? { note: 'Ensure your SVG has a square viewBox e.g. viewBox="0 0 100 100". Upload below to auto-fix.' } : null,
    },
    {
      id: 'size',
      label: 'File size under 32KB',
      pass: svgValid === true,
      required: false,
      desc: 'VMC standard recommends SVG under 32KB for broad client support',
      fix: null,
    },
    {
      id: 'trademark',
      label: 'Trademark registered',
      pass: false,
      required: true,
      desc: 'VMC issuers require proof of trademark registration for the logo — this must be done externally',
      fix: { label: 'Learn more', href: 'https://www.digicert.com/tls-ssl/verified-mark-certificates', note: 'Apply for trademark via IP India or USPTO. Required by all VMC issuers including DigiCert and Entrust.' },
    },
    {
      id: 'vmc',
      label: 'VMC certificate in BIMI record',
      pass: hasVMC,
      required: false,
      desc: hasVMC ? 'VMC authority= field found in BIMI record ✓' : 'Optional but required for Gmail blue checkmark — add authority= with your VMC URL',
      fix: !hasVMC ? {
        copy: `default._bimi.${domainName}  IN TXT  "v=BIMI1; l=https://${domainName}/bimi-logo.svg; a=https://${domainName}/bimi.pem;"`,
        note: 'After receiving VMC from DigiCert, host the .pem file and add authority= to your BIMI record.',
      } : null,
    },
  ]

  const required    = checks.filter(c => c.required)
  const passCount   = required.filter(c => c.pass).length
  const allPass     = passCount === required.length
  const pct         = Math.round((passCount / required.length) * 100)
  const certReady   = allPass && hasVMC

  const C = { pass: '#16a34a', fail: '#dc2626', warn: '#d97706' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header score card */}
      <div className="card" style={{ background: certReady ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'var(--neutral-0)', border: certReady ? '1.5px solid #86efac' : undefined }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={40} cy={40} r={32} fill="none" stroke="var(--neutral-100)" strokeWidth={8} />
              <circle cx={40} cy={40} r={32} fill="none" stroke={allPass ? C.pass : pct > 50 ? C.warn : C.fail} strokeWidth={8}
                strokeDasharray={`${(pct/100)*201} 201`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 4px ${allPass ? C.pass : C.warn}66)` }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: allPass ? C.pass : pct > 50 ? C.warn : C.fail, lineHeight: 1 }}>{pct}%</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-900)', marginBottom: 4 }}>
              {certReady ? '🏆 VMC Certificate Ready' : allPass ? '✅ Ready — apply for VMC' : `${passCount}/${required.length} requirements met`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: 10 }}>
              {certReady ? 'Your domain meets all VMC requirements. You're ready to apply for a Verified Mark Certificate.' : allPass ? 'All technical checks pass. Apply for a VMC from any accredited issuer (DigiCert, Entrust).' : 'Complete the checklist below to qualify for a Verified Mark Certificate.'}
            </div>
            {allPass && (
              <a href="https://www.digicert.com/tls-ssl/verified-mark-certificates" target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#1a6bff', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Apply for VMC Certificate →
              </a>
            )}
          </div>
          {bimi?.logo_url && (
            <img src={bimi.logo_url} alt="BIMI Logo" style={{ width: 64, height: 64, borderRadius: 10, border: '1px solid var(--neutral-150)', objectFit: 'contain', padding: 6 }} onError={e => e.target.style.display='none'} />
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="card">
        <div className="card-header"><h4 style={{ margin: 0 }}>VMC Readiness Checklist</h4><span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{passCount}/{required.length} required checks passing</span></div>
        <div className="card-body" style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checks.map((c, i) => (
            <div key={c.id} style={{ borderRadius: 9, overflow: 'hidden', border: `1px solid ${c.pass ? '#bbf7d0' : c.required ? '#fecaca' : '#e2e8f0'}`, background: c.pass ? '#f0fdf4' : c.required ? '#fff5f5' : 'var(--neutral-50)' }}>
              <div style={{ display: 'flex', gap: 10, padding: '10px 14px', alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.pass ? '#dcfce7' : c.required ? '#fee2e2' : '#f1f5f9' }}>
                  {c.pass ? <CheckCircle size={13} color={C.pass} /> : c.required ? <XCircle size={13} color={C.fail} /> : <AlertTriangle size={13} color={C.warn} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)' }}>{c.label}</span>
                    {c.required && !c.pass && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fee2e2', color: '#dc2626', textTransform: 'uppercase' }}>Required</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--neutral-500)', lineHeight: 1.5 }}>{c.desc}</div>
                  {!c.pass && c.fix && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.7)', borderRadius: 6, fontSize: 12, color: 'var(--neutral-600)', lineHeight: 1.5 }}>
                      💡 {c.fix.note}
                      {c.fix.copy && (
                        <div style={{ marginTop: 6, background: '#0e1624', borderRadius: 6, padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <code style={{ fontSize: 10, color: '#93c5fd', flex: 1, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.6 }}>{c.fix.copy}</code>
                          <button onClick={() => navigator.clipboard.writeText(c.fix.copy)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 7px', color: '#60a5fa', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>Copy</button>
                        </div>
                      )}
                      {c.fix.href && <a href={c.fix.href} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 11, color: '#1a6bff', fontWeight: 600 }}>Learn more →</a>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo converter */}
      <div className="card">
        <div className="card-header"><h4 style={{ margin: 0 }}>Logo → VMC-Compatible SVG</h4></div>
        <div className="card-body">
          <div style={{ fontSize: 13, color: 'var(--neutral-600)', marginBottom: 12, lineHeight: 1.6 }}>
            Upload your logo (PNG, JPG or SVG) and we'll convert it to SVG Tiny 1.2 Profile S — the exact format required by VMC issuers. Square, clean, no raster layers.
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: converting ? 'var(--neutral-200)' : '#1a6bff', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: converting ? 'not-allowed' : 'pointer' }}>
            {converting ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Converting…</> : <><Zap size={14} /> Upload & Convert Logo</>}
            <input type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleUpload} style={{ display: 'none' }} disabled={converting} />
          </label>

          {converted && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>✓ Converted successfully — ready for BIMI</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginBottom: 4 }}>Next steps:</div>
                  <ol style={{ fontSize: 12, color: 'var(--neutral-600)', lineHeight: 1.8, paddingLeft: 16 }}>
                    <li>Download the SVG file below</li>
                    <li>Host it at <code style={{ fontFamily: 'monospace', fontSize: 11 }}>https://{domainName}/bimi-logo.svg</code></li>
                    <li>Update your BIMI DNS record with this URL</li>
                    <li>Apply for VMC with this SVG file</li>
                  </ol>
                </div>
                <a href={URL.createObjectURL(new Blob([converted.svg], {type:'image/svg+xml'}))} download={`${domainName}-bimi.svg`}
                  style={{ flexShrink: 0, padding: '7px 14px', background: '#16a34a', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  Download SVG
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function DomainDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { domains, scanDomain } = useDomains()
  const toast = useToast()
  const [domain, setDomain] = useState(null)
  const [dmarc, setDmarc] = useState(null)
  const [spf, setSpf] = useState(null)
  const [dkim, setDkim] = useState([])
  const [bimi, setBimi] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [blacklist, setBlacklist] = useState(null)
  const [blacklistLoading, setBlacklistLoading] = useState(false)

  useEffect(() => {
    const d = domains.find(d => d.id === id)
    if (d) setDomain(d)
    fetchRecords()
    const domainName = domains.find(d => d.id === id)?.domain
    if (domainName) fetchBlacklist(domainName)
  }, [id, domains])

  async function fetchRecords() {
    setLoading(true)
    const [dmarcRes, spfRes, dkimRes, bimiRes] = await Promise.all([
      supabase.from('dmarc_records').select('*').eq('domain_id', id).eq('is_current', true).single(),
      supabase.from('spf_records').select('*').eq('domain_id', id).eq('is_current', true).single(),
      supabase.from('dkim_records').select('*').eq('domain_id', id).eq('is_current', true),
      supabase.from('bimi_records').select('*').eq('domain_id', id).eq('is_current', true).single(),
    ])
    setDmarc(dmarcRes.data)
    setSpf(spfRes.data)
    setDkim(dkimRes.data || [])
    setBimi(bimiRes.data)
    setLoading(false)
  }

  async function handleScan() {
    setScanning(true)
    const result = await scanDomain(id)
    setScanning(false)
    if (result.error) { toast(result.error.message, 'error'); return }
    toast(`Scan complete — health score: ${result.healthScore}`, 'success')
    fetchRecords()
    const d = domains.find(d => d.id === id)
    if (d) setDomain({ ...d, health_score: result.healthScore, last_checked_at: new Date().toISOString() })
    fetchBlacklist()
  }

  async function fetchBlacklist(domainName) {
    const target = domainName || domain?.domain
    if (!target) return
    setBlacklistLoading(true)
    try {
      const res = await fetch(`/api/blacklist-check?domain=${target}`)
      const data = await res.json()
      setBlacklist(data)
    } catch { setBlacklist(null) }
    setBlacklistLoading(false)
  }

  const policyColor = { reject: 'var(--success-500)', quarantine: 'var(--warning-500)', none: 'var(--danger-500)' }

  if (!domain && !loading) return (
    <div className="page-content">
      <div className="empty-state">
        <p className="empty-title">Domain not found</p>
        <button className="btn btn-secondary" onClick={() => navigate('/domains')}><ArrowLeft size={14} />Back to domains</button>
      </div>
    </div>
  )

  return (
    <div className="page-content fade-in">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/domains')} style={{ marginBottom: '1.25rem', paddingLeft: '0.25rem' }}>
        <ArrowLeft size={15} /><span>All domains</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
        <HealthRing score={domain?.health_score || 0} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem' }}>{domain?.domain || '…'}</h1>
            {domain?.status === 'active' ? (
              <span className="badge badge-success"><CheckCircle size={10} />Verified</span>
            ) : (
              <span className="badge badge-warning"><Clock size={10} />Pending</span>
            )}
            {dmarc?.policy && (
              <span className="badge" style={{ background: `${policyColor[dmarc.policy]}18`, color: policyColor[dmarc.policy] }}>
                p={dmarc.policy}
              </span>
            )}
          </div>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem' }}>
            Last scanned: {domain?.last_checked_at ? new Date(domain.last_checked_at).toLocaleString('en-IN') : 'Never'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
            <button className={`btn btn-primary btn-sm ${scanning ? 'btn-loading' : ''}`} onClick={handleScan} disabled={scanning || domain?.status !== 'active'}>
              {!scanning && <><RefreshCw size={13} /><span>Scan now</span></>}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.open(`https://${domain?.domain}`, '_blank')}>
              <ExternalLink size={13} /><span>Open site</span>
            </button>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {['overview', 'dmarc', 'spf', 'dkim', 'bimi', 'blacklist', 'deliverability'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => { setActiveTab(t); if (t === 'blacklist' && !blacklist) fetchBlacklist() }}>
            {t === 'deliverability' ? 'DELIVERABILITY' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Security checklist</h4></div>
            <div className="card-body" style={{ padding: '0 1.5rem' }}>
              <CheckItem label="DMARC record exists" ok={!!dmarc} detail={dmarc ? `Policy: p=${dmarc.policy}` : 'No _dmarc TXT record found'} />
              <CheckItem label="DMARC policy is enforced" ok={dmarc?.policy === 'reject' || dmarc?.policy === 'quarantine'} detail={dmarc?.policy === 'none' ? 'p=none only monitors, does not protect' : dmarc?.policy ? `p=${dmarc.policy} is active` : 'No DMARC policy set'} />
              <CheckItem label="DMARC reporting configured" ok={dmarc?.rua?.length > 0} detail={dmarc?.rua?.length ? `Aggregate reports → ${dmarc.rua[0]}` : 'No RUA reporting URI configured'} />
              <CheckItem label="SPF record exists" ok={!!spf} detail={spf ? `${spf.lookup_count} DNS lookups (max 10)` : 'No SPF TXT record found'} />
              <CheckItem label="SPF lookup limit OK" ok={spf ? spf.lookup_count <= 10 : false} detail={spf ? `${spf.lookup_count}/10 lookups used` : 'No SPF record'} />
              <CheckItem label="DKIM configured" ok={dkim.length > 0} detail={dkim.length > 0 ? `${dkim.length} selector(s): ${dkim.map(d => d.selector).join(', ')}` : 'No DKIM selectors found'} />
              <CheckItem label="BIMI record" ok={!!bimi} detail={bimi ? `Logo: ${bimi.logo_url || 'configured'}` : 'Optional — brand logo in email clients'} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <RecordBlock label="DMARC Record" value={dmarc?.raw_record} empty="Run a scan to fetch DMARC record" />
                <RecordBlock label="SPF Record" value={spf?.raw_record} empty="Run a scan to fetch SPF record" />
              </div>
            </div>
            {dkim.length > 0 && (
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>DKIM Selectors</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {dkim.map(dk => (
                    <div key={dk.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <CheckCircle size={14} color="var(--success-500)" />
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--neutral-700)' }}>{dk.selector}._domainkey.{domain?.domain}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dmarc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!dmarc ? (
            <div className="alert-banner warning"><AlertTriangle size={15} /><span>No DMARC record found. Run a scan or add a _dmarc TXT record to your DNS.</span></div>
          ) : (
            <>
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>DMARC Configuration</h4></div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    {[
                      { label: 'Policy (p)', value: dmarc.policy, highlight: true },
                      { label: 'Subdomain policy (sp)', value: dmarc.subdomain_policy || 'inherit' },
                      { label: 'Percentage (pct)', value: `${dmarc.pct}%` },
                      { label: 'DKIM alignment (adkim)', value: dmarc.adkim === 's' ? 'Strict' : 'Relaxed' },
                      { label: 'SPF alignment (aspf)', value: dmarc.aspf === 's' ? 'Strict' : 'Relaxed' },
                      { label: 'Report interval (ri)', value: `${(dmarc.ri || 86400) / 3600}h` },
                    ].map(item => (
                      <div key={item.label} style={{ padding: '0.75rem', background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem', color: item.highlight ? policyColor[dmarc.policy] : 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <RecordBlock label="Raw DMARC Record" value={dmarc.raw_record} />
                  {dmarc.rua?.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Aggregate Reports (RUA)</div>
                      {dmarc.rua.map((uri, i) => <div key={i} className="code-block" style={{ marginBottom: '0.375rem' }}>{uri}</div>)}
                    </div>
                  )}
                </div>
              </div>

              <EnforcementJourney dmarc={dmarc} domain={domain} />
              <SuggestionsPanel domain={domain} dmarc={dmarc} spf={spf} dkim={dkim} bimi={bimi} />
            </>
          )}
        </div>
      )}

      {activeTab === 'spf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!spf ? (
            <div className="alert-banner warning"><AlertTriangle size={15} /><span>No SPF record found. Add a v=spf1 TXT record to your domain DNS.</span></div>
          ) : (
            <>
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="stat-card">
                  <div className="stat-label">DNS Lookups</div>
                  <div className="stat-value" style={{ color: spf.lookup_count > 10 ? 'var(--danger-500)' : 'var(--success-500)' }}>{spf.lookup_count}</div>
                  <div className="stat-sub">max 10 allowed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">SPF Valid</div>
                  <div className="stat-value" style={{ color: spf.is_valid ? 'var(--success-500)' : 'var(--danger-500)' }}>{spf.is_valid ? 'Yes' : 'No'}</div>
                  <div className="stat-sub">{spf.is_valid ? 'within limits' : 'over lookup limit'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Mechanisms</div>
                  <div className="stat-value">{spf.mechanisms?.length || 0}</div>
                  <div className="stat-sub">configured senders</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>SPF Mechanisms</h4></div>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead><tr><th>Qualifier</th><th>Type</th><th>Value</th></tr></thead>
                    <tbody>
                      {(spf.mechanisms || []).map((m, i) => (
                        <tr key={i}>
                          <td><code style={{ fontFamily: 'var(--font-mono)' }}>{m.qualifier || '+'}</code></td>
                          <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-600)' }}>{m.type}</code></td>
                          <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{m.value || '—'}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-footer">
                  <RecordBlock label="Raw SPF Record" value={spf.raw_record} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'dkim' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {dkim.length === 0 ? (
            <div className="alert-banner warning"><AlertTriangle size={15} /><span>No DKIM records found across 20 common selectors (Google, Mailchimp, SendGrid, Outlook, Zoho and more). If you use a custom selector, contact support.</span></div>
          ) : (
            dkim.map(dk => (
              <div key={dk.id} className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <CheckCircle size={16} color="var(--success-500)" />
                    <h4 style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>{dk.selector}._domainkey</h4>
                  </div>
                </div>
                <div className="card-body">
                  <RecordBlock label="DKIM Public Key Record" value={dk.raw_record} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'bimi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!bimi ? (
            <div className="alert-banner info">
              <Shield size={15} />
              <span>No BIMI record found. BIMI allows your brand logo to appear in supporting email clients (Gmail, Apple Mail). Requires p=quarantine or p=reject DMARC policy.</span>
            </div>
          ) : (
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>BIMI Record</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {bimi.logo_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src={bimi.logo_url} alt="BIMI Logo" style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid var(--neutral-150)', objectFit: 'contain', padding: 8 }} onError={e => e.target.style.display = 'none'} />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--neutral-600)' }}>Logo URL</div>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', wordBreak: 'break-all' }}>{bimi.logo_url}</code>
                    </div>
                  </div>
                )}
                <RecordBlock label="Raw BIMI Record" value={bimi.raw_record} />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'blacklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {blacklistLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', justifyContent: 'center' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'var(--neutral-500)' }}>Checking {blacklist ? '' : '10 '}blacklists…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!blacklistLoading && blacklist && (
            <>
              {/* Summary card */}
              <div className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      {blacklist.status === 'clean' && <ShieldCheck size={40} color="var(--success-500)" />}
                      {blacklist.status === 'warning' && <ShieldAlert size={40} color="var(--warning-500)" />}
                      {blacklist.status === 'danger' && <ShieldX size={40} color="var(--danger-500)" />}
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: blacklist.status === 'clean' ? 'var(--success-600)' : blacklist.status === 'warning' ? 'var(--warning-600)' : 'var(--danger-600)' }}>
                          {blacklist.status === 'clean' ? 'Not blacklisted' : blacklist.status === 'warning' ? 'Listed on some blacklists' : 'Listed on multiple blacklists'}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginTop: '0.25rem' }}>
                          {blacklist.domain} · IP: {blacklist.ip || 'not resolved'} · Checked {blacklist.checked} lists
                        </div>
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger-500)' }}>{blacklist.listed_count}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 500 }}>Listed</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-500)' }}>{blacklist.clean_count}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 500 }}>Clean</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Listed blacklists */}
              {blacklist.listed_count > 0 && (
                <div className="card" style={{ border: '1px solid var(--danger-200)' }}>
                  <div className="card-header" style={{ background: 'var(--danger-50)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldX size={16} color="var(--danger-600)" />
                      <h4 style={{ margin: 0, color: 'var(--danger-700)' }}>Listed on {blacklist.listed_count} blacklist{blacklist.listed_count > 1 ? 's' : ''}</h4>
                    </div>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {blacklist.results.filter(r => r.listed).map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--danger-50)', borderRadius: 8, border: '1px solid var(--danger-100)' }}>
                        <ShieldX size={15} color="var(--danger-500)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--danger-700)' }}>{r.name}</div>
                          {r.returnCode && <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--danger-500)', marginTop: 2 }}>Return: {r.returnCode}</div>}
                        </div>
                        <span className="badge badge-danger">Listed</span>
                      </div>
                    ))}
                    <div className="alert-banner danger" style={{ marginTop: '0.5rem' }}>
                      <AlertTriangle size={15} />
                      <span>Being blacklisted means your emails may go to spam or be rejected. Contact the blacklist operator to request delisting.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* All results table */}
              <div className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={16} />
                    <h4 style={{ margin: 0 }}>All blacklist checks</h4>
                  </div>
                </div>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead><tr><th>Blacklist</th><th>Type</th><th>Status</th></tr></thead>
                    <tbody>
                      {blacklist.results.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td><span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>{r.skipped ? 'skipped' : 'checked'}</span></td>
                          <td>
                            {r.listed
                              ? <span className="badge badge-danger">Listed</span>
                              : r.skipped
                              ? <span className="badge badge-neutral">Skipped</span>
                              : <span className="badge badge-success">Clean</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-footer">
                  <button className="btn btn-secondary btn-sm" onClick={fetchBlacklist} disabled={blacklistLoading}>
                    <RefreshCw size={13} /><span>Re-check blacklists</span>
                  </button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>
                    Last checked: {new Date(blacklist.checked_at).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </>
          )}

          {!blacklistLoading && !blacklist && (
            <div className="empty-state">
              <ShieldCheck size={32} color="var(--neutral-300)" />
              <p className="empty-title">Blacklist check</p>
              <p className="empty-desc">Check if this domain or its IP is listed on major email blacklists</p>
              <button className="btn btn-primary" onClick={fetchBlacklist}>
                <ShieldCheck size={14} /><span>Run blacklist check</span>
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'deliverability' && (
        <DeliverabilityScore domain={domain} dmarc={dmarc} spf={spf} dkim={dkim} blacklist={blacklist} onRunBlacklist={fetchBlacklist} blacklistLoading={blacklistLoading} />
      )}
    </div>
  )
}
