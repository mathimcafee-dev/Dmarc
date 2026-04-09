import { useState } from 'react'
import { Shield, Search, CheckCircle, AlertTriangle, Copy, Info } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { useDomains } from '../hooks/useDomains'

function Tag({ label, value, color }) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>{label}=</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: color || 'var(--neutral-800)' }}>{value}</span>
    </div>
  )
}

export function DMARCPage() {
  const { domains } = useDomains()
  const toast = useToast()
  const [lookup, setLookup] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLookup(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    const domain = lookup.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!domain) return
    setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=_dmarc.${domain}&type=TXT&prefix=v%3DDMARC1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult({ domain, records: data.records, queried_at: data.queried_at })
    } catch (err) {
      setError(err.message || 'Lookup failed')
    }
    setLoading(false)
  }

  function parseDMARC(raw) {
    if (!raw) return {}
    const tags = {}
    raw.split(';').forEach(p => {
      const [k, v] = p.trim().split('=')
      if (k && v !== undefined) tags[k.trim().toLowerCase()] = v.trim()
    })
    return tags
  }

  const policyColor = { reject: 'var(--success-500)', quarantine: 'var(--warning-500)', none: 'var(--danger-500)' }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DMARC</h1>
          <p>Look up DMARC records for any domain, or view records for your monitored domains.</p>
        </div>
      </div>

      {/* Lookup tool */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} />
            <h4 style={{ margin: 0 }}>DMARC Lookup</h4>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Domain to check</label>
              <div style={{ position: 'relative' }}>
                <Shield size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={lookup} onChange={e => setLookup(e.target.value)} required />
              </div>
              <span className="form-hint">Queries <code>_dmarc.{lookup || 'example.com'}</code> TXT record</span>
            </div>
            <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading} style={{ marginBottom: '1.375rem' }}>
              {!loading && <><Search size={14} /><span>Lookup</span></>}
            </button>
          </form>

          {error && <div className="alert-banner danger" style={{ marginTop: '0.5rem' }}><AlertTriangle size={15} /><span>{error}</span></div>}

          {result && (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>_dmarc.{result.domain}</span>
                <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>queried {new Date(result.queried_at).toLocaleTimeString('en-IN')}</span>
              </div>

              {result.records.length === 0 ? (
                <div className="alert-banner danger"><AlertTriangle size={15} /><span>No DMARC record found for this domain. They are unprotected against email spoofing.</span></div>
              ) : result.records.map((rec, i) => {
                const tags = parseDMARC(rec.data)
                return (
                  <div key={i} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--neutral-50)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={14} color="var(--success-500)" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>DMARC Record found</span>
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }} onClick={() => { navigator.clipboard.writeText(rec.data); toast('Copied!', 'info') }}>
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="code-block" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--neutral-200)' }}>{rec.data}</div>
                    <div style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--neutral-150)', background: 'var(--neutral-0)' }}>
                      {tags.p && <Tag label="p" value={tags.p} color={policyColor[tags.p]} />}
                      {tags.sp && <Tag label="sp" value={tags.sp} />}
                      {tags.pct && <Tag label="pct" value={`${tags.pct}%`} />}
                      {tags.adkim && <Tag label="adkim" value={tags.adkim} />}
                      {tags.aspf && <Tag label="aspf" value={tags.aspf} />}
                      {tags.rua && <Tag label="rua" value={tags.rua} />}
                    </div>
                    {tags.p && (
                      <div className={`alert-banner ${tags.p === 'reject' ? 'success' : tags.p === 'quarantine' ? 'warning' : 'danger'}`} style={{ margin: '0 1rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                        <Info size={14} />
                        <span>
                          {tags.p === 'reject' && 'Strong — spoofed emails are fully rejected.'}
                          {tags.p === 'quarantine' && 'Moderate — spoofed emails go to spam. Consider moving to p=reject.'}
                          {tags.p === 'none' && 'Monitoring only — spoofed emails are still delivered. Move to p=quarantine or p=reject to enforce protection.'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monitored domains DMARC */}
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Your monitored domains</h3>
        {domains.length === 0 ? (
          <div className="card"><div className="empty-state"><p className="empty-title">No domains yet</p><p className="empty-desc">Add domains from the Domains page to see their DMARC status here.</p></div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>DMARC Policy</th>
                  <th>Subdomain Policy</th>
                  <th>Reporting (RUA)</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {domains.map(d => (
                  <tr key={d.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{d.domain}</span></td>
                    <td>
                      {d.dmarc_policy ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: policyColor[d.dmarc_policy] }}>p={d.dmarc_policy}</span>
                      ) : <span className="badge badge-neutral">No record</span>}
                    </td>
                    <td><span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>—</span></td>
                    <td><span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>—</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 60, height: 5, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${d.health_score || 0}%`, background: (d.health_score || 0) >= 80 ? 'var(--success-500)' : (d.health_score || 0) >= 50 ? 'var(--warning-500)' : 'var(--danger-500)', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{d.health_score || 0}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
