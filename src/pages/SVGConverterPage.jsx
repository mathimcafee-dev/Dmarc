import { useState, useRef, useCallback } from 'react'
import { Upload, Download, CheckCircle, AlertTriangle, XCircle, FileImage, Zap, Info, RefreshCw, Loader } from 'lucide-react'

const CHECKS = [
  { id: 'namespace',   label: 'SVG namespace correct',       desc: 'xmlns="http://www.w3.org/2000/svg"' },
  { id: 'version',     label: 'SVG Tiny 1.2 baseProfile',   desc: 'version="1.2" baseProfile="tiny-ps"' },
  { id: 'viewbox',     label: 'Square viewBox (1:1 ratio)',  desc: 'Width and height must be equal' },
  { id: 'title',       label: 'Has <title> element',         desc: 'Required for accessibility and VMC' },
  { id: 'no_script',   label: 'No scripts',                  desc: '<script> tags are forbidden' },
  { id: 'no_raster',   label: 'No embedded raster images',   desc: '<image> tags and base64 data not allowed' },
  { id: 'no_anim',     label: 'No animations',               desc: '<animate> and variants are forbidden' },
  { id: 'no_foreign',  label: 'No foreign objects',          desc: '<foreignObject> is forbidden' },
  { id: 'no_external', label: 'No external references',      desc: 'Remote xlink:href URLs forbidden' },
  { id: 'filesize',    label: 'File size ≤ 32KB',            desc: 'VMC logo must be under 32,768 bytes' },
]

function analyseSVG(svgText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return null

  const vb = svg.getAttribute('viewBox') || ''
  const parts = vb.trim().split(/[\s,]+/).map(Number)
  const isSquare = parts.length === 4 && parts[2] > 0 && parts[3] > 0 && parts[2] === parts[3]

  const results = {
    namespace:   svg.getAttribute('xmlns') === 'http://www.w3.org/2000/svg',
    version:     svg.getAttribute('version') === '1.2' && svg.getAttribute('baseProfile') === 'tiny-ps',
    viewbox:     isSquare,
    title:       !!doc.querySelector('title'),
    no_script:   !doc.querySelector('script'),
    no_raster:   !doc.querySelector('image') && !svgText.includes('base64'),
    no_anim:     !doc.querySelector('animate, animateTransform, animateMotion, animateColor, set'),
    no_foreign:  !doc.querySelector('foreignObject'),
    no_external: !svgText.match(/xlink:href\s*=\s*["']https?:/),
    filesize:    new Blob([svgText]).size <= 32768,
  }
  const passing = Object.values(results).filter(Boolean).length
  return { results, passing, total: CHECKS.length }
}

function CheckRow({ check, result }) {
  const ok = result === true
  const fail = result === false
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--neutral-100)' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? 'var(--success-100)' : fail ? 'var(--danger-100)' : 'var(--neutral-100)' }}>
        {ok   && <CheckCircle size={12} color="var(--success-600)" />}
        {fail && <XCircle     size={12} color="var(--danger-600)" />}
        {!ok && !fail && <Info size={12} color="var(--neutral-400)" />}
      </div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: ok ? 'var(--neutral-800)' : fail ? 'var(--danger-700)' : 'var(--neutral-500)' }}>{check.label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginTop: 1 }}>{check.desc}</div>
      </div>
    </div>
  )
}

function ScoreRing({ passing, total }) {
  const pct = passing / total
  const r = 36, circ = 2 * Math.PI * r
  const offset = circ - pct * circ
  const color = pct === 1 ? 'var(--success-500)' : pct >= 0.7 ? 'var(--warning-500)' : 'var(--danger-500)'
  return (
    <div style={{ position: 'relative', width: 88, height: 88, display: 'inline-flex' }}>
      <svg width={88} height={88}>
        <circle cx={44} cy={44} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={7} />
        <circle cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>{passing}</span>
        <span style={{ fontSize: '0.625rem', color: 'var(--neutral-400)', fontWeight: 500 }}>/ {total}</span>
      </div>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const ACCEPTED = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg']
const TYPE_LABEL = { 'image/svg+xml': 'SVG', 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/jpg': 'JPG' }

export function SVGConverterPage() {
  const [file, setFile] = useState(null)
  const [mimeType, setMimeType] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [converted, setConverted] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [color, setColor] = useState('#000000')
  const [dragging, setDragging] = useState(false)
  const [converting, setConverting] = useState(false)
  const [step, setStep] = useState('upload')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const fileRef = useRef()

  function handleFile(f) {
    if (!f) return
    const mt = f.type || (f.name.endsWith('.svg') ? 'image/svg+xml' : '')
    if (!ACCEPTED.includes(mt)) {
      setError('Please upload a PNG, JPG, or SVG file')
      return
    }
    setError('')
    setFile(f)
    setMimeType(mt)
    setConverted('')
    setAnalysis(null)

    // Preview
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)

    // If SVG, run local analysis immediately
    if (mt === 'image/svg+xml') {
      const reader = new FileReader()
      reader.onload = e => setAnalysis(analyseSVG(e.target.result))
      reader.readAsText(f)
    }
    setStep('ready')
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  async function handleConvert() {
    if (!file) return
    setConverting(true); setError('')
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/svg-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: base64,
          mimeType,
          companyName: companyName || file.name.replace(/\.[^.]+$/, ''),
          color,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setConverted(data.svg)
      setAnalysis(analyseSVG(data.svg))
      setStep('done')
    } catch (err) {
      setError(err.message || 'Conversion failed. Please try again.')
    }
    setConverting(false)
  }

  function handleDownload() {
    const blob = new Blob([converted], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${companyName || 'logo'}-bimi-vmc.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    setFile(null); setMimeType(''); setAnalysis(null)
    setConverted(''); setStep('upload'); setError('')
    setPreviewUrl(''); setCompanyName(''); setColor('#000000')
  }

  const isSVG = mimeType === 'image/svg+xml'
  const isBitmap = mimeType === 'image/png' || mimeType.includes('jpeg') || mimeType.includes('jpg')

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>SVG VMC Converter</h1>
          <p>Upload PNG, JPG, or SVG — get a BIMI/VMC compliant SVG ready for Gmail and Apple Mail.</p>
        </div>
        {step !== 'upload' && (
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RefreshCw size={13} /><span>Start over</span>
          </button>
        )}
      </div>

      <div className="alert-banner info" style={{ marginBottom: '1.5rem' }}>
        <Info size={15} />
        <span>Supports PNG, JPG and SVG. Bitmaps are automatically traced into clean vector paths. Output is SVG Tiny 1.2 P/S — fully VMC compliant.</span>
      </div>

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={15} /><span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: step === 'upload' ? '1fr' : '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Upload zone */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? 'var(--brand-400)' : 'var(--neutral-200)'}`, borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--brand-50)' : 'var(--neutral-50)', transition: 'all 0.15s' }}
            >
              <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <Upload size={26} color="var(--brand-500)" />
              </div>
              <div style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 6 }}>Drop your logo here</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: 20 }}>or click to browse</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'PNG', color: 'var(--brand-600)', bg: 'var(--brand-50)', border: 'var(--brand-200)' },
                  { label: 'JPG', color: 'var(--success-600)', bg: 'var(--success-50)', border: 'var(--success-200)' },
                  { label: 'SVG', color: 'var(--warning-600)', bg: 'var(--warning-50)', border: 'var(--warning-200)' },
                ].map(t => (
                  <span key={t.label} style={{ fontSize: '0.8125rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: t.bg, color: t.color, border: `1.5px solid ${t.border}` }}>{t.label}</span>
                ))}
              </div>
            </div>
          )}

          {/* File info */}
          {step !== 'upload' && (
            <div className="card">
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileImage size={20} color="var(--brand-500)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{file?.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: 'var(--brand-50)', color: 'var(--brand-600)' }}>{TYPE_LABEL[mimeType]}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>{(file?.size / 1024).toFixed(1)} KB</span>
                      {isBitmap && <span style={{ fontSize: '0.75rem', color: 'var(--warning-600)', fontWeight: 500 }}>→ will be traced to vector</span>}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Company / brand name</label>
                  <input className="input" placeholder="e.g. EasySecurity" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  <span className="form-hint">Used as the &lt;title&gt; element — required for VMC.</span>
                </div>

                {isBitmap && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Logo colour</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="color" value={color} onChange={e => setColor(e.target.value)}
                        style={{ width: 40, height: 36, border: '1px solid var(--neutral-200)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'white' }} />
                      <input className="input" style={{ fontFamily: 'var(--font-mono)', flex: 1 }} value={color} onChange={e => setColor(e.target.value)} placeholder="#000000" />
                    </div>
                    <span className="form-hint">Pick your brand colour — applied to the traced vector paths.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {step !== 'upload' && (
            <div className="card">
              <div className="card-header">
                <h4 style={{ margin: 0 }}>{step === 'done' ? 'Converted SVG preview' : 'Original preview'}</h4>
              </div>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '2rem', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  {step === 'done' && <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginBottom: 8 }}>Original</div>}
                  <div style={{ width: 120, height: 120, border: '1px solid var(--neutral-150)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--neutral-50)', overflow: 'hidden' }}>
                    <img src={previewUrl} alt="Original" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                </div>
                {step === 'done' && converted && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginBottom: 8 }}>VMC ready</div>
                    <div style={{ width: 120, height: 120, border: '1.5px solid var(--success-300)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', overflow: 'hidden' }}>
                      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(converted)}`} alt="Converted" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}
              </div>
              {step === 'done' && converted && (
                <div className="card-footer" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>
                    {(new Blob([converted]).size / 1024).toFixed(1)} KB — {new Blob([converted]).size <= 32768 ? '✓ under 32KB' : '⚠ over 32KB'}
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                    <Download size={13} /><span>Download VMC SVG</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Convert button */}
          {step === 'ready' && (
            <button className={`btn btn-primary btn-lg ${converting ? 'btn-loading' : ''}`} onClick={handleConvert} disabled={converting} style={{ width: '100%' }}>
              {!converting && <><Zap size={16} /><span>{isBitmap ? `Trace & convert ${TYPE_LABEL[mimeType]} to VMC SVG` : 'Convert to VMC compliant SVG'}</span></>}
              {converting && <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /><span>Converting…</span><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>}
            </button>
          )}

          {step === 'done' && (
            <button className="btn btn-primary btn-lg" onClick={handleDownload} style={{ width: '100%' }}>
              <Download size={16} /><span>Download VMC compliant SVG</span>
            </button>
          )}
        </div>

        {/* RIGHT — Analysis */}
        {step !== 'upload' && analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                  <ScoreRing passing={analysis.passing} total={analysis.total} />
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--neutral-800)' }}>
                      {analysis.passing === analysis.total ? '✓ Fully VMC compliant' : `${analysis.passing} / ${analysis.total} checks passing`}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)', marginTop: 3 }}>
                      {step === 'done' ? 'After conversion' : isBitmap ? 'Will be fixed on conversion' : 'Before conversion'}
                    </div>
                    {step === 'ready' && analysis.passing < analysis.total && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--brand-600)', marginTop: 4, fontWeight: 500 }}>
                        {analysis.total - analysis.passing} issue{analysis.total - analysis.passing > 1 ? 's' : ''} will be fixed automatically
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="card-body" style={{ padding: '0 1.5rem' }}>
                {CHECKS.map(check => (
                  <CheckRow key={check.id} check={check} result={isBitmap && step === 'ready' ? undefined : analysis.results[check.id]} />
                ))}
              </div>
            </div>

            {isBitmap && step === 'ready' && (
              <div className="alert-banner warning">
                <Zap size={15} />
                <span>PNG/JPG files are automatically traced into clean vector paths using potrace. The converter will apply your chosen colour and make the output fully VMC compliant.</span>
              </div>
            )}

            {step === 'done' && analysis.passing === analysis.total && (
              <div className="alert-banner success">
                <CheckCircle size={15} />
                <span>Your SVG is fully VMC compliant. Download it and host it on HTTPS for your BIMI record.</span>
              </div>
            )}

            {step === 'done' && (
              <div className="card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-800)' }}>Next steps:</div>
                  {[
                    'Host the SVG at a public HTTPS URL — e.g. https://yourdomain.com/logo.svg',
                    'Add BIMI DNS: default._bimi TXT "v=BIMI1; l=https://yourdomain.com/logo.svg"',
                    'For Gmail (blue checkmark), add VMC: a=https://yourdomain.com/vmc.pem',
                    'VMC requires a registered trademark — apply via DigiCert or Entrust',
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--brand-100)', color: 'var(--brand-600)', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-600)', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
