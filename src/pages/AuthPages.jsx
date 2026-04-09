import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, User, ArrowRight, Eye, EyeOff, CheckCircle, AlertTriangle, Copy, Key, Globe, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'

// ── Shared tool helpers ───────────────────────────────────────────────────────
function copyText(text, toast) {
  navigator.clipboard.writeText(text)
  toast('Copied!', 'success')
}

function CheckRow({ ok, label, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: ok ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {ok
          ? <CheckCircle size={9} color="#16a34a" />
          : <AlertTriangle size={9} color="#dc2626" />}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{label}</div>
        {detail && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{detail}</div>}
      </div>
    </div>
  )
}

// ── Tool: DMARC ───────────────────────────────────────────────────────────────
function DMARCTool() {
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function check(e) {
    e.preventDefault()
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=_dmarc.${d}&type=TXT&prefix=v%3DDMARC1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record = data.records?.[0]?.data || null
      const tags = {}
      if (record) record.split(';').forEach(p => { const [k, v] = p.trim().split('='); if (k && v !== undefined) tags[k.trim().toLowerCase()] = v.trim() })
      setResult({ domain: d, record, tags })
    } catch (err) { setError('Lookup failed. Try again.') }
    setLoading(false)
  }

  const policyBg = { reject: '#dcfce7', quarantine: '#fef3c7', none: '#fee2e2' }
  const policyColor = { reject: '#16a34a', quarantine: '#b45309', none: '#dc2626' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ flex: 1, height: 34, border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '0 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none', color: '#0f172a', background: '#fff' }}
          placeholder="yourdomain.com"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}
          style={{ height: 34, padding: '0 14px', background: '#0f172a', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {loading ? '…' : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Check</>}
        </button>
      </form>

      {error && <div style={{ fontSize: 11, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}

      {result && !result.record && (
        <div style={{ fontSize: 11, color: '#b45309', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>
          No DMARC record found for <strong>{result.domain}</strong>. Domain is unprotected.
        </div>
      )}

      {result?.record && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{result.domain}</span>
            {result.tags.p && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', background: policyBg[result.tags.p] || '#f1f5f9', color: policyColor[result.tags.p] || '#374151', border: '1px solid currentColor' }}>
                p={result.tags.p}
              </span>
            )}
            <button onClick={() => copyText(result.record, toast)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8' }}><Copy size={11} /></button>
          </div>
          <div style={{ background: '#f8fafc', borderLeft: '3px solid #1a6bff', padding: '8px 10px', fontSize: 9, fontFamily: 'monospace', color: '#1d4ed8', lineHeight: 1.6, wordBreak: 'break-all' }}>
            {result.record}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CheckRow ok={true} label="DMARC record exists" detail="Found in DNS" />
            <CheckRow ok={result.tags.p === 'reject' || result.tags.p === 'quarantine'} label="Policy enforced" detail={result.tags.p === 'none' ? 'p=none — monitoring only' : `p=${result.tags.p} active`} />
            <CheckRow ok={!!result.tags.rua} label="Reporting (RUA) set" detail={result.tags.rua || 'No RUA configured'} />
            <CheckRow ok={result.tags.pct === '100' || !result.tags.pct} label="Full coverage" detail={result.tags.pct ? `${result.tags.pct}% covered` : '100% by default'} />
          </div>
          {result.tags.p === 'none' && (
            <div style={{ fontSize: 10, color: '#b45309', padding: '7px 9px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, lineHeight: 1.5 }}>
              Upgrade to p=quarantine or p=reject for real protection.
            </div>
          )}
          {result.tags.p === 'reject' && (
            <div style={{ fontSize: 10, color: '#16a34a', padding: '7px 9px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
              p=reject — strongest protection. Spoofed emails are fully blocked.
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Tool: SPF ─────────────────────────────────────────────────────────────────
function SPFTool() {
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function check(e) {
    e.preventDefault()
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=${d}&type=TXT&prefix=v%3Dspf1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record = data.records?.[0]?.data || null
      let lookups = 0
      if (record) lookups = record.split(/\s+/).filter(p => ['include:', 'a', 'mx', 'ptr', 'exists:', 'redirect='].some(t => p.includes(t))).length
      setResult({ domain: d, record, lookups })
    } catch { setError('Lookup failed. Try again.') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 6 }}>
        <input style={{ flex: 1, height: 34, border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '0 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none', color: '#0f172a', background: '#fff' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 34, padding: '0 14px', background: '#15803d', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}>
          {loading ? '…' : 'Check'}
        </button>
      </form>
      {error && <div style={{ fontSize: 11, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
      {result && !result.record && <div style={{ fontSize: 11, color: '#b45309', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>No SPF record found for <strong>{result.domain}</strong>.</div>}
      {result?.record && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{result.domain}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: result.lookups > 10 ? '#fee2e2' : '#dcfce7', color: result.lookups > 10 ? '#dc2626' : '#16a34a' }}>{result.lookups}/10 lookups</span>
            <button onClick={() => copyText(result.record, toast)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8' }}><Copy size={11} /></button>
          </div>
          <div style={{ background: '#f0fdf4', borderLeft: '3px solid #15803d', padding: '8px 10px', fontSize: 9, fontFamily: 'monospace', color: '#14532d', lineHeight: 1.6, wordBreak: 'break-all' }}>{result.record}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CheckRow ok={true} label="SPF record exists" detail="v=spf1 found" />
            <CheckRow ok={result.lookups <= 10} label="Lookup limit OK" detail={`${result.lookups}/10 used${result.lookups > 10 ? ' — exceeds limit!' : ''}`} />
            <CheckRow ok={result.record.includes('-all') || result.record.includes('~all')} label="All mechanism present" detail={result.record.includes('-all') ? 'Hard fail (-all)' : result.record.includes('~all') ? 'Soft fail (~all)' : 'Missing -all or ~all'} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Tool: DKIM ────────────────────────────────────────────────────────────────
function DKIMTool() {
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [selector, setSelector] = useState('google')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const SELECTORS = ['google', 'default', 'selector1', 'selector2', 'k1', 'mail']

  async function check(e) {
    e.preventDefault()
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const name = `${selector}._domainkey.${d}`
      const res = await fetch(`/api/dns-lookup?domain=${encodeURIComponent(name)}&type=TXT`)
      const data = await res.json()
      const record = data.records?.find(r => r.data?.includes('v=DKIM1'))?.data || null
      setResult({ domain: d, selector, record })
    } catch { setError('Lookup failed. Try again.') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input style={{ flex: 1, minWidth: 120, height: 34, border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '0 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none', color: '#0f172a', background: '#fff' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <input style={{ width: 100, height: 34, border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '0 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none', color: '#0f172a', background: '#fff' }} placeholder="selector" value={selector} onChange={e => setSelector(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 34, padding: '0 14px', background: '#7e22ce', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}>
          {loading ? '…' : 'Check'}
        </button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SELECTORS.map(s => (
          <button key={s} onClick={() => setSelector(s)} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, fontFamily: 'monospace', border: '1px solid', cursor: 'pointer', background: selector === s ? '#f3e8ff' : '#fff', color: selector === s ? '#7e22ce' : '#94a3b8', borderColor: selector === s ? '#d8b4fe' : '#e2e8f0' }}>
            {s}
          </button>
        ))}
      </div>
      {error && <div style={{ fontSize: 11, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
      {result && (
        <>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8' }}>{result.selector}._domainkey.{result.domain}</div>
          {!result.record
            ? <div style={{ fontSize: 11, color: '#b45309', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>No DKIM found for selector <strong>{result.selector}</strong>. Try another.</div>
            : <>
              <div style={{ fontSize: 10, color: '#16a34a', padding: '7px 9px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle size={11} />DKIM record found for <strong>{result.selector}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ background: '#fdf4ff', borderLeft: '3px solid #7e22ce', padding: '8px 10px', fontSize: 9, fontFamily: 'monospace', color: '#6b21a8', lineHeight: 1.6, wordBreak: 'break-all', flex: 1 }}>{result.record}</div>
                <button onClick={() => copyText(result.record, toast)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', flexShrink: 0 }}><Copy size={11} /></button>
              </div>
            </>}
        </>
      )}
    </div>
  )
}

// ── Tool: MX ──────────────────────────────────────────────────────────────────
function MXTool() {
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function check(e) {
    e.preventDefault()
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setError(''); setResult(null); setLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=${d}&type=MX`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult({ domain: d, records: data.records || [] })
    } catch { setError('Lookup failed. Try again.') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 6 }}>
        <input style={{ flex: 1, height: 34, border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '0 10px', fontSize: 11, fontFamily: 'monospace', outline: 'none', color: '#0f172a', background: '#fff' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 34, padding: '0 14px', background: '#c2410c', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}>
          {loading ? '…' : 'Check'}
        </button>
      </form>
      {error && <div style={{ fontSize: 11, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
      {result && (
        <>
          {result.records.length === 0
            ? <div style={{ fontSize: 11, color: '#dc2626', padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>No MX records found for <strong>{result.domain}</strong>.</div>
            : <>
              <div style={{ fontSize: 10, color: '#16a34a', padding: '7px 9px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}><CheckCircle size={10} style={{ display: 'inline', marginRight: 4 }} />{result.records.length} MX record{result.records.length > 1 ? 's' : ''} found</div>
              <div style={{ background: '#fff7ed', borderLeft: '3px solid #c2410c', borderRadius: '0 4px 4px 0', overflow: 'hidden' }}>
                {result.records.map((r, i) => {
                  const parts = r.data?.split(' ') || []
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: i < result.records.length - 1 ? '1px solid #fed7aa' : 'none' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#c2410c', minWidth: 24 }}>{parts[0]}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#7c2d12' }}>{parts[1] || r.data}</span>
                    </div>
                  )
                })}
              </div>
            </>}
        </>
      )}
    </div>
  )
}

// ── Left panel (tools) ────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'dmarc', label: 'DMARC', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#1a6bff', component: <DMARCTool /> },
  { id: 'spf',   label: 'SPF',   color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', component: <SPFTool /> },
  { id: 'dkim',  label: 'DKIM',  color: '#7e22ce', bg: '#fdf4ff', border: '#e9d5ff', dot: '#7e22ce', component: <DKIMTool /> },
  { id: 'mx',    label: 'MX',    color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c', component: <MXTool /> },
]

function ToolsPanel() {
  const [active, setActive] = useState('dmarc')
  const current = TOOLS.find(t => t.id === active)

  return (
    <div style={{ background: '#fff', height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 28px 24px' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '2.5px solid #0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: '#1a6bff', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={14} color="white" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            DNS<span style={{ color: '#1a6bff' }}>Monitor</span>
          </span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#1a6bff,#7c3aed)', padding: '3px 10px', borderRadius: 99, letterSpacing: '0.04em' }}>
          FREE TOOLS
        </div>
      </div>

      {/* Heading */}
      <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.25, marginBottom: 4 }}>
        Check any domain's<br /><span style={{ color: '#1a6bff' }}>email security</span>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
        Instant results — no account needed.
      </div>

      {/* Tool pills */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            style={{ padding: '5px 12px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active === t.id ? t.border : '#e2e8f0'}`, background: active === t.id ? t.bg : '#fff', color: active === t.id ? t.color : '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: active === t.id ? t.dot : '#cbd5e1' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tool card */}
      <div style={{ border: '1.5px solid #0f172a', borderRadius: 10, padding: 14, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#1a6bff,#7c3aed,#0891b2,#ea580c)' }} />
        <div style={{ paddingTop: 8, flex: 1 }}>
          {current?.component}
        </div>
      </div>
    </div>
  )
}

// ── Login page ────────────────────────────────────────────────────────────────
export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
    setLoading(false)
    if (error) { setError(error.message); return }
    toast('Welcome back!', 'success')
    navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 420px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* LEFT — tools */}
      <div style={{ borderRight: '1px solid #f1f3f8', overflowY: 'auto' }}>
        <ToolsPanel />
      </div>

      {/* RIGHT — login form */}
      <div style={{ background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: 360 }} className="fade-in">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <div style={{ width: 28, height: 28, background: '#1a6bff', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={14} color="white" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              DNS<span style={{ color: '#1a6bff' }}>Monitor</span>
            </span>
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 28, lineHeight: 1.5 }}>Manage your DMARC & DNS security.</div>

          {error && (
            <div style={{ display: 'flex', gap: 8, padding: '9px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                <input
                  style={{ width: '100%', height: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, paddingLeft: 36, paddingRight: 12, fontSize: 13, outline: 'none', color: '#0f172a', background: '#fff', fontFamily: 'inherit' }}
                  type="email" placeholder="you@company.com"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
                />
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: 11, color: '#1a6bff', fontWeight: 600, textDecoration: 'none' }}>Forgot?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                <input
                  style={{ width: '100%', height: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, paddingLeft: 36, paddingRight: 40, fontSize: 13, outline: 'none', color: '#0f172a', background: '#fff', fontFamily: 'inherit' }}
                  type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 0, display: 'flex' }}>
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', height: 44, background: loading ? '#93c5fd' : 'linear-gradient(135deg,#1a6bff,#1044c0)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'white', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, fontFamily: 'inherit' }}>
              {loading ? 'Signing in…' : <><span>Sign in</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
            <span style={{ fontSize: 11, color: '#cbd5e1' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
          </div>

          <div style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
            No account? <Link to="/signup" style={{ color: '#1a6bff', fontWeight: 700, textDecoration: 'none' }}>Create one free</Link>
          </div>

          <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
            <Zap size={11} color="#1a6bff" />
            Just browsing? <strong style={{ color: '#1a6bff', fontWeight: 700 }}>Free tools on the left ←</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Signup page — UNCHANGED ───────────────────────────────────────────────────
function BrandPanel() {
  const features = [
    'DMARC policy management & monitoring',
    'SPF, DKIM, BIMI record management',
    'Multi-tenant organisation support',
    'DNS health timeline & change history',
    'Real-time alerts & weekly digests',
  ]
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-bg" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(26,107,255,0.4)' }}>
            <Shield size={26} color="white" />
          </div>
          <h2 style={{ color: 'white', fontSize: '1.625rem', marginBottom: '0.5rem' }}>
            DNS<span style={{ color: 'var(--brand-400)' }}>Monitor</span>
          </h2>
          <p style={{ color: 'var(--neutral-400)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            Complete DMARC & DNS security management platform for EasySecurity.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <CheckCircle size={15} color="var(--brand-400)" />
              <span style={{ color: 'var(--neutral-300)', fontSize: '0.875rem' }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color: 'var(--neutral-500)', fontSize: '0.8125rem' }}>
            Part of the <strong style={{ color: 'var(--neutral-300)' }}>EasySecurity</strong> platform
          </p>
        </div>
      </div>
    </div>
  )
}

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { data, error } = await signUp(form.email, form.password, form.name)
    setLoading(false)
    if (error) { setError(error.message); return }
    if (data.user && !data.session) { setDone(true) }
    else { toast('Account created! Set up your organisation.', 'success'); navigate('/onboarding') }
  }

  if (done) return (
    <div className="auth-shell">
      <BrandPanel />
      <div className="auth-panel">
        <div className="auth-form-wrap fade-in" style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--success-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Mail size={28} color="var(--success-600)" />
          </div>
          <h2>Check your email</h2>
          <p style={{ marginTop: '0.5rem', color: 'var(--neutral-500)' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--neutral-700)' }}>{form.email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <BrandPanel />
      <div className="auth-panel">
        <div className="auth-form-wrap fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={16} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>DNS<span style={{ color: 'var(--brand-500)' }}>Monitor</span></span>
            </div>
            <h1 style={{ marginTop: '1.5rem', marginBottom: '0.375rem' }}>Create account</h1>
            <p style={{ color: 'var(--neutral-500)', fontSize: '0.9375rem' }}>Start managing your domain security</p>
          </div>
          {error && <div className="alert-banner danger" style={{ marginBottom: '1rem' }}><Shield size={16} /><span>{error}</span></div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem' }} type="text" placeholder="Mathi Kumar" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Work email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem' }} type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }} type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: 0, display: 'flex' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="form-hint">Must be at least 8 characters</span>
            </div>
            <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`} disabled={loading} style={{ marginTop: '0.5rem', width: '100%' }}>
              {!loading && <><span>Create account</span><ArrowRight size={16} /></>}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--neutral-500)', marginTop: '1.5rem' }}>
            Already have an account?{' '}<Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
