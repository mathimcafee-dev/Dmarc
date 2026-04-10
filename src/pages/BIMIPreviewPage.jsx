import { useState, useRef, useCallback } from 'react'
import { Upload, RefreshCw, CheckCircle, AlertTriangle, Info, Shield } from 'lucide-react'

const CLIENTS = [
  {
    id: 'gmail_inbox',
    name: 'Gmail',
    view: 'Inbox view',
    dot: '#ea4335',
    vmc: true,
    vmcNote: 'VMC or CMC required',
    checkmark: true,
    checkmarkColor: '#1a73e8',
    checkmarkNote: 'Blue checkmark with VMC',
    shape: 'circle',
    theme: 'light',
    supported: true,
  },
  {
    id: 'gmail_open',
    name: 'Gmail',
    view: 'Open message',
    dot: '#ea4335',
    vmc: true,
    vmcNote: 'VMC or CMC required',
    checkmark: true,
    checkmarkColor: '#1a73e8',
    checkmarkNote: 'Blue checkmark with VMC',
    shape: 'circle',
    theme: 'light',
    supported: true,
  },
  {
    id: 'gmail_mobile',
    name: 'Gmail Mobile',
    view: 'iOS / Android',
    dot: '#ea4335',
    vmc: true,
    vmcNote: 'VMC or CMC required',
    checkmark: true,
    checkmarkColor: '#1a73e8',
    shape: 'circle',
    theme: 'dark',
    supported: true,
  },
  {
    id: 'apple_mail',
    name: 'Apple Mail',
    view: 'macOS / iOS',
    dot: '#555',
    vmc: true,
    vmcNote: 'VMC or CMC required',
    checkmark: false,
    shape: 'circle',
    theme: 'dark',
    supported: true,
  },
  {
    id: 'yahoo_inbox',
    name: 'Yahoo Mail',
    view: 'Inbox view',
    dot: '#6001d2',
    vmc: false,
    vmcNote: 'No VMC needed',
    checkmark: true,
    checkmarkColor: '#5f2d82',
    checkmarkNote: 'Purple checkmark with VMC',
    shape: 'circle',
    theme: 'light',
    supported: true,
  },
  {
    id: 'yahoo_mobile',
    name: 'Yahoo Mail Mobile',
    view: 'iOS / Android',
    dot: '#6001d2',
    vmc: false,
    vmcNote: 'No VMC needed',
    checkmark: false,
    shape: 'circle',
    theme: 'dark',
    supported: true,
  },
  {
    id: 'aol',
    name: 'AOL Mail',
    view: 'Inbox view',
    dot: '#ff0b00',
    vmc: false,
    vmcNote: 'No VMC needed',
    checkmark: false,
    shape: 'circle',
    theme: 'light',
    supported: true,
  },
  {
    id: 'fastmail',
    name: 'Fastmail',
    view: 'Inbox view',
    dot: '#1a8fe3',
    vmc: false,
    vmcNote: 'No VMC needed',
    checkmark: false,
    shape: 'circle',
    theme: 'light',
    supported: true,
  },
  {
    id: 'laposte',
    name: 'La Poste',
    view: 'Inbox view',
    dot: '#ffcd00',
    vmc: false,
    vmcNote: 'No VMC needed',
    checkmark: false,
    shape: 'circle',
    theme: 'light',
    supported: true,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    view: 'Inbox view',
    dot: '#0078d4',
    vmc: false,
    vmcNote: 'Not supported',
    checkmark: false,
    shape: 'none',
    theme: 'light',
    supported: false,
  },
]

function Avatar({ logoUrl, shape, size = 36, fallback = 'ES', theme = 'light' }) {
  const radius = shape === 'circle' ? '50%' : shape === 'squircle' ? '30%' : '4px'
  if (!logoUrl || shape === 'none') {
    const bg = theme === 'dark' ? '#3a3a3c' : '#e2e8f0'
    const color = theme === 'dark' ? '#8e8e93' : '#64748b'
    return (
      <div style={{ width: size, height: size, borderRadius: radius, background: bg, color, fontSize: size * 0.35, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {fallback}
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0, border: theme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.1)' }}>
      <img src={logoUrl} alt="BIMI logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

function Checkmark({ color, size = 14 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

function EmailRow({ children, highlight = false, bg = 'transparent' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: highlight ? bg : 'transparent', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  )
}

function DarkEmailRow({ children, highlight = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: highlight ? 'rgba(255,255,255,0.06)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

function TextLines({ theme = 'light', widths = [60, 90, 75] }) {
  const bg = theme === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.1)'
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {widths.map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 8 : 6, background: bg, borderRadius: 3, width: `${w}%`, marginBottom: i < widths.length - 1 ? 4 : 0 }} />
      ))}
    </div>
  )
}

// ── Individual client mockups ─────────────────────────────────────────────────
function GmailInbox({ logoUrl, hasCheckmark }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <EmailRow highlight bg="#f0f4ff">
        <Avatar logoUrl={logoUrl} shape="circle" size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1f2937' }}>EasySecurity</span>
            {hasCheckmark && logoUrl && <Checkmark color="#1a73e8" size={13} />}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>DNS health report — your score improved</div>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>9:41</span>
      </EmailRow>
      <EmailRow>
        <Avatar logoUrl={null} shape="circle" size={36} fallback="A" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Acme Corp</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Weekly newsletter · Inbox</div>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>8:12</span>
      </EmailRow>
    </div>
  )
}

function GmailOpen({ logoUrl, hasCheckmark }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar logoUrl={logoUrl} shape="circle" size={42} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>EasySecurity</span>
            {hasCheckmark && logoUrl && <Checkmark color="#1a73e8" size={14} />}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>noreply@easysecurity.in</div>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[60, 95, 80, 70].map((w, i) => (
          <div key={i} style={{ height: 6, background: '#f1f5f9', borderRadius: 3, width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

function GmailMobile({ logoUrl, hasCheckmark }) {
  return (
    <div style={{ background: '#1c1c1e', borderRadius: 10, padding: 6, maxWidth: 260, margin: '0 auto' }}>
      <DarkEmailRow highlight>
        <Avatar logoUrl={logoUrl} shape="circle" size={36} theme="dark" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>EasySecurity</span>
            {hasCheckmark && logoUrl && <Checkmark color="#1a73e8" size={12} />}
          </div>
          <div style={{ fontSize: 10, color: '#8e8e93' }}>DNS report ready</div>
        </div>
        <span style={{ fontSize: 10, color: '#636366', flexShrink: 0 }}>9:41</span>
      </DarkEmailRow>
      <DarkEmailRow>
        <Avatar logoUrl={null} shape="circle" size={36} theme="dark" fallback="B" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aeaeb2', marginBottom: 3 }}>Bob Smith</div>
          <div style={{ fontSize: 10, color: '#636366' }}>Hey, checking in...</div>
        </div>
      </DarkEmailRow>
    </div>
  )
}

function AppleMail({ logoUrl }) {
  return (
    <div style={{ background: '#1c1c1e', borderRadius: 10, padding: 6 }}>
      <DarkEmailRow highlight>
        <Avatar logoUrl={logoUrl} shape="circle" size={34} theme="dark" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 3 }}>EasySecurity</div>
          <div style={{ fontSize: 10, color: '#8e8e93' }}>DNS security alert</div>
        </div>
        <span style={{ fontSize: 10, color: '#636366', flexShrink: 0 }}>Now</span>
      </DarkEmailRow>
      <DarkEmailRow>
        <Avatar logoUrl={null} shape="circle" size={34} theme="dark" fallback="J" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aeaeb2', marginBottom: 3 }}>Jane Doe</div>
          <div style={{ fontSize: 10, color: '#636366' }}>Meeting at 3pm?</div>
        </div>
      </DarkEmailRow>
    </div>
  )
}

function YahooInbox({ logoUrl, hasCheckmark }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <EmailRow highlight bg="#f5f0ff">
        <Avatar logoUrl={logoUrl} shape="circle" size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1f2937' }}>EasySecurity</span>
            {hasCheckmark && logoUrl && <Checkmark color="#5f2d82" size={13} />}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>Your DNS health score: 65</div>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>9:41</span>
      </EmailRow>
      <EmailRow>
        <Avatar logoUrl={null} shape="circle" size={34} fallback="N" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Newsletter</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Top stories this week</div>
        </div>
      </EmailRow>
    </div>
  )
}

function YahooMobile({ logoUrl }) {
  return (
    <div style={{ background: '#1c1c1e', borderRadius: 10, padding: 6, maxWidth: 260, margin: '0 auto' }}>
      <DarkEmailRow highlight>
        <Avatar logoUrl={logoUrl} shape="circle" size={34} theme="dark" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 3 }}>EasySecurity</div>
          <div style={{ fontSize: 10, color: '#8e8e93' }}>Weekly DNS digest</div>
        </div>
        <span style={{ fontSize: 10, color: '#636366', flexShrink: 0 }}>9:41</span>
      </DarkEmailRow>
      <DarkEmailRow>
        <Avatar logoUrl={null} shape="circle" size={34} theme="dark" fallback="T" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aeaeb2', marginBottom: 3 }}>Team Updates</div>
          <div style={{ fontSize: 10, color: '#636366' }}>Sprint review notes</div>
        </div>
      </DarkEmailRow>
    </div>
  )
}

function AOLMail({ logoUrl }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <EmailRow highlight bg="#fff5f5">
        <Avatar logoUrl={logoUrl} shape="circle" size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', marginBottom: 3 }}>EasySecurity</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>Your weekly DNS digest</div>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>9:41</span>
      </EmailRow>
      <EmailRow>
        <Avatar logoUrl={null} shape="circle" size={34} fallback="M" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Marketing</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Special offer inside</div>
        </div>
      </EmailRow>
    </div>
  )
}

function FastmailInbox({ logoUrl }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <EmailRow highlight bg="#f0f9ff">
        <Avatar logoUrl={logoUrl} shape="circle" size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', marginBottom: 3 }}>EasySecurity</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>DNS alert: record changed</div>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>9:41</span>
      </EmailRow>
      <EmailRow>
        <Avatar logoUrl={null} shape="circle" size={34} fallback="F" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Friend</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Lunch tomorrow?</div>
        </div>
      </EmailRow>
    </div>
  )
}

function LaPosteInbox({ logoUrl }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <EmailRow highlight bg="#fffbeb">
        <Avatar logoUrl={logoUrl} shape="circle" size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', marginBottom: 3 }}>EasySecurity</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>Votre rapport DNS</div>
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>9:41</span>
      </EmailRow>
      <EmailRow>
        <Avatar logoUrl={null} shape="circle" size={34} fallback="P" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Paul Martin</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Bonjour, comment...</div>
        </div>
      </EmailRow>
    </div>
  )
}

function OutlookInbox() {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', opacity: 0.65 }}>
      <EmailRow highlight bg="#f0f6ff">
        <div style={{ width: 34, height: 34, borderRadius: 4, background: '#0078d4', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>ES</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', marginBottom: 3 }}>EasySecurity</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>Logo not shown — BIMI not supported</div>
        </div>
      </EmailRow>
      <div style={{ padding: '8px 12px', background: '#fef3c7', fontSize: 10, color: '#b45309', display: 'flex', alignItems: 'center', gap: 5 }}>
        <AlertTriangle size={11} />
        Microsoft Outlook does not support BIMI
      </div>
    </div>
  )
}

function ClientMockup({ client, logoUrl }) {
  const mockups = {
    gmail_inbox:  <GmailInbox   logoUrl={logoUrl} hasCheckmark={client.checkmark} />,
    gmail_open:   <GmailOpen    logoUrl={logoUrl} hasCheckmark={client.checkmark} />,
    gmail_mobile: <GmailMobile  logoUrl={logoUrl} hasCheckmark={client.checkmark} />,
    apple_mail:   <AppleMail    logoUrl={logoUrl} />,
    yahoo_inbox:  <YahooInbox   logoUrl={logoUrl} hasCheckmark={client.checkmark} />,
    yahoo_mobile: <YahooMobile  logoUrl={logoUrl} />,
    aol:          <AOLMail      logoUrl={logoUrl} />,
    fastmail:     <FastmailInbox logoUrl={logoUrl} />,
    laposte:      <LaPosteInbox logoUrl={logoUrl} />,
    outlook:      <OutlookInbox />,
  }
  return mockups[client.id] || null
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function BIMIPreviewPage() {
  const [logoUrl, setLogoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  function handleFile(f) {
    if (!f) return
    const allowed = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg']
    const mt = f.type || (f.name.endsWith('.svg') ? 'image/svg+xml' : '')
    if (!allowed.includes(mt)) { alert('Please upload SVG, PNG or JPG'); return }
    const url = URL.createObjectURL(f)
    if (logoUrl) URL.revokeObjectURL(logoUrl)
    setLogoUrl(url)
    setFileName(f.name)
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [logoUrl])

  function handleReset() {
    if (logoUrl) URL.revokeObjectURL(logoUrl)
    setLogoUrl(''); setFileName('')
  }

  const vmcRequired = CLIENTS.filter(c => c.supported && c.vmc)
  const noVmc       = CLIENTS.filter(c => c.supported && !c.vmc)
  const unsupported = CLIENTS.filter(c => !c.supported)

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>BIMI Email Client Preview</h1>
          <p>Upload your VMC-ready logo and see exactly how it appears across 10 email clients.</p>
        </div>
        {logoUrl && (
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RefreshCw size={13} /><span>Change logo</span>
          </button>
        )}
      </div>

      {/* VMC info banner */}
      <div className="alert-banner info" style={{ marginBottom: '1.5rem' }}>
        <Info size={15} />
        <span>Gmail and Apple Mail require a VMC or CMC certificate. Yahoo, AOL, Fastmail and others display your logo with just a DMARC record — no certificate needed. Outlook does not support BIMI.</span>
      </div>

      {/* Upload zone */}
      {!logoUrl && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? 'var(--brand-400)' : 'var(--neutral-200)'}`, borderRadius: 'var(--radius-lg)', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--brand-50)' : 'var(--neutral-50)', transition: 'all 0.15s', marginBottom: '2rem' }}
        >
          <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Upload size={24} color="var(--brand-500)" />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 6 }}>Upload your BIMI logo</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: 20 }}>SVG, PNG or JPG — square format recommended</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['SVG preferred', 'Square 1:1 ratio', 'Under 32KB'].map(t => (
              <span key={t} style={{ fontSize: '0.75rem', fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Logo loaded — show preview + shapes */}
      {logoUrl && (
        <>
          {/* File info + shape demo */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--neutral-150)', flexShrink: 0 }}>
                    <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{fileName}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)', marginTop: 2 }}>Previewing across 10 email clients</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginLeft: 'auto' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 500 }}>HOW IT'S CROPPED</div>
                  {[
                    { label: 'Circle', r: '50%', note: 'Gmail, Apple, Yahoo' },
                    { label: 'Rounded', r: '25%', note: 'Some providers' },
                    { label: 'Square', r: '4px', note: 'Fallback' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: s.r, overflow: 'hidden', border: '1.5px solid var(--neutral-200)', margin: '0 auto 4px' }}>
                        <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--neutral-500)', fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--neutral-400)' }}>{s.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Support legend */}
          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success-500)' }} />
              VMC/CMC required ({vmcRequired.length} clients)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-500)' }} />
              No certificate needed ({noVmc.length} clients)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger-400)' }} />
              Not supported ({unsupported.length} client)
            </div>
          </div>

          {/* Client grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {CLIENTS.map(client => (
              <div key={client.id} className="card" style={{ border: !client.supported ? '1px solid var(--danger-150)' : client.vmc ? '1px solid var(--success-150)' : '1px solid var(--brand-100)' }}>
                {/* Card header */}
                <div className="card-header" style={{ background: !client.supported ? 'var(--danger-50)' : client.vmc ? 'var(--success-50)' : 'var(--brand-50)', borderBottom: `1px solid ${!client.supported ? 'var(--danger-100)' : client.vmc ? 'var(--success-100)' : 'var(--brand-100)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: client.dot, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{client.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginLeft: 6 }}>{client.view}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {client.supported ? (
                      <>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: client.vmc ? 'var(--success-100)' : 'var(--brand-100)', color: client.vmc ? 'var(--success-700)' : 'var(--brand-700)' }}>
                          {client.vmcNote}
                        </span>
                        {client.checkmark && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Checkmark color={client.checkmarkColor} size={13} />
                            <span style={{ fontSize: '0.6875rem', color: 'var(--neutral-500)' }}>with VMC</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'var(--danger-100)', color: 'var(--danger-700)' }}>
                        Not supported
                      </span>
                    )}
                  </div>
                </div>

                {/* Mockup */}
                <div className="card-body" style={{ padding: '0.875rem' }}>
                  <ClientMockup client={client} logoUrl={logoUrl} />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--neutral-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-700)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="var(--brand-500)" />
              Important notes about BIMI display
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                'These are representative mockups — actual rendering varies slightly per email client version and OS.',
                'Yahoo, AOL and Fastmail show your logo without a VMC, but require DMARC p=quarantine or p=reject.',
                'Gmail and Apple Mail require a VMC (Verified Mark Certificate) or CMC (Common Mark Certificate).',
                'Gmail shows a blue checkmark and Yahoo shows a purple checkmark only when a VMC is present.',
                'Your logo must be square — all clients crop it to a circle or rounded shape.',
              ].map((note, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.8125rem', color: 'var(--neutral-500)', alignItems: 'flex-start' }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--neutral-400)', marginTop: 6, flexShrink: 0 }} />
                  {note}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
