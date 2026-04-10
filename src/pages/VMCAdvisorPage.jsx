import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, Shield, Zap, Loader, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'

function ScoreGauge({ pct, allPass }) {
  const color = allPass ? '#16a34a' : pct > 60 ? '#d97706' : '#dc2626'
  const r = 30, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
      <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={8} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${(pct/100)*circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 4px ${color}66)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{pct}%</span>
      </div>
    </div>
  )
}

function CheckRow({ c }) {
  const C = { pass: '#16a34a', fail: '#dc2626', warn: '#d97706' }
  const state = c.pass ? 'pass' : c.required ? 'fail' : 'warn'
  const bg  = { pass: '#f0fdf4', fail: '#fff5f5', warn: '#fffbeb' }
  const bdr = { pass: '#bbf7d0', fail: '#fecaca', warn: '#fde047' }
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${bdr[state]}`, background: bg[state], marginBottom: 5 }}>
      <div style={{ display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'flex-start' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: state === 'pass' ? '#dcfce7' : state === 'fail' ? '#fee2e2' : '#fef3c7' }}>
          {state === 'pass' ? <CheckCircle size={12} color={C.pass} /> : state === 'fail' ? <XCircle size={12} color={C.fail} /> : <AlertTriangle size={12} color={C.warn} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)' }}>{c.label}</span>
            {c.required && !c.pass && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: '#fee2e2', color: '#dc2626', textTransform: 'uppercase' }}>Required</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.5 }}>{c.desc}</div>
          {!c.pass && c.fix && (
            <div style={{ marginTop: 7, padding: '7px 10px', background: 'rgba(255,255,255,0.7)', borderRadius: 6, fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.5 }}>
              💡 {c.fix.note}
              {c.fix.copy && (
                <div style={{ marginTop: 5, background: '#0e1624', borderRadius: 6, padding: '7px 10px', display: 'flex', gap: 8 }}>
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
  )
}

export function VMCAdvisorPage() {
  const { currentOrg } = useOrg()
  const { domains } = useDomains()
  const [selectedId, setSelectedId] = useState('')
  const [data, setData] = useState({ dmarc: null, spf: null, dkim: [], bimi: null })
  const [loading, setLoading] = useState(false)
  const [svgValid, setSvgValid] = useState(null)
  const [svgError, setSvgError] = useState('')
  const [converting, setConverting] = useState(false)
  const [converted, setConverted] = useState(null)

  const domain = domains.find(d => d.id === selectedId)

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setSvgValid(null); setConverted(null)
    Promise.all([
      supabase.from('dmarc_records').select('*').eq('domain_id', selectedId).eq('is_current', true).single(),
      supabase.from('spf_records').select('*').eq('domain_id', selectedId).eq('is_current', true).single(),
      supabase.from('dkim_records').select('*').eq('domain_id', selectedId).eq('is_current', true),
      supabase.from('bimi_records').select('*').eq('domain_id', selectedId).eq('is_current', true).single(),
    ]).then(([dm, sp, dk, bi]) => {
      setData({ dmarc: dm.data, spf: sp.data, dkim: dk.data || [], bimi: bi.data })
      setLoading(false)
      if (bi.data?.logo_url?.startsWith('https://')) checkSVG(bi.data.logo_url)
    })
  }, [selectedId])

  async function checkSVG(url) {
    setSvgValid(null)
    try {
      const r = await fetch(`/api/validate-svg?url=${encodeURIComponent(url)}`)
      const d = await r.json()
      setSvgValid(d.valid); setSvgError(d.error || '')
    } catch { setSvgValid(false); setSvgError('Could not fetch SVG') }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    setConverting(true); setConverted(null)
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })
      const res = await fetch('/api/svg-convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: base64, mimeType: file.type }) })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setConverted(d)
    } catch (err) { alert(err.message) }
    setConverting(false); e.target.value = ''
  }

  const dn       = domain?.domain || ''
  const policy   = data.dmarc?.policy
  const hasSPF   = !!data.spf?.is_valid
  const hasDKIM  = data.dkim.length > 0
  const hasBIMI  = !!data.bimi
  const logoUrl  = data.bimi?.logo_url || ''
  const isHTTPS  = logoUrl.startsWith('https://')
  const hasVMC   = !!data.bimi?.vmc_url

  const checks = [
    { label: 'DMARC p=reject enforced', pass: policy === 'reject', required: true, desc: policy === 'reject' ? 'p=reject ✓' : `Current: p=${policy || 'none'} — VMC issuers require p=reject`, fix: policy !== 'reject' ? { note: 'Change your DMARC policy to p=reject. Use the Enforcement Journey in the domain detail DMARC tab.' } : null },
    { label: 'Valid SPF record', pass: hasSPF, required: true, desc: hasSPF ? 'SPF valid ✓' : 'No valid SPF record', fix: !hasSPF ? { note: 'Add a v=spf1 TXT record to your DNS.' } : null },
    { label: 'DKIM signing active', pass: hasDKIM, required: true, desc: hasDKIM ? `${data.dkim.length} selector(s) found ✓` : 'No DKIM selectors found', fix: !hasDKIM ? { note: 'Enable DKIM in your email provider (Google Workspace, Microsoft 365, etc).' } : null },
    { label: 'BIMI DNS record exists', pass: hasBIMI, required: true, desc: hasBIMI ? `default._bimi.${dn} ✓` : `No BIMI TXT record found`, fix: !hasBIMI ? { note: 'Add a BIMI TXT record to your DNS.', copy: `default._bimi.${dn}  IN TXT  "v=BIMI1; l=https://${dn}/bimi-logo.svg;"` } : null },
    { label: 'Logo hosted on HTTPS', pass: hasBIMI && isHTTPS, required: true, desc: !hasBIMI ? 'Requires BIMI record first' : isHTTPS ? 'HTTPS ✓' : 'Logo URL must use HTTPS', fix: hasBIMI && !isHTTPS ? { note: 'Update your BIMI record logo URL to use https://.' } : null },
    { label: 'SVG is VMC-compliant (Tiny 1.2)', pass: svgValid === true, required: true, desc: svgValid === null ? (logoUrl ? 'Checking…' : 'Requires logo URL') : svgValid ? 'SVG passes VMC compliance ✓' : `Issue: ${svgError}`, fix: svgValid === false ? { note: 'Upload your logo below to auto-convert to VMC-compliant SVG.' } : null },
    { label: 'Square viewBox (1:1 ratio)', pass: svgValid === true, required: true, desc: 'SVG must have equal width and height', fix: svgValid === false ? { note: 'Ensure viewBox has equal width and height e.g. viewBox="0 0 100 100".' } : null },
    { label: 'File size under 32KB', pass: svgValid === true, required: false, desc: 'Recommended under 32KB for broad client support', fix: null },
    { label: 'Trademark registered', pass: false, required: true, desc: 'All VMC issuers require trademark registration proof', fix: { note: 'Apply via IP India (https://ipindia.gov.in) or USPTO. Required before any VMC issuer will proceed.', href: 'https://ipindia.gov.in' } },
    { label: 'VMC certificate in BIMI record (authority=)', pass: hasVMC, required: false, desc: hasVMC ? 'VMC authority= field found ✓' : 'Required for Gmail blue checkmark', fix: !hasVMC ? { note: 'After receiving VMC from an accredited issuer, host the .pem and add authority= to your BIMI record.', copy: `default._bimi.${dn}  IN TXT  "v=BIMI1; l=https://${dn}/bimi-logo.svg; a=https://${dn}/bimi.pem;"` } : null },
  ]

  const required  = checks.filter(c => c.required)
  const passCount = required.filter(c => c.pass).length
  const allPass   = passCount === required.length
  const pct       = selectedId ? Math.round((passCount / required.length) * 100) : 0

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Trusted VMC Advisor</h1>
          <p>Check your domain's readiness for a Verified Mark Certificate — show your logo in Gmail & Apple Mail.</p>
        </div>
      </div>

      {/* Domain selector */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Globe size={16} color="var(--neutral-400)" />
        <select className="input select" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ flex: 1, maxWidth: 360 }}>
          <option value="">Select a domain to analyse…</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
        </select>
        {loading && <Loader size={16} color="var(--neutral-400)" style={{ animation: 'spin 1s linear infinite' }} />}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {!selectedId ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Shield size={28} /></div>
            <p className="empty-title">Select a domain to begin</p>
            <p className="empty-desc">The VMC Advisor will check all requirements for a Verified Mark Certificate and guide you through each step.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', alignItems: 'start' }}>

          {/* Left — score + logo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <ScoreGauge pct={pct} allPass={allPass} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)', marginBottom: 4 }}>
                    {allPass ? '🏆 VMC Ready' : `${passCount}/${required.length} checks passing`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                    {allPass ? 'All requirements met. Apply for your VMC certificate.' : 'Complete the checklist to qualify for a Verified Mark Certificate.'}
                  </div>
                </div>
                {allPass && (
                  <a href="https://www.digicert.com/tls-ssl/verified-mark-certificates" target="_blank" rel="noreferrer"
                    style={{ width: '100%', padding: '8px', background: '#1a6bff', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                    Apply for VMC →
                  </a>
                )}
                {logoUrl && <img src={logoUrl} alt="BIMI Logo" style={{ width: 60, height: 60, borderRadius: 8, border: '1px solid var(--neutral-150)', objectFit: 'contain', padding: 6 }} onError={e => e.target.style.display='none'} />}
              </div>
            </div>

            {/* Logo converter */}
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Logo → VMC SVG</h4></div>
              <div className="card-body">
                <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 10, lineHeight: 1.5 }}>Upload PNG, JPG or SVG — we convert to VMC-compliant SVG Tiny 1.2.</div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px', background: converting ? 'var(--neutral-100)' : '#1a6bff', color: converting ? 'var(--neutral-500)' : '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: converting ? 'not-allowed' : 'pointer', width: '100%' }}>
                  {converting ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />Converting…</> : <><Zap size={13} />Upload & Convert</>}
                  <input type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleUpload} style={{ display: 'none' }} disabled={converting} />
                </label>
                {converted && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>✓ Ready for BIMI</div>
                    <ol style={{ fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.8, paddingLeft: 14 }}>
                      <li>Download SVG below</li>
                      <li>Host at <code style={{ fontFamily: 'monospace', fontSize: 10 }}>https://{dn}/bimi-logo.svg</code></li>
                      <li>Update BIMI DNS record</li>
                      <li>Apply for VMC</li>
                    </ol>
                    <a href={URL.createObjectURL(new Blob([converted.svg], {type:'image/svg+xml'}))} download={`${dn}-bimi.svg`}
                      style={{ display: 'block', marginTop: 8, padding: '6px', background: '#16a34a', color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
                      Download SVG
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right — checklist */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0 }}>VMC Readiness Checklist</h4>
              <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{passCount}/{required.length} required</span>
            </div>
            <div className="card-body" style={{ padding: '0.75rem 1.25rem' }}>
              {checks.map((c, i) => <CheckRow key={i} c={c} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
