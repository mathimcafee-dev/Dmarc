import { Key, Image, Search, CheckCircle, AlertTriangle, Copy } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../components/ui/Toast'

// ─── DKIM Page ───────────────────────────────────────────────────────────────
export function DKIMPage() {
  const toast = useToast()
  const [lookup, setLookup] = useState('')
  const [selector, setSelector] = useState('google')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const COMMON_SELECTORS = ['google', 'default', 'k1', 'k2', 'mail', 'smtp', 'selector1', 'selector2', 's1', 's2', 'dkim', 'email']

  async function handleLookup(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    const domain = lookup.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setLoading(true)
    try {
      const name = `${selector}._domainkey.${domain}`
      const res = await fetch(`/api/dns-lookup?domain=${encodeURIComponent(name)}&type=TXT`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult({ domain, selector, name, records: data.records })
    } catch (err) {
      setError(err.message || 'Lookup failed')
    }
    setLoading(false)
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DKIM Records</h1>
          <p>Look up DKIM public keys for any domain and selector.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><h4 style={{ margin: 0 }}>DKIM Lookup</h4></div>
        <div className="card-body">
          <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Domain</label>
              <input className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={lookup} onChange={e => setLookup(e.target.value)} required />
            </div>
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label">Selector</label>
              <input className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="google" value={selector} onChange={e => setSelector(e.target.value)} required />
            </div>
            <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading} style={{ marginBottom: '1.375rem' }}>
              {!loading && <><Search size={14} /><span>Lookup</span></>}
            </button>
          </form>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', alignSelf: 'center' }}>Common selectors:</span>
            {COMMON_SELECTORS.map(s => (
              <button key={s} className="btn btn-ghost btn-sm" style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: selector === s ? 'var(--brand-50)' : '', color: selector === s ? 'var(--brand-600)' : '' }} onClick={() => setSelector(s)}>{s}</button>
            ))}
          </div>

          {error && <div className="alert-banner danger" style={{ marginTop: '1rem' }}><AlertTriangle size={15} /><span>{error}</span></div>}

          {result && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--neutral-700)' }}>{result.name}</code>
              </div>
              {result.records.length === 0 ? (
                <div className="alert-banner warning"><AlertTriangle size={15} /><span>No DKIM record found for selector <strong>{result.selector}</strong>. Try a different selector.</span></div>
              ) : (
                <div style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--neutral-50)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={14} color="var(--success-500)" /><span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>DKIM record found</span></div>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }} onClick={() => { navigator.clipboard.writeText(result.records[0].data); toast('Copied!', 'info') }}><Copy size={12} /></button>
                  </div>
                  <div className="code-block" style={{ borderRadius: 0 }}>{result.records[0].data}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="alert-banner info">
        <Key size={15} />
        <span>DKIM records are published at <code style={{ fontFamily: 'var(--font-mono)' }}>[selector]._domainkey.[domain]</code>. Your email provider (Google, Microsoft, etc.) will tell you which selector to use.</span>
      </div>
    </div>
  )
}

// ─── BIMI Page ────────────────────────────────────────────────────────────────
export function BIMIPage() {
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
    setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=default._bimi.${encodeURIComponent(domain)}&type=TXT&prefix=v%3DBIMI1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult({ domain, records: data.records })
    } catch (err) {
      setError(err.message || 'Lookup failed')
    }
    setLoading(false)
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>BIMI</h1>
          <p>Brand Indicators for Message Identification — display your logo in email clients.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><h4 style={{ margin: 0 }}>BIMI Lookup</h4></div>
          <div className="card-body">
            <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Domain</label>
                <input className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={lookup} onChange={e => setLookup(e.target.value)} required />
              </div>
              <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading} style={{ marginBottom: '1.375rem' }}>
                {!loading && <><Search size={14} /><span>Lookup</span></>}
              </button>
            </form>
            {error && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{error}</span></div>}
            {result && (
              <div style={{ marginTop: '1rem' }}>
                {result.records.length === 0 ? (
                  <div className="alert-banner info"><Image size={15} /><span>No BIMI record found for <strong>{result.domain}</strong>.</span></div>
                ) : (
                  <div style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--neutral-50)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={14} color="var(--success-500)" /><span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>BIMI record found</span></div>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }} onClick={() => { navigator.clipboard.writeText(result.records[0].data); toast('Copied!', 'info') }}><Copy size={12} /></button>
                    </div>
                    <div className="code-block" style={{ borderRadius: 0 }}>{result.records[0].data}</div>
                    {result.records[0].data.includes('l=') && (
                      <div style={{ padding: '1rem', borderTop: '1px solid var(--neutral-150)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', marginBottom: '0.5rem' }}>BRAND LOGO</div>
                        <img src={result.records[0].data.split('l=')[1]?.split(';')[0]?.trim()} alt="BIMI Logo" style={{ maxHeight: 64, borderRadius: 8, border: '1px solid var(--neutral-150)' }} onError={e => e.target.style.display = 'none'} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 style={{ margin: 0 }}>Requirements</h4></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'DMARC p=quarantine or p=reject', ok: true },
              { label: 'SVG logo (Tiny 1.2 spec)', ok: true },
              { label: 'Logo hosted on HTTPS', ok: true },
              { label: 'VMC certificate (for Gmail)', ok: false, optional: true },
            ].map((req, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.8125rem' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: req.ok ? 'var(--success-100)' : 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  {req.ok ? <CheckCircle size={11} color="var(--success-600)" /> : <AlertTriangle size={11} color="var(--neutral-400)" />}
                </div>
                <span style={{ color: req.optional ? 'var(--neutral-400)' : 'var(--neutral-700)' }}>{req.label}{req.optional ? ' (optional)' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
