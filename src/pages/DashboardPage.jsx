import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Shield, AlertTriangle, CheckCircle, Plus, ArrowRight, XCircle, ChevronDown, ChevronUp, Users, Zap, Building2, Mail, Server } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { supabase } from '../lib/supabase'

const SEV = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#16a34a' }
const SEV_BG = { critical: '#fee2e2', high: '#fef3c7', medium: '#eff6ff', low: '#dcfce7' }
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

const ESP_SIGNALS = [
  { name: 'Google Workspace', mx: ['google.com','googlemail.com'], spf: ['_spf.google.com'] },
  { name: 'Microsoft 365',    mx: ['outlook.com','protection.outlook.com'], spf: ['spf.protection.outlook.com'] },
  { name: 'SendGrid',         spf: ['sendgrid.net'] },
  { name: 'Mailchimp',        spf: ['spf.mandrillapp.com'] },
  { name: 'Amazon SES',       mx: ['amazonses.com'], spf: ['amazonses.com'] },
  { name: 'Zoho Mail',        mx: ['zoho.com'], spf: ['zoho.com'] },
]

function detectESP(mxRaw, spfRaw) {
  const mx  = (mxRaw||'').toLowerCase()
  const spf = (spfRaw||'').toLowerCase()
  return ESP_SIGNALS.filter(e =>
    (e.mx?.some(m => mx.includes(m))) || (e.spf?.some(s => spf.includes(s)))
  ).map(e => e.name)
}

function scoreColor(s) { return s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626' }

function HealthBar({ score }) {
  const color = scoreColor(score)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 12, color: 'var(--neutral-400)' }}>/100</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 9px', borderRadius: 99, background: `${color}18`, color, fontWeight: 600 }}>
          {score >= 80 ? 'Excellent' : score >= 50 ? 'Needs work' : 'Poor'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width .6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--neutral-400)' }}>
        <span>0</span><span style={{ color: '#dc2626' }}>50</span><span style={{ color: '#d97706' }}>80</span><span>100</span>
      </div>
    </div>
  )
}

function FindingRow({ f }) {
  const Icon = f.pass ? CheckCircle : f.severity === 'critical' || f.severity === 'high' ? XCircle : AlertTriangle
  const color = f.pass ? '#16a34a' : SEV[f.severity] || '#94a3b8'
  const bg    = f.pass ? '#f0fdf4' : SEV_BG[f.severity] || '#f8fafc'
  const bdr   = f.pass ? '#bbf7d0' : `${color}44`
  return (
    <div style={{ borderRadius: 7, border: `1px solid ${bdr}`, background: bg, marginBottom: 4, padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Icon size={13} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-800)' }}>{f.label}</div>
        <div style={{ fontSize: 10, color: 'var(--neutral-500)', marginTop: 1, lineHeight: 1.4 }}>{f.desc}</div>
        {!f.pass && f.fix && (
          <div style={{ marginTop: 5, fontSize: 10, color: 'var(--neutral-600)', background: 'rgba(255,255,255,0.7)', borderRadius: 5, padding: '4px 7px' }}>
            💡 {f.fix}
            {f.record && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, background: '#0e1624', borderRadius: 4, padding: '4px 8px', alignItems: 'flex-start' }}>
                <code style={{ fontSize: 9, color: '#93c5fd', flex: 1, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{f.record}</code>
                <button onClick={() => navigator.clipboard.writeText(f.record)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 3, padding: '1px 5px', color: '#60a5fa', fontSize: 9, cursor: 'pointer', flexShrink: 0 }}>Copy</button>
              </div>
            )}
          </div>
        )}
      </div>
      {!f.pass && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: color, color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>{f.severity}</span>}
    </div>
  )
}

function buildFindings(domain, spf, dkim, blacklist) {
  const d = domain.domain
  const policy = domain.dmarc_policy
  const findings = [
    { category: 'dmarc', label: 'DMARC record', pass: !!policy, severity: 'critical', desc: policy ? `p=${policy}` : 'No DMARC record found', fix: !policy ? 'Add a TXT record at _dmarc.' + d : null, record: !policy ? `v=DMARC1; p=none; rua=mailto:reports@pwonka.resend.app;` : null },
    { category: 'dmarc', label: 'DMARC enforcement', pass: policy === 'reject', severity: policy === 'quarantine' ? 'medium' : 'high', desc: policy === 'reject' ? 'p=reject — full protection' : policy === 'quarantine' ? 'p=quarantine — upgrade to p=reject' : policy === 'none' ? 'p=none — monitoring only' : 'No DMARC', fix: policy && policy !== 'reject' ? 'Upgrade to p=reject after DKIM is active' : null, record: policy && policy !== 'reject' ? `v=DMARC1; p=reject; rua=mailto:reports@pwonka.resend.app;` : null },
    { category: 'spf', label: 'SPF record', pass: !!spf, severity: 'critical', desc: spf ? (spf.is_valid ? 'Valid SPF record' : `SPF has issues — ${spf.lookup_count} lookups`) : 'No SPF record', fix: !spf ? 'Add v=spf1 TXT record' : null },
    { category: 'dkim', label: 'DKIM signing', pass: dkim?.length > 0, severity: 'critical', desc: dkim?.length > 0 ? `${dkim.length} selector(s) found` : 'No DKIM records found', fix: !dkim?.length ? 'Enable DKIM in your email provider' : null },
    { category: 'blacklist', label: 'Blacklist status', pass: !blacklist || blacklist.listed_count === 0, severity: blacklist?.listed_count > 2 ? 'critical' : 'high', desc: !blacklist ? 'Not checked yet' : blacklist.listed_count === 0 ? `Clean on all ${blacklist.checked} lists` : `Listed on ${blacklist.listed_count} blacklist(s)`, fix: blacklist?.listed_count > 0 ? 'Request delisting from affected blacklists' : null },
  ]
  return findings
}

function DomainRow({ domain, spf, dkim, blacklist, expanded, onToggle, onNavigate, onAudit }) {
  const score   = domain.health_score || 0
  const color   = scoreColor(score)
  const policy  = domain.dmarc_policy
  const findings= buildFindings(domain, spf, dkim, blacklist)
  const critical= findings.filter(f => !f.pass && f.severity === 'critical').length
  const esps    = detectESP(domain.mx_raw, spf?.raw_record)

  return (
    <div style={{ borderBottom: '1px solid var(--neutral-100)', paddingBottom: expanded ? 12 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: `2.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 3 }}>{domain.domain}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {policy && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: policy === 'reject' ? '#dcfce7' : policy === 'quarantine' ? '#fef3c7' : '#fee2e2', color: policy === 'reject' ? '#16a34a' : policy === 'quarantine' ? '#b45309' : '#dc2626' }}>p={policy}</span>}
            {domain.status === 'active' && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#dcfce7', color: '#16a34a' }}>verified</span>}
            {critical > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#fee2e2', color: '#dc2626' }}>{critical} critical</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={e => { e.stopPropagation(); onNavigate() }} style={{ fontSize: 11, color: 'var(--brand-500)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Details</button>
          <button onClick={e => { e.stopPropagation(); onAudit(domain.domain) }} style={{ fontSize: 11, color: '#fff', background: '#1a6bff', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '4px 9px', fontWeight: 600 }}>Audit</button>
          {expanded ? <ChevronUp size={14} color="var(--neutral-400)" /> : <ChevronDown size={14} color="var(--neutral-400)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ background: 'var(--neutral-50)', borderRadius: 8, padding: '12px', marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
            {findings.map((f, i) => <FindingRow key={i} f={f} />)}
          </div>
          {esps.length > 0 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>Senders:</span>
              {esps.map((e, i) => (
                <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'var(--brand-50)', border: '1px solid var(--brand-150)', color: 'var(--brand-700)' }}>{e}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Inline Security Audit ─────────────────────────────────────────────────────
function InlineAudit({ triggerDomain, onClearTrigger }) {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (triggerDomain) { setDomain(triggerDomain); run(triggerDomain); onClearTrigger?.() }
  }, [triggerDomain])

  async function run(d) {
    const target = (d || domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!target) return
    setLoading(true); setResult(null); setError('')
    try {
      const res  = await fetch(`/api/full-audit?domain=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const SORDER = { critical: 0, high: 1, medium: 2, low: 3 }
  const SCOLOR = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#16a34a' }
  const SBG    = { critical: '#fee2e2', high: '#fef3c7', medium: '#eff6ff', low: '#dcfce7' }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="card">
        <div className="card-header">
          <h4 style={{ margin: 0 }}>Security Audit — any domain</h4>
          <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>Enter any domain to get a full scored audit</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: result ? '1.25rem' : 0 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
              <input className="input" style={{ paddingLeft: '2.25rem' }}
                placeholder="e.g. google.com, yourcompany.com"
                value={domain} onChange={e => setDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()} />
            </div>
            <button className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} onClick={() => run()} disabled={!domain.trim() || loading}>
              {!loading && <><Shield size={14} />Audit</>}
            </button>
          </div>
          {error && <div className="alert-banner danger" style={{ marginTop: 8 }}><AlertTriangle size={14} /><span>{error}</span></div>}
        </div>
      </div>

      {result && (
        <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', alignItems: 'start' }}>

          {/* Score card */}
          <div className="card">
            <div className="card-body">
              <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                <div style={{ fontSize: 11, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{result.domain}</div>
                <div style={{ fontSize: 52, fontWeight: 700, color: result.score >= 75 ? '#16a34a' : result.score >= 50 ? '#d97706' : '#dc2626', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {result.score >= 90 ? 'A' : result.score >= 75 ? 'B' : result.score >= 60 ? 'C' : result.score >= 40 ? 'D' : 'F'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color: result.score >= 75 ? '#16a34a' : result.score >= 50 ? '#d97706' : '#dc2626', marginTop: 4 }}>
                  {result.score}<span style={{ fontSize: 13, color: 'var(--neutral-400)', fontWeight: 400 }}>/100</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 99, display: 'inline-block', marginTop: 8, background: result.score >= 75 ? '#dcfce7' : result.score >= 50 ? '#fef3c7' : '#fee2e2', color: result.score >= 75 ? '#16a34a' : result.score >= 50 ? '#b45309' : '#dc2626' }}>
                  {result.verdict?.split('—')[0]?.trim()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                {[
                  { label: 'Critical', count: result.findings.filter(f => !f.pass && f.severity === 'critical').length, color: '#dc2626', bg: '#fee2e2' },
                  { label: 'High',     count: result.findings.filter(f => !f.pass && f.severity === 'high').length,     color: '#d97706', bg: '#fef3c7' },
                  { label: 'Medium',   count: result.findings.filter(f => !f.pass && f.severity === 'medium').length,   color: '#2563eb', bg: '#eff6ff' },
                  { label: 'Passing',  count: result.findings.filter(f => f.pass).length,                              color: '#16a34a', bg: '#dcfce7' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 7 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.providers?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Detected senders</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {result.providers.map((p, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'var(--brand-50)', border: '1px solid var(--brand-150)', color: 'var(--brand-700)' }}>{p.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — findings + action plan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Findings grid */}
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Security findings</h4></div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0.75rem 1rem' }}>
                {result.findings.map((f, i) => {
                  const color = f.pass ? '#16a34a' : SCOLOR[f.severity] || '#94a3b8'
                  const bg    = f.pass ? '#f0fdf4' : SBG[f.severity] || '#f8fafc'
                  const Icon  = f.pass ? CheckCircle : f.severity === 'critical' ? XCircle : AlertTriangle
                  return (
                    <div key={i} style={{ borderRadius: 7, border: `1px solid ${f.pass ? '#bbf7d0' : color + '44'}`, background: bg, padding: '8px 10px', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <Icon size={13} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-800)' }}>{f.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--neutral-500)', marginTop: 1, lineHeight: 1.4 }}>{f.desc}</div>
                      </div>
                      {!f.pass && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: color, color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>{f.severity}</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Attack surface + Action plan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Attack surface</h4></div>
                <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                  {result.attackSurface?.map((v, i) => (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 7, background: v.risk === 'high' ? '#fff5f5' : v.risk === 'medium' ? '#fffbeb' : '#f0fdf4', border: `1px solid ${v.risk === 'high' ? '#fecaca' : v.risk === 'medium' ? '#fde047' : '#bbf7d0'}`, marginBottom: 5 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: v.risk === 'high' ? '#dc2626' : v.risk === 'medium' ? '#b45309' : '#16a34a' }}>{v.vector}</div>
                      <div style={{ fontSize: 10, color: 'var(--neutral-500)', marginTop: 2, lineHeight: 1.4 }}>{v.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Action plan</h4></div>
                <div className="card-body" style={{ padding: '0.5rem 1rem' }}>
                  {result.findings.filter(f => !f.pass).sort((a,b) => (SORDER[a.severity]||3)-(SORDER[b.severity]||3)).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--neutral-100)', alignItems: 'flex-start' }}>
                      <div style={{ width: 17, height: 17, borderRadius: '50%', background: SCOLOR[f.severity] || '#94a3b8', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-800)' }}>{f.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--neutral-500)' }}>{f.fix || f.desc}</div>
                      </div>
                    </div>
                  ))}
                  {result.findings.every(f => f.pass) && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}><CheckCircle size={14} />No issues found</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { currentOrg } = useOrg()
  const { domains, loading } = useDomains()
  const navigate = useNavigate()
  const [members, setMembers]         = useState([])
  const [expanded, setExpanded]       = useState(null)
  const [filterDomain, setFilter]     = useState('all')
  const [domainData, setDomainData]   = useState({})
  const [loadingData, setLoadingData] = useState({})
  const [auditTarget, setAuditTarget]   = useState(null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!currentOrg) return
    supabase.from('org_members').select('id').eq('org_id', currentOrg.id).not('accepted_at', 'is', null)
      .then(({ data }) => setMembers(data || []))
  }, [currentOrg])

  async function loadDomainData(domainId, domainName) {
    if (domainData[domainId]) return
    setLoadingData(p => ({ ...p, [domainId]: true }))
    const [spfRes, dkimRes, blRes] = await Promise.all([
      supabase.from('spf_records').select('*').eq('domain_id', domainId).eq('is_current', true).single(),
      supabase.from('dkim_records').select('*').eq('domain_id', domainId).eq('is_current', true),
      fetch(`/api/blacklist-check?domain=${domainName}`).then(r => r.json()).catch(() => null),
    ])
    setDomainData(p => ({ ...p, [domainId]: { spf: spfRes.data, dkim: dkimRes.data || [], blacklist: blRes } }))
    setLoadingData(p => ({ ...p, [domainId]: false }))
  }

  function toggleDomain(id, name) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    loadDomainData(id, name)
  }

  if (!currentOrg) return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="empty-state">
        <div className="empty-icon"><Building2 size={28} /></div>
        <p className="empty-title">No organisation selected</p>
        <p className="empty-desc">Create or join an organisation to start monitoring DNS.</p>
      </div>
    </div>
  )

  const filtered     = filterDomain === 'all' ? domains : domains.filter(d => d.id === filterDomain)
  const activeDomains= domains.filter(d => d.status === 'active')
  const avgScore     = activeDomains.length ? Math.round(activeDomains.reduce((s, d) => s + (d.health_score || 0), 0) / activeDomains.length) : 0
  const rejectCount  = domains.filter(d => d.dmarc_policy === 'reject').length
  const criticalCount= domains.filter(d => (d.health_score || 0) < 50).length

  // Global action plan from all domains
  const allFindings = domains.flatMap(d => {
    const dd = domainData[d.id] || {}
    return buildFindings(d, dd.spf, dd.dkim, dd.blacklist)
      .filter(f => !f.pass)
      .map(f => ({ ...f, domain: d.domain }))
  }).sort((a, b) => (SEV_ORDER[a.severity] || 3) - (SEV_ORDER[b.severity] || 3))

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>{greeting} 👋</h1>
          <p>Command Centre — <strong>{currentOrg.name}</strong></p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/domains')}><Plus size={14} />Add Domain</button>
      </div>

      {/* Domain filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'var(--neutral-100)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        <button onClick={() => setFilter('all')} className={`tab ${filterDomain === 'all' ? 'active' : ''}`} style={{ fontSize: 12 }}>All domains</button>
        {domains.slice(0, 4).map(d => (
          <button key={d.id} onClick={() => setFilter(d.id)} className={`tab ${filterDomain === d.id ? 'active' : ''}`} style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.domain}</button>
        ))}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total domains',   value: domains.length,  sub: `${activeDomains.length} active`, color: '#1a6bff' },
          { label: 'p=reject',        value: rejectCount,     sub: `of ${domains.length} domains`,   color: '#16a34a' },
          { label: 'Need attention',  value: criticalCount,   sub: 'score below 50',                 color: criticalCount > 0 ? '#dc2626' : '#16a34a' },
          { label: 'Team members',    value: members.length,  sub: currentOrg.name,                  color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1rem 1.125rem', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{loading ? '—' : s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left — domains */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Domains & security status</h4><span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>click to expand inline audit</span></div>
            <div className="card-body" style={{ padding: '0 1.25rem' }}>
              {loading ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8, marginBottom: 8 }} />) :
               filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><Globe size={24} /></div>
                  <p className="empty-title">No domains yet</p>
                  <button className="btn btn-primary" onClick={() => navigate('/domains')}><Plus size={14} />Add domain</button>
                </div>
              ) : filtered.map(d => (
                <DomainRow
                  key={d.id}
                  domain={d}
                  spf={domainData[d.id]?.spf}
                  dkim={domainData[d.id]?.dkim}
                  blacklist={domainData[d.id]?.blacklist}
                  expanded={expanded === d.id}
                  onToggle={() => toggleDomain(d.id, d.domain)}
                  onNavigate={() => navigate(`/domains/${d.id}`)}
                  onAudit={(dn) => { setAuditTarget(dn); setTimeout(() => document.getElementById('inline-audit')?.scrollIntoView({behavior:'smooth'}), 100) }}
                />
              ))}
            </div>
          </div>

          {/* Attack surface */}
          {expanded && domainData[expanded] && (() => {
            const d = domains.find(x => x.id === expanded)
            if (!d) return null
            const policy = d.dmarc_policy
            const spf    = domainData[expanded]?.spf
            const vectors = [
              { label: 'Direct domain spoofing', risk: !policy || policy === 'none' ? 'high' : policy === 'quarantine' ? 'medium' : 'low', desc: policy === 'reject' ? 'p=reject blocks spoofed emails' : policy === 'quarantine' ? 'p=quarantine — some spoofed emails reach spam' : 'No enforcement — spoofed emails delivered' },
              { label: 'Subdomain spoofing',     risk: policy === 'reject' ? 'low' : 'medium', desc: 'Add sp=reject to DMARC to protect subdomains' },
              { label: 'SPF bypass',             risk: !spf ? 'high' : spf.is_valid ? 'low' : 'medium', desc: !spf ? 'No SPF record' : spf.is_valid ? 'SPF valid and within limits' : 'SPF has issues' },
              { label: 'Display name spoofing',  risk: policy === 'reject' ? 'low' : 'medium', desc: 'DKIM signing helps verify sender identity' },
            ]
            const riskColor = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
            const riskBg    = { high: '#fee2e2', medium: '#fef3c7', low: '#dcfce7' }
            return (
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Attack surface — {d.domain}</h4></div>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {vectors.map((v, i) => (
                    <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: riskBg[v.risk], border: `1px solid ${riskColor[v.risk]}44` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: riskColor[v.risk], marginBottom: 3 }}>{v.label} — {v.risk}</div>
                      <div style={{ fontSize: 10, color: 'var(--neutral-500)', lineHeight: 1.4 }}>{v.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Portfolio score — Option A */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Portfolio health</h4></div>
            <div className="card-body">
              <HealthBar score={avgScore} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: '1rem' }}>
                {[
                  { v: rejectCount,   l: 'p=reject',   c: '#16a34a' },
                  { v: criticalCount, l: 'critical',    c: '#dc2626' },
                  { v: domains.length,l: 'domains',     c: '#1a6bff' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'center', background: 'var(--neutral-50)', borderRadius: 7, padding: '8px 4px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: 'var(--neutral-400)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action plan */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0 }}>Action plan</h4>
              {allFindings.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fee2e2', color: '#dc2626' }}>{allFindings.length} issues</span>}
            </div>
            <div className="card-body" style={{ padding: '0.5rem 1rem' }}>
              {allFindings.length === 0 ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.5rem 0', color: '#16a34a', fontSize: 13 }}>
                  <CheckCircle size={15} />All domains are healthy
                </div>
              ) : allFindings.slice(0, 6).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--neutral-100)', alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: SEV[f.severity] || '#94a3b8', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-800)' }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--neutral-400)' }}>{f.domain}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: SEV[f.severity], color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>{f.severity}</span>
                </div>
              ))}
              {allFindings.length > 6 && <div style={{ fontSize: 11, color: 'var(--neutral-400)', paddingTop: 6, textAlign: 'center' }}>{allFindings.length - 6} more issues — expand domains above</div>}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Quick actions</h4></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0.75rem' }}>
              {[
                { label: 'Add new domain',        icon: <Plus size={13} />,   to: '/domains',        primary: true },
                { label: 'Security audit',         icon: <Shield size={13} />, to: '/audit' },
                { label: 'Email header analyser',  icon: <Zap size={13} />,    to: '/email-headers' },
                { label: 'Invite team member',     icon: <Users size={13} />,  to: '/members' },
              ].map(a => (
                <button key={a.label} className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => navigate(a.to)}>
                  {a.icon}<span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Inline Security Audit */}
      <div id="inline-audit">
        <InlineAudit triggerDomain={auditTarget} onClearTrigger={() => setAuditTarget(null)} />
      </div>
    </div>
  )
}
