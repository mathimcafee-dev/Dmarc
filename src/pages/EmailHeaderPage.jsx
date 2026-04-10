import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Clock, Server, Shield } from 'lucide-react'

function parseHeaders(raw) {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const unfolded = lines.replace(/\n[ \t]+/g, ' ')
  const headers = {}
  unfolded.split('\n').forEach(line => {
    const idx = line.indexOf(':')
    if (idx < 1) return
    const key = line.slice(0, idx).trim().toLowerCase()
    const val = line.slice(idx + 1).trim()
    if (!headers[key]) headers[key] = []
    headers[key].push(val)
  })
  return headers
}

function parseAuthResults(str) {
  if (!str) return {}
  const spf  = str.match(/spf=(\w+)/i)?.[1]?.toLowerCase()
  const dkim = str.match(/dkim=(\w+)/i)?.[1]?.toLowerCase()
  const dmarc= str.match(/dmarc=(\w+)/i)?.[1]?.toLowerCase()
  return { spf, dkim, dmarc }
}

function parseReceived(lines) {
  return (lines || []).map((line, i) => {
    const from  = line.match(/from\s+([^\s]+)/i)?.[1] || ''
    const by    = line.match(/by\s+([^\s]+)/i)?.[1] || ''
    const ip    = line.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/)?.[1] || ''
    const dateM = line.match(/;\s*(.+)$/)
    const date  = dateM ? new Date(dateM[1].trim()) : null
    return { from, by, ip, date, raw: line }
  }).filter(r => r.from || r.by)
}

function computeDelays(hops) {
  return hops.map((h, i) => {
    if (i === 0 || !h.date || !hops[i-1].date) return { ...h, delay: null }
    const diff = Math.round((h.date - hops[i-1].date) / 1000)
    return { ...h, delay: diff }
  })
}

function StatusPill({ val }) {
  if (!val) return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--neutral-100)', color: 'var(--neutral-400)' }}>—</span>
  const ok = val === 'pass'
  const warn = ['softfail', 'neutral', 'temperror', 'permerror'].includes(val)
  const bg = ok ? 'var(--success-100)' : warn ? 'var(--warning-100)' : 'var(--danger-100)'
  const color = ok ? 'var(--success-700)' : warn ? 'var(--warning-700)' : 'var(--danger-700)'
  const Icon = ok ? CheckCircle : warn ? AlertTriangle : XCircle
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: bg, color, textTransform: 'uppercase' }}>
      <Icon size={11} />{val}
    </span>
  )
}

function Row({ label, value, mono }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--neutral-100)', alignItems: 'flex-start' }}>
      <div style={{ width: 160, fontSize: 12, fontWeight: 600, color: 'var(--neutral-500)', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--neutral-800)', fontFamily: mono ? 'var(--font-mono)' : undefined, wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

const SAMPLE = `Delivered-To: you@example.com
Received: from mail.sender.com ([203.0.113.42])
        by mx.example.com with ESMTPS; Mon, 7 Apr 2025 09:41:33 +0000
Received: from smtp.sender.com ([203.0.113.1])
        by mail.sender.com with ESMTP; Mon, 7 Apr 2025 09:41:28 +0000
Authentication-Results: mx.example.com;
       dkim=pass header.d=sender.com;
       spf=pass smtp.mailfrom=sender.com;
       dmarc=pass (p=reject) header.from=sender.com
From: Alice <alice@sender.com>
To: you@example.com
Subject: Hello from sender.com
Message-ID: <abc123@sender.com>
Date: Mon, 7 Apr 2025 09:41:20 +0000
X-Spam-Status: No, score=-2.1`

export function EmailHeaderPage() {
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState(null)
  const [showRaw, setShowRaw] = useState(false)

  function analyse() {
    if (!raw.trim()) return
    const h = parseHeaders(raw)
    const auth = parseAuthResults((h['authentication-results'] || []).join(' '))
    const hops = computeDelays(parseReceived(h['received']))
    const spamScore = (h['x-spam-score'] || h['x-spam-status'] || []).join(' ')
    const verdict = auth.dmarc === 'pass' && auth.spf === 'pass' && auth.dkim === 'pass'
      ? 'pass' : (auth.dmarc || auth.spf || auth.dkim) ? 'warn' : 'unknown'
    setResult({ h, auth, hops, spamScore, verdict })
    setShowRaw(false)
  }

  function loadSample() { setRaw(SAMPLE); setResult(null) }
  function reset() { setRaw(''); setResult(null) }

  const verdictConfig = {
    pass:    { label: 'Looks legitimate', color: 'var(--success-600)', bg: 'var(--success-50)', Icon: CheckCircle },
    warn:    { label: 'Partial authentication', color: 'var(--warning-600)', bg: 'var(--warning-50)', Icon: AlertTriangle },
    unknown: { label: 'Unable to determine', color: 'var(--neutral-500)', bg: 'var(--neutral-50)', Icon: Shield },
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Email Header Analyser</h1>
          <p>Paste raw email headers to check authentication, delivery path and spam signals.</p>
        </div>
      </div>

      {/* Input */}
      {!result && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)' }}>Paste email headers</label>
              <button className="btn btn-secondary btn-sm" onClick={loadSample}>Load sample</button>
            </div>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={'Received: from mail.example.com...\nAuthentication-Results: ...\nFrom: sender@example.com\n...'}
              style={{ width: '100%', minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 12, padding: 12, border: '1.5px solid var(--neutral-200)', borderRadius: 8, resize: 'vertical', color: 'var(--neutral-800)', background: 'var(--neutral-50)', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--neutral-400)' }}>In Gmail: open email → ⋮ → Show original. In Outlook: File → Properties → Internet headers.</div>
              <button className="btn btn-primary" onClick={analyse} disabled={!raw.trim()}>Analyse headers →</button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Verdict */}
          {(() => { const v = verdictConfig[result.verdict]; return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: v.bg, borderRadius: 'var(--radius-lg)', border: `1px solid ${v.color}22`, marginBottom: '1.25rem' }}>
              <v.Icon size={22} color={v.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: v.color }}>{v.label}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>
                  SPF <StatusPill val={result.auth.spf} /> &nbsp; DKIM <StatusPill val={result.auth.dkim} /> &nbsp; DMARC <StatusPill val={result.auth.dmarc} />
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={reset}>Analyse another</button>
            </div>
          )})()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
            {/* Left col */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Key fields */}
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Message details</h4></div>
                <div className="card-body" style={{ padding: '4px 18px 12px' }}>
                  <Row label="From"       value={(result.h['from']        || [])[0]} />
                  <Row label="To"         value={(result.h['to']          || [])[0]} />
                  <Row label="Subject"    value={(result.h['subject']     || [])[0]} />
                  <Row label="Date"       value={(result.h['date']        || [])[0]} />
                  <Row label="Message-ID" value={(result.h['message-id']  || [])[0]} mono />
                  <Row label="Reply-To"   value={(result.h['reply-to']    || [])[0]} />
                </div>
              </div>

              {/* Auth detail */}
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Authentication</h4></div>
                <div className="card-body" style={{ padding: '4px 18px 12px' }}>
                  {(result.h['authentication-results'] || []).map((v, i) => (
                    <div key={i} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)', padding: '6px 0', borderBottom: '1px solid var(--neutral-100)', lineHeight: 1.6 }}>{v}</div>
                  ))}
                  {!(result.h['authentication-results']?.length) && (
                    <div style={{ fontSize: 13, color: 'var(--neutral-400)', padding: '8px 0' }}>No authentication results found in headers.</div>
                  )}
                  {result.spamScore && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--neutral-600)' }}>
                      <span style={{ fontWeight: 600 }}>Spam signal: </span>{result.spamScore}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right col — delivery hops */}
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Delivery path ({result.hops.length} hop{result.hops.length !== 1 ? 's' : ''})</h4></div>
              <div className="card-body" style={{ padding: '8px 18px 12px' }}>
                {result.hops.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--neutral-400)' }}>No Received headers found.</div>
                )}
                {result.hops.map((hop, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, position: 'relative' }}>
                    {i < result.hops.length - 1 && (
                      <div style={{ position: 'absolute', left: 11, top: 22, width: 1, height: 'calc(100% - 8px)', background: 'var(--neutral-150)' }} />
                    )}
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                      <Server size={11} color="var(--brand-600)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', wordBreak: 'break-all' }}>{hop.by || hop.from}</div>
                      {hop.from && hop.by && <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 1 }}>from {hop.from}</div>}
                      {hop.ip && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neutral-400)', marginTop: 1 }}>{hop.ip}</div>}
                      {hop.date && <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} />{hop.date.toUTCString()}
                        {hop.delay !== null && hop.delay !== undefined && (
                          <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: hop.delay > 30 ? 'var(--warning-100)' : 'var(--neutral-100)', color: hop.delay > 30 ? 'var(--warning-700)' : 'var(--neutral-500)' }}>
                            +{hop.delay}s
                          </span>
                        )}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Raw toggle */}
          <div style={{ marginTop: '1.25rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowRaw(p => !p)} style={{ marginBottom: 8 }}>
              {showRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>{showRaw ? 'Hide' : 'Show'} all parsed headers</span>
            </button>
            {showRaw && (
              <div className="card">
                <div className="card-body" style={{ padding: '10px 16px' }}>
                  {Object.entries(result.h).map(([k, vals]) => (
                    vals.map((v, i) => (
                      <div key={k+i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--neutral-100)', fontSize: 12 }}>
                        <div style={{ width: 180, fontWeight: 600, color: 'var(--neutral-500)', flexShrink: 0, textTransform: 'lowercase' }}>{k}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', wordBreak: 'break-all', lineHeight: 1.5 }}>{v}</div>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
