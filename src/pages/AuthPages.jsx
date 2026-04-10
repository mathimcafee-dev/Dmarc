import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, User, ArrowRight, Eye, EyeOff, CheckCircle, AlertTriangle, Copy, Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'

// ── Design tokens (hardcoded — no app CSS vars needed) ────────────────────────
const C = {
  navy: '#060d1a', navy2: '#0a1628', white: '#ffffff', blue: '#1a6bff',
  blue2: '#1044c0', blueLight: '#60a5fa', blueFaint: '#eff6ff',
  blueBorder: '#bfdbfe', blueText: '#1d4ed8',
  green: '#15803d', greenFaint: '#f0fdf4', greenBorder: '#bbf7d0',
  purple: '#7e22ce', purpleFaint: '#fdf4ff', purpleBorder: '#e9d5ff',
  orange: '#c2410c', orangeFaint: '#fff7ed', orangeBorder: '#fed7aa',
  slate50: '#f8fafc', slate100: '#f1f5f9', slate200: '#e2e8f0',
  slate300: '#cbd5e1', slate400: '#94a3b8', slate500: '#64748b',
  slate600: '#475569', slate700: '#334155', slate800: '#1e293b',
  slate900: '#0f172a', text: '#0f172a', danger: '#dc2626',
  dangerFaint: '#fef2f2', dangerBorder: '#fecaca',
  success: '#16a34a', successFaint: '#f0fdf4', successBorder: '#bbf7d0',
  warn: '#b45309', warnFaint: '#fffbeb', warnBorder: '#fde68a',
}

// ── Shared components ─────────────────────────────────────────────────────────
function CheckRow({ ok, label, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.slate100}` }}>
      <div style={{ width: 17, height: 17, borderRadius: 4, background: ok ? C.successFaint : C.dangerFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {ok ? <CheckCircle size={10} color={C.success} /> : <AlertTriangle size={10} color={C.danger} />}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.slate700 }}>{label}</div>
        {detail && <div style={{ fontSize: 11, color: C.slate400, marginTop: 1 }}>{detail}</div>}
      </div>
    </div>
  )
}

function CopyBtn({ value, toast }) {
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); toast('Copied!', 'success') }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.slate300, padding: 3, display: 'flex', flexShrink: 0 }}>
      <Copy size={13} />
    </button>
  )
}

// ── DMARC Tool ────────────────────────────────────────────────────────────────
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
    } catch { setError('Lookup failed. Check the domain and try again.') }
    setLoading(false)
  }

  const policyBg = { reject: C.successFaint, quarantine: C.warnFaint, none: C.dangerFaint }
  const policyColor = { reject: C.success, quarantine: C.warn, none: C.danger }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 8 }}>
        <input style={{ flex: 1, height: 48, border: `1.5px solid ${C.slate200}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontFamily: 'monospace', color: C.text, background: C.white, outline: 'none' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 48, padding: '0 20px', background: C.blueText, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Search size={14} />{loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <div style={{ fontSize: 13, color: C.danger, padding: '10px 14px', background: C.dangerFaint, borderRadius: 8, border: `1px solid ${C.dangerBorder}` }}>{error}</div>}
      {result && !result.record && <div style={{ fontSize: 13, color: C.warn, padding: '10px 14px', background: C.warnFaint, border: `1px solid ${C.warnBorder}`, borderRadius: 8 }}>No DMARC record found for <strong>{result.domain}</strong>. This domain is unprotected — anyone can spoof emails from it.</div>}
      {result?.record && (
        <div style={{ background: C.slate50, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.text }}>{result.domain}</span>
            {result.tags.p && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5, fontFamily: 'monospace', background: policyBg[result.tags.p] || C.slate100, color: policyColor[result.tags.p] || C.slate600, border: '1px solid currentColor' }}>p={result.tags.p}</span>}
            <CopyBtn value={result.record} toast={toast} />
          </div>
          <div style={{ background: C.white, borderLeft: `3px solid ${C.blue}`, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: C.blueText, lineHeight: 1.7, wordBreak: 'break-all', borderRadius: '0 6px 6px 0' }}>{result.record}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CheckRow ok={true} label="DMARC record exists" detail="Record found in DNS" />
            <CheckRow ok={result.tags.p === 'reject' || result.tags.p === 'quarantine'} label="Policy enforced" detail={result.tags.p === 'none' ? 'p=none — monitoring only, not protected' : `p=${result.tags.p} is active`} />
            <CheckRow ok={!!result.tags.rua} label="Reporting configured (RUA)" detail={result.tags.rua || 'No RUA configured'} />
            <CheckRow ok={result.tags.pct === '100' || !result.tags.pct} label="Full coverage" detail={result.tags.pct ? `${result.tags.pct}% covered` : '100% by default'} />
          </div>
          {result.tags.p === 'none' && <div style={{ fontSize: 12, color: C.warn, padding: '10px 12px', background: C.warnFaint, border: `1px solid ${C.warnBorder}`, borderRadius: 8 }}>⚠ Upgrade to p=quarantine or p=reject for real spoofing protection.</div>}
          {result.tags.p === 'reject' && <div style={{ fontSize: 12, color: C.success, padding: '10px 12px', background: C.successFaint, border: `1px solid ${C.successBorder}`, borderRadius: 8 }}>✓ p=reject — strongest protection. Spoofed emails are fully blocked.</div>}
        </div>
      )}
    </div>
  )
}

// ── SPF Tool ──────────────────────────────────────────────────────────────────
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
    } catch { setError('Lookup failed. Check the domain and try again.') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 8 }}>
        <input style={{ flex: 1, height: 48, border: `1.5px solid ${C.slate200}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontFamily: 'monospace', color: C.text, background: C.white, outline: 'none' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 48, padding: '0 20px', background: C.green, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Search size={14} />{loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <div style={{ fontSize: 13, color: C.danger, padding: '10px 14px', background: C.dangerFaint, borderRadius: 8, border: `1px solid ${C.dangerBorder}` }}>{error}</div>}
      {result && !result.record && <div style={{ fontSize: 13, color: C.warn, padding: '10px 14px', background: C.warnFaint, border: `1px solid ${C.warnBorder}`, borderRadius: 8 }}>No SPF record found for <strong>{result.domain}</strong>.</div>}
      {result?.record && (
        <div style={{ background: C.slate50, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.text }}>{result.domain}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: result.lookups > 10 ? C.dangerFaint : C.successFaint, color: result.lookups > 10 ? C.danger : C.success }}>{result.lookups}/10 lookups</span>
            <CopyBtn value={result.record} toast={toast} />
          </div>
          <div style={{ background: C.white, borderLeft: `3px solid ${C.green}`, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: C.green, lineHeight: 1.7, wordBreak: 'break-all', borderRadius: '0 6px 6px 0' }}>{result.record}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CheckRow ok={true} label="SPF record exists" detail="v=spf1 found" />
            <CheckRow ok={result.lookups <= 10} label="DNS lookup limit OK" detail={`${result.lookups}/10 used${result.lookups > 10 ? ' — exceeds limit, SPF will fail' : ''}`} />
            <CheckRow ok={result.record.includes('-all') || result.record.includes('~all')} label="All mechanism present" detail={result.record.includes('-all') ? 'Hard fail (-all)' : result.record.includes('~all') ? 'Soft fail (~all)' : 'Missing -all or ~all'} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── DKIM Tool ─────────────────────────────────────────────────────────────────
function DKIMTool() {
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [selector, setSelector] = useState('google')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const SELECTORS = ['google', 'default', 'selector1', 'selector2', 'k1', 'mail', 's1']

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
    } catch { setError('Lookup failed. Check the domain and try again.') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ flex: 1, minWidth: 160, height: 48, border: `1.5px solid ${C.slate200}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontFamily: 'monospace', color: C.text, background: C.white, outline: 'none' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <input style={{ width: 130, height: 48, border: `1.5px solid ${C.slate200}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontFamily: 'monospace', color: C.text, background: C.white, outline: 'none' }} placeholder="selector" value={selector} onChange={e => setSelector(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 48, padding: '0 20px', background: C.purple, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Search size={14} />{loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <span style={{ fontSize: 12, color: C.slate400, alignSelf: 'center' }}>Common:</span>
        {SELECTORS.map(s => (
          <button key={s} onClick={() => setSelector(s)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'monospace', border: '1px solid', cursor: 'pointer', background: selector === s ? C.purpleFaint : C.white, color: selector === s ? C.purple : C.slate400, borderColor: selector === s ? C.purpleBorder : C.slate200 }}>{s}</button>
        ))}
      </div>
      {error && <div style={{ fontSize: 13, color: C.danger, padding: '10px 14px', background: C.dangerFaint, borderRadius: 8, border: `1px solid ${C.dangerBorder}` }}>{error}</div>}
      {result && (
        <div style={{ background: C.slate50, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.slate400 }}>{result.selector}._domainkey.{result.domain}</div>
          {!result.record
            ? <div style={{ fontSize: 13, color: C.warn, padding: '10px 14px', background: C.warnFaint, border: `1px solid ${C.warnBorder}`, borderRadius: 8 }}>No DKIM record found for selector <strong>{result.selector}</strong>. Try a different selector.</div>
            : <>
              <div style={{ fontSize: 12, color: C.success, padding: '10px 12px', background: C.successFaint, border: `1px solid ${C.successBorder}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={13} />DKIM found for selector <strong>{result.selector}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ background: C.white, borderLeft: `3px solid ${C.purple}`, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: C.purple, lineHeight: 1.7, wordBreak: 'break-all', borderRadius: '0 6px 6px 0', flex: 1 }}>{result.record}</div>
                <CopyBtn value={result.record} toast={toast} />
              </div>
            </>}
        </div>
      )}
    </div>
  )
}

// ── MX Tool ───────────────────────────────────────────────────────────────────
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
    } catch { setError('Lookup failed. Check the domain and try again.') }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <form onSubmit={check} style={{ display: 'flex', gap: 8 }}>
        <input style={{ flex: 1, height: 48, border: `1.5px solid ${C.slate200}`, borderRadius: 10, padding: '0 14px', fontSize: 14, fontFamily: 'monospace', color: C.text, background: C.white, outline: 'none' }} placeholder="yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)} required />
        <button type="submit" disabled={loading} style={{ height: 48, padding: '0 20px', background: C.orange, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Search size={14} />{loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <div style={{ fontSize: 13, color: C.danger, padding: '10px 14px', background: C.dangerFaint, borderRadius: 8, border: `1px solid ${C.dangerBorder}` }}>{error}</div>}
      {result && (
        <div style={{ background: C.slate50, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.records.length === 0
            ? <div style={{ fontSize: 13, color: C.danger, padding: '10px 14px', background: C.dangerFaint, border: `1px solid ${C.dangerBorder}`, borderRadius: 8 }}>No MX records found for <strong>{result.domain}</strong>.</div>
            : <>
              <div style={{ fontSize: 12, color: C.success, padding: '10px 12px', background: C.successFaint, border: `1px solid ${C.successBorder}`, borderRadius: 8 }}>{result.records.length} MX record{result.records.length > 1 ? 's' : ''} found for <strong>{result.domain}</strong></div>
              <div style={{ background: C.white, borderLeft: `3px solid ${C.orange}`, borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
                {result.records.map((r, i) => {
                  const parts = r.data?.split(' ') || []
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 12px', borderBottom: i < result.records.length - 1 ? `1px solid ${C.orangeFaint}` : 'none' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.orange, minWidth: 28 }}>{parts[0]}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.slate700 }}>{parts[1] || r.data}</span>
                    </div>
                  )
                })}
              </div>
            </>}
        </div>
      )}
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ onSignIn, onTools }) {
  return (
    <div style={{ background: C.navy, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, background: C.blue, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={16} color="white" />
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.white, letterSpacing: '-0.025em' }}>
          DNS<span style={{ color: C.blueLight }}>Monitor</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={onTools} style={{ fontSize: 13, color: C.slate600, padding: '7px 14px', borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Free tools</button>
        <button onClick={onSignIn} style={{ fontSize: 13, color: C.slate600, padding: '7px 14px', borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Sign in</button>
        <button onClick={onSignIn} style={{ fontSize: 13, fontWeight: 700, color: C.white, background: C.blue, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Get started free</button>
      </div>
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ onStart, onTools }) {
  const features = ['DMARC policy management', 'SPF, DKIM, BIMI monitoring', 'Multi-tenant organisation support', 'DNS health timeline', 'Real-time alerts & weekly digests']
  return (
    <div style={{ background: C.navy, padding: '80px 48px 96px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(26,107,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(26,107,255,0.12)', border: '1px solid rgba(26,107,255,0.25)', borderRadius: 99, padding: '5px 16px', marginBottom: 28 }}>
          <div style={{ width: 7, height: 7, background: C.blueLight, borderRadius: '50%' }} />
          <span style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600 }}>Free for Indian businesses — no credit card needed</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 900, color: C.white, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 22 }}>
          Stop email spoofing.<br />
          <span style={{ color: C.blue }}>Protect your domain.</span>
        </h1>
        <p style={{ fontSize: 17, color: C.slate600, lineHeight: 1.7, marginBottom: 40, maxWidth: 540, margin: '0 auto 40px' }}>
          DNSMonitor checks your DMARC, SPF, DKIM and MX records — tells you exactly what's broken and how to fix it.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 64, flexWrap: 'wrap' }}>
          <button onClick={onStart} style={{ fontSize: 15, fontWeight: 700, color: C.white, background: C.blue, padding: '14px 32px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
            <Shield size={16} />Start monitoring free
          </button>
          <button onClick={onTools} style={{ fontSize: 15, fontWeight: 600, color: C.slate400, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 32px', borderRadius: 10, cursor: 'pointer' }}>
            Check your domain →
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[['4 tools', 'DMARC · SPF · DKIM · MX'], ['100% free', 'No credit card ever'], ['∞ domains', 'Monitor unlimited']].map(([num, label]) => (
            <div key={num} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: '-0.04em' }}><span style={{ color: C.blue }}>{num.split(' ')[0]}</span> {num.split(' ')[1] || ''}</div>
              <div style={{ fontSize: 12, color: C.slate600, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────
function Features() {
  const items = [
    { icon: '🛡️', color: C.blueFaint, title: 'DMARC monitoring', desc: 'Track your p=none → p=reject journey. Get alerted when policy changes.' },
    { icon: '✉️', color: C.greenFaint, title: 'SPF validation', desc: 'Detect lookup limit violations before they break your email delivery.' },
    { icon: '🔑', color: C.purpleFaint, title: 'DKIM lookup', desc: 'Verify DKIM keys for any selector across all email providers.' },
    { icon: '⚡', color: '#fefce8', title: 'Fix suggestions', desc: 'Copy-paste DNS records with exact values to add at your registrar.' },
    { icon: '🔔', color: '#fef2f2', title: 'Email alerts', desc: 'Get notified when DNS records change or health scores drop.' },
    { icon: '👥', color: '#f0f9ff', title: 'Multi-tenant', desc: 'Manage multiple organisations and invite team members with roles.' },
  ]
  return (
    <div style={{ background: C.slate50, padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 28, height: 2, background: C.blue, borderRadius: 99 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Everything you need</span>
          <div style={{ width: 28, height: 2, background: C.blue, borderRadius: 99 }} />
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 900, color: C.text, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8 }}>Complete email security visibility</h2>
        <p style={{ fontSize: 15, color: C.slate500, textAlign: 'center', marginBottom: 52 }}>From DMARC policies to DKIM keys — monitor everything in one place.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: C.white, border: `1px solid ${C.slate200}`, borderRadius: 14, padding: 24 }}>
              <div style={{ width: 44, height: 44, background: item.color, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: C.slate500, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Free Tools section ────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'dmarc', label: 'DMARC Checker', color: C.blueText, bg: C.blueFaint, border: C.blueBorder, dot: C.blue, component: <DMARCTool /> },
  { id: 'spf',   label: 'SPF Lookup',    color: C.green,    bg: C.greenFaint, border: C.greenBorder, dot: C.green, component: <SPFTool /> },
  { id: 'dkim',  label: 'DKIM Lookup',   color: C.purple,   bg: C.purpleFaint, border: C.purpleBorder, dot: C.purple, component: <DKIMTool /> },
  { id: 'mx',    label: 'MX Lookup',     color: C.orange,   bg: C.orangeFaint, border: C.orangeBorder, dot: C.orange, component: <MXTool /> },
]

function FreeTools({ toolsRef }) {
  const [active, setActive] = useState('dmarc')
  const current = TOOLS.find(t => t.id === active)
  return (
    <div ref={toolsRef} style={{ background: C.white, padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 28, height: 2, background: C.blue, borderRadius: 99 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Free tools</span>
          <div style={{ width: 28, height: 2, background: C.blue, borderRadius: 99 }} />
        </div>
        <h2 style={{ fontSize: 36, fontWeight: 900, color: C.text, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8 }}>Check any domain instantly</h2>
        <p style={{ fontSize: 15, color: C.slate500, textAlign: 'center', marginBottom: 40 }}>No login required. Enter any domain and see its full email security status.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{ padding: '8px 18px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active === t.id ? t.border : C.slate200}`, background: active === t.id ? t.bg : C.white, color: active === t.id ? t.color : C.slate400, display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: active === t.id ? t.dot : C.slate300 }} />
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ border: `2px solid ${C.text}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg,#1a6bff,#7c3aed,#0891b2,#ea580c)' }} />
          <div style={{ padding: 28 }}>{current?.component}</div>
        </div>
      </div>
    </div>
  )
}

// ── Login section ─────────────────────────────────────────────────────────────
function LoginSection({ loginRef }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [focused, setFocused] = useState(false)

  async function handleSignIn(e) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await signIn(form.email, form.password)
    setLoading(false)
    if (error) { setError(error.message); return }
    toast('Welcome back!', 'success'); navigate('/dashboard')
  }

  async function handleSignUp(e) {
    e.preventDefault(); setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { data, error } = await signUp(form.email, form.password, form.name)
    setLoading(false)
    if (error) { setError(error.message); return }
    if (data.user && !data.session) setDone(true)
    else { toast('Account created!', 'success'); navigate('/onboarding') }
  }

  const feats = ['Daily automatic scans', 'Health score per domain', 'Fix suggestions with copy-paste records', 'Email alerts on DNS changes', 'Multi-domain, multi-team support']

  return (
    <div ref={loginRef} style={{ background: C.navy, padding: '80px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        {/* Left */}
        <div>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: C.white, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 14 }}>
            Ready to monitor<br /><span style={{ color: C.blueLight }}>your domains?</span>
          </h2>
          <p style={{ fontSize: 14, color: C.slate600, lineHeight: 1.7, marginBottom: 28 }}>
            Create a free account and get daily scans, health scores, fix suggestions and email alerts for all your domains.
          </p>
          {feats.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.blue, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: C.slate400 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Right — form card */}
        <div style={{ background: C.white, borderRadius: 20, padding: 32 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 56, height: 56, background: C.successFaint, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Mail size={24} color={C.success} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>Check your email</h3>
              <p style={{ fontSize: 13, color: C.slate500, lineHeight: 1.6, marginBottom: 20 }}>We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.</p>
              <button onClick={() => setDone(false)} style={{ fontSize: 13, color: C.blue, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>← Back to sign in</button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', background: C.slate100, borderRadius: 10, padding: 3, marginBottom: 24 }}>
                {[['signin', 'Sign in'], ['signup', 'Create account']].map(([id, label]) => (
                  <button key={id} onClick={() => { setTab(id); setError(''); setFocused(false) }} style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: tab === id ? C.white : 'transparent', color: tab === id ? C.text : C.slate400, transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {error && <div style={{ fontSize: 13, color: C.danger, padding: '10px 14px', background: C.dangerFaint, border: `1px solid ${C.dangerBorder}`, borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}

              <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {tab === 'signup' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.slate700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Full name</label>
                    <div style={{ position: 'relative' }}>
                      <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.slate300 }} />
                      <input style={{ width: '100%', height: 42, border: `1.5px solid ${C.slate200}`, borderRadius: 8, paddingLeft: 36, paddingRight: 12, fontSize: 14, color: C.text, background: C.white, outline: 'none', fontFamily: 'inherit' }} type="text" placeholder="Your name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoComplete="off" required />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.slate700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Email address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.slate300 }} />
                    <input style={{ width: '100%', height: 42, border: `1.5px solid ${C.slate200}`, borderRadius: 8, paddingLeft: 36, paddingRight: 12, fontSize: 14, color: C.text, background: C.white, outline: 'none', fontFamily: 'inherit' }} type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} autoComplete="username" readOnly={!focused} onFocus={() => setFocused(true)} required />
                  </div>
                </div>

                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.slate700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    {tab === 'signin' && <Link to="/forgot-password" style={{ fontSize: 11, color: C.blue, fontWeight: 600 }}>Forgot?</Link>}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.slate300 }} />
                    <input style={{ width: '100%', height: 42, border: `1.5px solid ${C.slate200}`, borderRadius: 8, paddingLeft: 36, paddingRight: 40, fontSize: 14, color: C.text, background: C.white, outline: 'none', fontFamily: 'inherit' }} type={showPwd ? 'text' : 'password'} placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} readOnly={!focused} onFocus={() => setFocused(true)} required minLength={tab === 'signup' ? 8 : undefined} />
                    <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.slate300, display: 'flex' }}>
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} style={{ width: '100%', height: 44, background: loading ? C.slate300 : `linear-gradient(135deg,${C.blue},${C.blue2})`, border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, color: C.white, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, fontFamily: 'inherit' }}>
                  {loading ? (tab === 'signin' ? 'Signing in…' : 'Creating account…') : <>{tab === 'signin' ? 'Sign in' : 'Create free account'}<ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <div style={{ background: '#030712', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: C.white }}>DNS<span style={{ color: C.blueLight }}>Monitor</span> <span style={{ color: C.slate700, fontWeight: 400, fontSize: 12 }}>by EasySecurity</span></span>
      <span style={{ fontSize: 12, color: C.slate700 }}>Free DMARC & DNS monitoring for Indian businesses</span>
      <a href="https://easysecurity.in" style={{ fontSize: 12, color: C.slate600, textDecoration: 'none' }}>easysecurity.in →</a>
    </div>
  )
}

// ── Main login page ───────────────────────────────────────────────────────────
export function LoginPage() {
  const toolsRef = { current: null }
  const loginRef = { current: null }

  function scrollTo(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Nav onSignIn={() => scrollTo(loginRef)} onTools={() => scrollTo(toolsRef)} />
      <Hero onStart={() => scrollTo(loginRef)} onTools={() => scrollTo(toolsRef)} />
      <Features />
      <FreeTools toolsRef={toolsRef} />
      <LoginSection loginRef={loginRef} />
      <Footer />
    </div>
  )
}

// ── Signup page — unchanged ───────────────────────────────────────────────────
function BrandPanel() {
  const features = ['DMARC policy management & monitoring', 'SPF, DKIM, BIMI record management', 'Multi-tenant organisation support', 'DNS health timeline & change history', 'Real-time alerts & weekly digests']
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-bg" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(26,107,255,0.4)' }}>
            <Shield size={26} color="white" />
          </div>
          <h2 style={{ color: 'white', fontSize: '1.625rem', marginBottom: '0.5rem' }}>DNS<span style={{ color: 'var(--brand-400)' }}>Monitor</span></h2>
          <p style={{ color: 'var(--neutral-400)', fontSize: '0.9375rem', lineHeight: 1.6 }}>Complete DMARC & DNS security management platform for EasySecurity.</p>
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
          <p style={{ color: 'var(--neutral-500)', fontSize: '0.8125rem' }}>Part of the <strong style={{ color: 'var(--neutral-300)' }}>EasySecurity</strong> platform</p>
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
    e.preventDefault(); setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { data, error } = await signUp(form.email, form.password, form.name)
    setLoading(false)
    if (error) { setError(error.message); return }
    if (data.user && !data.session) setDone(true)
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
          <p style={{ marginTop: '0.5rem', color: 'var(--neutral-500)' }}>We sent a confirmation link to <strong style={{ color: 'var(--neutral-700)' }}>{form.email}</strong>. Click it to activate your account.</p>
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
                <input className="input" style={{ paddingLeft: '2.25rem' }} type="text" placeholder="Your name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
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
