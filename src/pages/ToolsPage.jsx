import { useState } from 'react'
import { Shield, Search, CheckCircle, AlertTriangle, Copy, Globe, Key, Mail, Info, Zap } from 'lucide-react'
import { useToast } from '../components/ui/Toast'

function CopyBtn({ value }) {
  const toast = useToast()
  return (
    <button
      className="btn btn-ghost btn-sm"
      style={{ padding: '0.25rem' }}
      onClick={() => { navigator.clipboard.writeText(value); toast('Copied!', 'success') }}
    >
      <Copy size={12} />
    </button>
  )
}

function RecordBox({ label, value, empty = 'No record found' }) {
  if (!value) return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>{label}</div>
      <div style={{ padding: '0.75rem 1rem', background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--neutral-200)', fontSize: '0.875rem', color: 'var(--neutral-400)' }}>{empty}</div>
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <CopyBtn value={value} />
      </div>
      <div className="code-block" style={{ fontSize: '0.8125rem' }}>{value}</div>
    </div>
  )
}

function ResultCard({ ok, label, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--neutral-100)' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: ok ? 'var(--success-100)' : 'var(--danger-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
        {ok
          ? <CheckCircle size={13} color="var(--success-600)" />
          : <AlertTriangle size={13} color="var(--danger-600)" />}
      </div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-800)' }}>{label}</div>
        {detail && <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)', marginTop: '0.125rem' }}>{detail}</div>}
      </div>
    </div>
  )
}

// ── DMARC Checker ────────────────────────────────────────────────────────────
function DMARCChecker() {
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheck(e) {
    e.preventDefault()
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!clean) return
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=_dmarc.${clean}&type=TXT&prefix=v%3DDMARC1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record = data.records?.[0]?.data || null
      const tags = {}
      if (record) record.split(';').forEach(p => {
        const [k, v] = p.trim().split('=')
        if (k && v !== undefined) tags[k.trim().toLowerCase()] = v.trim()
      })
      setResult({ domain: clean, record, tags, queried_at: data.queried_at })
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const policyColor = { reject: 'var(--success-500)', quarantine: 'var(--warning-500)', none: 'var(--danger-500)' }

  return (
    <div>
      <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Shield size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
          <input className="input" style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        </div>
        <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
          {!loading && <><Search size={14} /><span>Check</span></>}
        </button>
      </form>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{error}</span></div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!result.record ? (
            <div className="alert-banner danger">
              <AlertTriangle size={15} />
              <span><strong>{result.domain}</strong> has no DMARC record. This domain is unprotected — anyone can spoof emails from it.</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-900)' }}>{result.domain}</span>
                {result.tags.p && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', color: policyColor[result.tags.p] || 'var(--neutral-600)' }}>
                    p={result.tags.p}
                  </span>
                )}
                <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                  {new Date(result.queried_at).toLocaleTimeString('en-IN')}
                </span>
              </div>

              <RecordBox label="DMARC Record" value={result.record} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <ResultCard ok={!!result.tags.p} label="DMARC record exists" detail={result.record ? 'Record found' : 'No record'} />
                <ResultCard
                  ok={result.tags.p === 'reject' || result.tags.p === 'quarantine'}
                  label="Policy enforced"
                  detail={result.tags.p === 'none' ? 'p=none only monitors — not enforced' : result.tags.p ? `p=${result.tags.p} is active` : 'No policy'}
                />
                <ResultCard ok={!!result.tags.rua} label="Aggregate reporting (RUA)" detail={result.tags.rua || 'No RUA configured'} />
                <ResultCard ok={result.tags.pct === '100' || !result.tags.pct} label="Full coverage (pct=100)" detail={result.tags.pct ? `${result.tags.pct}% of emails covered` : 'Defaults to 100%'} />
              </div>

              {result.tags.p === 'none' && (
                <div className="alert-banner warning">
                  <Info size={15} />
                  <span>p=none only monitors. Spoofed emails are still delivered. Upgrade to p=quarantine or p=reject for real protection.</span>
                </div>
              )}
              {result.tags.p === 'reject' && (
                <div className="alert-banner success">
                  <CheckCircle size={15} />
                  <span>p=reject — strongest protection. Spoofed emails are fully blocked.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── SPF Checker ──────────────────────────────────────────────────────────────
function SPFChecker() {
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheck(e) {
    e.preventDefault()
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=${clean}&type=TXT&prefix=v%3Dspf1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record = data.records?.[0]?.data || null
      let lookupCount = 0
      if (record) {
        const parts = record.split(/\s+/)
        lookupCount = parts.filter(p => ['include:', 'a', 'mx', 'ptr', 'exists:', 'redirect='].some(t => p.includes(t))).length
      }
      setResult({ domain: clean, record, lookupCount, queried_at: data.queried_at })
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div>
      <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Globe size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
          <input className="input" style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        </div>
        <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
          {!loading && <><Search size={14} /><span>Check</span></>}
        </button>
      </form>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{error}</span></div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!result.record ? (
            <div className="alert-banner danger">
              <AlertTriangle size={15} />
              <span><strong>{result.domain}</strong> has no SPF record. Receiving servers cannot verify your email senders.</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{result.domain}</span>
                <span className={`badge ${result.lookupCount > 10 ? 'badge-danger' : 'badge-success'}`}>
                  {result.lookupCount}/10 lookups
                </span>
              </div>
              <RecordBox label="SPF Record" value={result.record} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <ResultCard ok={!!result.record} label="SPF record exists" detail="v=spf1 record found" />
                <ResultCard ok={result.lookupCount <= 10} label="DNS lookup limit OK" detail={`${result.lookupCount}/10 lookups used${result.lookupCount > 10 ? ' — exceeds limit, SPF will fail' : ''}`} />
                <ResultCard ok={result.record?.includes('-all') || result.record?.includes('~all')} label="All mechanism present" detail={result.record?.includes('-all') ? 'Hard fail (-all)' : result.record?.includes('~all') ? 'Soft fail (~all)' : 'Missing — add ~all or -all'} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── DKIM Checker ─────────────────────────────────────────────────────────────
function DKIMChecker() {
  const [domain, setDomain] = useState('')
  const [selector, setSelector] = useState('google')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const COMMON = ['google', 'default', 'selector1', 'selector2', 'k1', 'mail', 's1', 's2']

  async function handleCheck(e) {
    e.preventDefault()
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const name = `${selector}._domainkey.${clean}`
      const res = await fetch(`/api/dns-lookup?domain=${encodeURIComponent(name)}&type=TXT`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record = data.records?.find(r => r.data?.includes('v=DKIM1'))?.data || null
      setResult({ domain: clean, selector, name, record })
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div>
      <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Key size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
          <input className="input" style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        </div>
        <input className="input" style={{ fontFamily: 'var(--font-mono)', width: 140 }} placeholder="selector" value={selector} onChange={e => setSelector(e.target.value)} required />
        <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
          {!loading && <><Search size={14} /><span>Check</span></>}
        </button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', alignSelf: 'center' }}>Common:</span>
        {COMMON.map(s => (
          <button key={s} onClick={() => setSelector(s)} className="btn btn-ghost btn-sm"
            style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: selector === s ? 'var(--brand-50)' : '', color: selector === s ? 'var(--brand-600)' : '' }}>
            {s}
          </button>
        ))}
      </div>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{error}</span></div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>{result.name}</div>
          {!result.record ? (
            <div className="alert-banner warning">
              <AlertTriangle size={15} />
              <span>No DKIM record found for selector <strong>{result.selector}</strong>. Try a different selector.</span>
            </div>
          ) : (
            <>
              <div className="alert-banner success"><CheckCircle size={15} /><span>DKIM record found for selector <strong>{result.selector}</strong>.</span></div>
              <RecordBox label="DKIM Public Key" value={result.record} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── MX Checker ───────────────────────────────────────────────────────────────
function MXChecker() {
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheck(e) {
    e.preventDefault()
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=${clean}&type=MX`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult({ domain: clean, records: data.records || [] })
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div>
      <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
          <input className="input" style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        </div>
        <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
          {!loading && <><Search size={14} /><span>Check</span></>}
        </button>
      </form>

      {error && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{error}</span></div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {result.records.length === 0 ? (
            <div className="alert-banner danger"><AlertTriangle size={15} /><span>No MX records found for <strong>{result.domain}</strong>.</span></div>
          ) : (
            <>
              <div className="alert-banner success"><CheckCircle size={15} /><span>{result.records.length} MX record{result.records.length > 1 ? 's' : ''} found for <strong>{result.domain}</strong>.</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Priority</th><th>Mail server</th></tr></thead>
                  <tbody>
                    {result.records.map((r, i) => {
                      const parts = r.data?.split(' ') || []
                      return (
                        <tr key={i}>
                          <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{parts[0] || '—'}</span></td>
                          <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{parts[1] || r.data}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'dmarc', label: 'DMARC Checker',  icon: <Shield size={16} />,  desc: 'Check any domain\'s DMARC policy and reporting configuration',  component: <DMARCChecker /> },
  { id: 'spf',   label: 'SPF Lookup',     icon: <Globe size={16} />,   desc: 'Validate SPF records and check DNS lookup count',               component: <SPFChecker /> },
  { id: 'dkim',  label: 'DKIM Lookup',    icon: <Key size={16} />,     desc: 'Check DKIM public key records for any selector',                component: <DKIMChecker /> },
  { id: 'mx',    label: 'MX Lookup',      icon: <Mail size={16} />,    desc: 'Find mail servers responsible for receiving email',             component: <MXChecker /> },
]

export function ToolsPage() {
  const [activeTool, setActiveTool] = useState('dmarc')
  const current = TOOLS.find(t => t.id === activeTool)

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <Zap size={20} color="var(--brand-500)" />
          <h1 style={{ margin: 0 }}>Free DNS Tools</h1>
        </div>
        <p style={{ color: 'var(--neutral-500)', fontSize: '0.9375rem' }}>
          Check DMARC, SPF, DKIM and MX records for any domain — no login required.
        </p>
      </div>

      {/* Tool cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
        {TOOLS.map(tool => (
          <div
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            style={{
              padding: '1rem 1.125rem',
              background: activeTool === tool.id ? 'var(--brand-50)' : 'var(--neutral-0)',
              border: `1px solid ${activeTool === tool.id ? 'var(--brand-200)' : 'var(--neutral-150)'}`,
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ color: activeTool === tool.id ? 'var(--brand-500)' : 'var(--neutral-500)', marginBottom: '0.5rem' }}>{tool.icon}</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: activeTool === tool.id ? 'var(--brand-700)' : 'var(--neutral-800)', marginBottom: '0.25rem' }}>{tool.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', lineHeight: 1.4 }}>{tool.desc}</div>
          </div>
        ))}
      </div>

      {/* Active tool */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ color: 'var(--brand-500)' }}>{current?.icon}</div>
            <h4 style={{ margin: 0 }}>{current?.label}</h4>
          </div>
        </div>
        <div className="card-body">
          {current?.component}
        </div>
      </div>

      {/* Sign up CTA */}
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--brand-800)', marginBottom: '0.25rem' }}>Want to monitor your own domains?</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--brand-700)' }}>Get daily scans, health scores, fix suggestions and email alerts — completely free.</div>
        </div>
        <a href="/signup" className="btn btn-primary">Create free account →</a>
      </div>
    </div>
  )
}
