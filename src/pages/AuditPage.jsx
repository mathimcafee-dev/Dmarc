import { useState } from 'react'
import { Search, Shield, AlertTriangle, CheckCircle, XCircle, Download, Globe, Mail, Zap, Lock } from 'lucide-react'

const SEVERITY = { critical: { color: '#dc2626', bg: '#fee2e2', label: 'Critical' }, high: { color: '#d97706', bg: '#fef3c7', label: 'High' }, medium: { color: '#2563eb', bg: '#eff6ff', label: 'Medium' }, low: { color: '#16a34a', bg: '#dcfce7', label: 'Low' } }

function ScoreBadge({ score }) {
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{grade}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 2 }}>{score}<span style={{ fontSize: 14, color: 'var(--neutral-400)' }}>/100</span></div>
    </div>
  )
}

function FindingRow({ f }) {
  const s = SEVERITY[f.severity] || SEVERITY.low
  const Icon = f.pass ? CheckCircle : f.severity === 'critical' ? XCircle : AlertTriangle
  return (
    <div style={{ borderRadius: 8, border: `1px solid ${f.pass ? '#bbf7d0' : s.color + '44'}`, background: f.pass ? '#f0fdf4' : s.bg, marginBottom: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', alignItems: 'flex-start' }}>
        <Icon size={16} color={f.pass ? '#16a34a' : s.color} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)' }}>{f.label}</span>
            {!f.pass && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: s.color, color: '#fff', textTransform: 'uppercase' }}>{s.label}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--neutral-500)', lineHeight: 1.5 }}>{f.desc}</div>
          {!f.pass && f.fix && (
            <div style={{ marginTop: 7, padding: '7px 10px', background: 'rgba(255,255,255,0.7)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.5, marginBottom: f.record ? 5 : 0 }}>💡 {f.fix}</div>
              {f.record && (
                <div style={{ background: '#0e1624', borderRadius: 5, padding: '6px 10px', display: 'flex', gap: 8 }}>
                  <code style={{ fontSize: 10, color: '#93c5fd', flex: 1, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.6 }}>{f.record}</code>
                  <button onClick={() => navigator.clipboard.writeText(f.record)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 7px', color: '#60a5fa', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>Copy</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AuditPage() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function runAudit(d) {
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

  const examples = ['google.com', 'apple.com', 'microsoft.com']

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DNS & Email Security Audit</h1>
          <p>Complete security audit for any domain — DMARC, SPF, DKIM, MX, BIMI, blacklist, attack surface and more.</p>
        </div>
        {result && (
          <a href={`/api/full-audit?domain=${result.domain}&pdf=1`} target="_blank" rel="noreferrer" className="btn btn-secondary">
            <Download size={14} />Export PDF
          </a>
        )}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Globe size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
            <input className="input" style={{ paddingLeft: '2.25rem', fontSize: 15 }}
              placeholder="Enter any domain (e.g. yourcompany.com)"
              value={domain} onChange={e => setDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAudit()}
              autoFocus />
          </div>
          <button className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} onClick={() => runAudit()} disabled={!domain.trim() || loading}>
            {!loading && <><Search size={14} />Run audit</>}
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>Try:</span>
          {examples.map(e => (
            <button key={e} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
              onClick={() => { setDomain(e); runAudit(e) }}>{e}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: 14, color: 'var(--neutral-500)', marginBottom: 8 }}>Running full security audit on <strong>{domain}</strong></div>
            <div style={{ fontSize: 12, color: 'var(--neutral-400)' }}>Checking DMARC · SPF · DKIM · MX · BIMI · Blacklists · Attack surface…</div>
          </div>
        </div>
      )}

      {error && <div className="alert-banner danger"><XCircle size={15} /><span>{error}</span></div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Score overview */}
          <div className="card">
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '2rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--neutral-50)', borderRadius: 12 }}>
                <ScoreBadge score={result.score} />
                <div style={{ fontSize: 12, color: 'var(--neutral-400)', marginTop: 8 }}>Security score</div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: result.score >= 75 ? '#dcfce7' : result.score >= 50 ? '#fef3c7' : '#fee2e2', color: result.score >= 75 ? '#16a34a' : result.score >= 50 ? '#b45309' : '#dc2626', marginTop: 6, display: 'inline-block' }}>
                  {result.verdict}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--neutral-900)', marginBottom: 4 }}>{result.domain}</div>
                <div style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: '1rem' }}>{result.summary}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[
                    { label: 'Critical', count: result.findings.filter(f => !f.pass && f.severity === 'critical').length, color: '#dc2626', bg: '#fee2e2' },
                    { label: 'High',     count: result.findings.filter(f => !f.pass && f.severity === 'high').length,     color: '#d97706', bg: '#fef3c7' },
                    { label: 'Medium',   count: result.findings.filter(f => !f.pass && f.severity === 'medium').length,   color: '#2563eb', bg: '#eff6ff' },
                    { label: 'Passing',  count: result.findings.filter(f => f.pass).length,                              color: '#16a34a', bg: '#dcfce7' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', background: s.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.count}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ESP Detection */}
          {result.providers?.length > 0 && (
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Detected email service providers</h4></div>
              <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '1rem' }}>
                {result.providers.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--neutral-50)', border: '1px solid var(--neutral-150)', borderRadius: 8 }}>
                    <Mail size={13} color="var(--brand-500)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--neutral-400)' }}>via {p.signal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attack surface */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Attack surface</h4></div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, padding: '1rem' }}>
              {result.attackSurface.map((v, i) => (
                <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: v.risk === 'high' ? '#fff5f5' : v.risk === 'medium' ? '#fffbeb' : '#f0fdf4', border: `1px solid ${v.risk === 'high' ? '#fecaca' : v.risk === 'medium' ? '#fde047' : '#bbf7d0'}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: v.risk === 'high' ? '#dc2626' : v.risk === 'medium' ? '#b45309' : '#16a34a', marginBottom: 3 }}>
                    {v.risk === 'high' ? '🔴' : v.risk === 'medium' ? '🟡' : '🟢'} {v.vector}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.4 }}>{v.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Findings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {[
              { title: 'DMARC & Policy', icon: Shield, keys: ['dmarc'] },
              { title: 'SPF Record',     icon: Lock,   keys: ['spf'] },
              { title: 'DKIM Signing',   icon: Zap,    keys: ['dkim'] },
              { title: 'MX & Mail',      icon: Mail,   keys: ['mx'] },
            ].map(sec => {
              const items = result.findings.filter(f => f.category === sec.keys[0])
              if (!items.length) return null
              const Icon = sec.icon
              return (
                <div key={sec.title} className="card">
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={15} color="var(--brand-500)" />
                    <h4 style={{ margin: 0 }}>{sec.title}</h4>
                  </div>
                  <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                    {items.map((f, i) => <FindingRow key={i} f={f} />)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Other findings */}
          {result.findings.filter(f => !['dmarc','spf','dkim','mx'].includes(f.category)).length > 0 && (
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Additional checks</h4></div>
              <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
                {result.findings.filter(f => !['dmarc','spf','dkim','mx'].includes(f.category)).map((f, i) => <FindingRow key={i} f={f} />)}
              </div>
            </div>
          )}

          {/* Prioritised action plan */}
          <div className="card" style={{ border: '1.5px solid var(--brand-200)', background: 'var(--brand-50)' }}>
            <div className="card-header" style={{ background: 'var(--brand-100)' }}>
              <h4 style={{ margin: 0, color: 'var(--brand-700)' }}>Prioritised action plan</h4>
            </div>
            <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
              {result.findings.filter(f => !f.pass).sort((a,b) => {
                const order = { critical:0, high:1, medium:2, low:3 }
                return (order[a.severity]||3) - (order[b.severity]||3)
              }).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--brand-150)', alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: SEVERITY[f.severity]?.color || '#94a3b8', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{f.fix}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: SEVERITY[f.severity]?.color || '#94a3b8', color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>{f.severity}</span>
                </div>
              ))}
              {result.findings.every(f => f.pass) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                  <CheckCircle size={16} />No issues found — this domain has excellent email security configuration.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
