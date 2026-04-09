import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Globe, Shield, Activity, CheckCircle, AlertTriangle,
  RefreshCw, Copy, Clock, ExternalLink, ChevronRight, Lightbulb, Zap
} from 'lucide-react'
import { supabase } from '../lib/supabase'
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
      recordValue: `v=DMARC1; p=none; rua=mailto:mathivanan@easysecurity.in; ruf=mailto:mathivanan@easysecurity.in; fo=1`,
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
      recordValue: `v=DMARC1; p=quarantine; rua=mailto:mathivanan@easysecurity.in; pct=100; fo=1`,
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
      recordValue: `v=DMARC1; p=reject; rua=mailto:mathivanan@easysecurity.in; pct=100; fo=1`,
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
      recordValue: `v=DMARC1; p=${dmarc.policy || 'none'}; rua=mailto:mathivanan@easysecurity.in; fo=1`,
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

  useEffect(() => {
    const d = domains.find(d => d.id === id)
    if (d) setDomain(d)
    fetchRecords()
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

      {/* Suggestions panel — always visible after scan */}
      {!loading && (
        <SuggestionsPanel
          domain={domain}
          dmarc={dmarc}
          spf={spf}
          dkim={dkim}
          bimi={bimi}
        />
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {['overview', 'dmarc', 'spf', 'dkim', 'bimi'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.toUpperCase()}
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

              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Enforcement journey</h4></div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: '0', marginBottom: '1rem' }}>
                    {['none', 'quarantine', 'reject'].map((p, i) => {
                      const isActive = dmarc.policy === p
                      const isPast = ['none', 'quarantine', 'reject'].indexOf(dmarc.policy) > i
                      const color = { none: 'var(--danger-500)', quarantine: 'var(--warning-500)', reject: 'var(--success-500)' }[p]
                      return (
                        <div key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '100%', height: 6, background: (isActive || isPast) ? color : 'var(--neutral-150)', borderRadius: i === 0 ? '99px 0 0 99px' : i === 2 ? '0 99px 99px 0' : 0 }} />
                          <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', fontWeight: isActive ? 700 : 400, color: isActive ? color : 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>p={p}</div>
                          {isActive && <div style={{ fontSize: '0.6875rem', color: 'var(--neutral-500)', marginTop: '0.125rem' }}>← current</div>}
                        </div>
                      )
                    })}
                  </div>
                  {dmarc.policy !== 'reject' && (
                    <div className="alert-banner warning">
                      <AlertTriangle size={15} />
                      <span>{dmarc.policy === 'none' ? 'p=none only monitors — emails from spoofed senders are still delivered. Move to p=quarantine or p=reject to enforce protection.' : 'p=quarantine moves suspicious emails to spam. Move to p=reject to fully block spoofed emails.'}</span>
                    </div>
                  )}
                  {dmarc.policy === 'reject' && (
                    <div className="alert-banner success">
                      <CheckCircle size={15} />
                      <span>p=reject is the strongest protection. Spoofed emails are fully blocked at the receiving server.</span>
                    </div>
                  )}
                </div>
              </div>
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
            <div className="alert-banner warning"><AlertTriangle size={15} /><span>No DKIM selectors found for common selectors (default, google). Scan to try more selectors.</span></div>
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
    </div>
  )
}
