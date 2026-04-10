import { useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldX, Search } from 'lucide-react'
import { useDomains } from '../hooks/useDomains'

export function BlacklistPage() {
  const { domains } = useDomains()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function check(domainName) {
    const target = (domainName || query).trim()
    if (!target) return
    setLoading(true); setResult(null); setError('')
    try {
      const res  = await fetch(`/api/blacklist-check?domain=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Blacklist Check</h1>
          <p>Check if a domain or IP is listed on major email blacklists.</p>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
            <input className="input" style={{ paddingLeft: '2.25rem' }} placeholder="Enter domain or IP address…"
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && check()} />
          </div>
          <button className="btn btn-primary" onClick={() => check()} disabled={!query.trim() || loading}>
            {loading ? 'Checking…' : 'Check now'}
          </button>
        </div>
        {/* Quick check from monitored domains */}
        {domains.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 600 }}>Quick check:</span>
            {domains.slice(0, 5).map(d => (
              <button key={d.id} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                onClick={() => { setQuery(d.domain); check(d.domain) }}>
                {d.domain}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="alert-banner danger" style={{ marginBottom: '1.25rem' }}><ShieldX size={15} /><span>{error}</span></div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              {result.status === 'clean'   && <ShieldCheck size={44} color="var(--success-500)" />}
              {result.status === 'warning' && <ShieldAlert size={44} color="var(--warning-500)" />}
              {result.status === 'danger'  && <ShieldX    size={44} color="var(--danger-500)"  />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: result.status === 'clean' ? 'var(--success-600)' : result.status === 'warning' ? 'var(--warning-600)' : 'var(--danger-600)', marginBottom: 4 }}>
                  {result.status === 'clean' ? 'Not blacklisted' : result.status === 'warning' ? 'Listed on some blacklists' : 'Listed on multiple blacklists'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>
                  {result.domain} · IP: {result.ip || 'not resolved'} · Checked {result.checked} lists
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger-500)' }}>{result.listed_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500 }}>Listed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success-500)' }}>{result.clean_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500 }}>Clean</div>
                </div>
              </div>
            </div>
          </div>

          {/* Results table */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Blacklist results</h4></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, padding: '1rem 1.25rem' }}>
              {result.results?.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: r.listed ? 'var(--danger-50)' : 'var(--neutral-50)', border: `1px solid ${r.listed ? 'var(--danger-100)' : 'var(--neutral-150)'}` }}>
                  {r.listed ? <ShieldX size={14} color="var(--danger-500)" /> : <ShieldCheck size={14} color="var(--success-500)" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.listed ? 'var(--danger-700)' : 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    {r.returnCode && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--danger-500)' }}>{r.returnCode}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: r.listed ? 'var(--danger-100)' : 'var(--success-100)', color: r.listed ? 'var(--danger-600)' : 'var(--success-600)' }}>
                    {r.listed ? 'Listed' : 'Clean'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
