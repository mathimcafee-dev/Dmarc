import { useState } from 'react'
import { Activity, Search, Plus, Trash2, AlertTriangle, CheckCircle, Copy, Info } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { useDomains } from '../hooks/useDomains'

const SPF_MECHANISMS = [
  { type: 'include', label: 'include', desc: 'Include another domain\'s SPF (e.g. spf.google.com)', hasValue: true },
  { type: 'a', label: 'a', desc: 'Domain\'s A/AAAA record IP is allowed', hasValue: false },
  { type: 'mx', label: 'mx', desc: 'Domain\'s MX servers are allowed', hasValue: false },
  { type: 'ip4', label: 'ip4', desc: 'Specific IPv4 address or range', hasValue: true },
  { type: 'ip6', label: 'ip6', desc: 'Specific IPv6 address or range', hasValue: true },
  { type: 'redirect', label: 'redirect', desc: 'Redirect to another domain\'s SPF', hasValue: true },
  { type: '-all', label: '-all', desc: 'Fail all other senders (recommended)', hasValue: false },
  { type: '~all', label: '~all', desc: 'Softfail other senders', hasValue: false },
  { type: '?all', label: '?all', desc: 'Neutral — no policy', hasValue: false },
]

const COMMON_INCLUDES = [
  { label: 'Google Workspace', value: '_spf.google.com' },
  { label: 'Microsoft 365', value: 'spf.protection.outlook.com' },
  { label: 'Mailchimp', value: 'servers.mcsv.net' },
  { label: 'SendGrid', value: 'sendgrid.net' },
  { label: 'Mailgun', value: 'mailgun.org' },
  { label: 'Amazon SES (US)', value: 'amazonses.com' },
  { label: 'Zoho Mail', value: 'zoho.com' },
  { label: 'Postmark', value: 'spf.mtasv.net' },
]

export function SPFPage() {
  const { domains } = useDomains()
  const toast = useToast()

  // Lookup state
  const [lookup, setLookup] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // Builder state
  const [mechanisms, setMechanisms] = useState([
    { type: 'mx', value: '', qualifier: '+' },
    { type: '-all', value: '', qualifier: '+' },
  ])
  const [activeTab, setActiveTab] = useState('lookup')

  async function handleLookup(e) {
    e.preventDefault()
    setLookupError('')
    setLookupResult(null)
    const domain = lookup.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    setLookupLoading(true)
    try {
      const res = await fetch(`/api/dns-lookup?domain=${domain}&type=TXT&prefix=v%3Dspf1`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLookupResult({ domain, records: data.records, queried_at: data.queried_at })
    } catch (err) {
      setLookupError(err.message || 'Lookup failed')
    }
    setLookupLoading(false)
  }

  function addMechanism(type) {
    const mech = SPF_MECHANISMS.find(m => m.type === type)
    if (!mech) return
    // Remove existing -all/~all/?all before adding new one
    const isAll = ['-all', '~all', '?all'].includes(type)
    let base = isAll ? mechanisms.filter(m => !['-all', '~all', '?all'].includes(m.type)) : mechanisms.filter(m => !['-all', '~all', '?all'].includes(m.type))
    const allMech = isAll ? [] : mechanisms.filter(m => ['-all', '~all', '?all'].includes(m.type))
    setMechanisms([...base, { type, value: '', qualifier: '+' }, ...allMech])
  }

  function removeMechanism(i) {
    setMechanisms(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMechanism(i, field, val) {
    setMechanisms(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  const lookupTypes = ['include', 'a', 'mx', 'ptr', 'exists', 'redirect']
  const lookupCount = mechanisms.filter(m => lookupTypes.includes(m.type)).length
  const isOver = lookupCount > 10

  function buildRecord() {
    const parts = mechanisms.map(m => {
      const q = m.qualifier === '+' ? '' : m.qualifier
      if (['-all', '~all', '?all'].includes(m.type)) return m.type
      return `${q}${m.type}${m.value ? `:${m.value}` : ''}`
    })
    return `v=spf1 ${parts.join(' ')}`
  }

  const generatedRecord = buildRecord()

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>SPF Records</h1>
          <p>Look up and build SPF (Sender Policy Framework) records for your domains.</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'lookup' ? 'active' : ''}`} onClick={() => setActiveTab('lookup')}><Search size={14} />SPF Lookup</button>
        <button className={`tab ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}><Plus size={14} />SPF Builder</button>
        <button className={`tab ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => setActiveTab('domains')}><Activity size={14} />My Domains</button>
      </div>

      {activeTab === 'lookup' && (
        <div className="card">
          <div className="card-header"><h4 style={{ margin: 0 }}>SPF Lookup</h4></div>
          <div className="card-body">
            <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Domain</label>
                <input className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="example.com" value={lookup} onChange={e => setLookup(e.target.value)} required />
              </div>
              <button type="submit" className={`btn btn-primary ${lookupLoading ? 'btn-loading' : ''}`} disabled={lookupLoading} style={{ marginBottom: '1.375rem' }}>
                {!lookupLoading && <><Search size={14} /><span>Lookup</span></>}
              </button>
            </form>
            {lookupError && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{lookupError}</span></div>}
            {lookupResult && (
              <div>
                {lookupResult.records.length === 0 ? (
                  <div className="alert-banner danger"><AlertTriangle size={15} /><span>No SPF record found for <code>{lookupResult.domain}</code>.</span></div>
                ) : lookupResult.records.map((rec, i) => {
                  const parts = rec.data.split(/\s+/).filter(Boolean)
                  const lookupC = parts.filter(p => ['include:', 'a', 'mx', 'ptr', 'exists:', 'redirect='].some(t => p.includes(t))).length
                  return (
                    <div key={i} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--neutral-50)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle size={14} color="var(--success-500)" />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>SPF Record found</span>
                          <span className={`badge ${lookupC > 10 ? 'badge-danger' : 'badge-success'}`}>{lookupC}/10 lookups</span>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }} onClick={() => { navigator.clipboard.writeText(rec.data); toast('Copied!', 'info') }}><Copy size={12} /></button>
                      </div>
                      <div className="code-block" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--neutral-200)' }}>{rec.data}</div>
                      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid var(--neutral-150)' }}>
                        {parts.slice(1).map((p, j) => <code key={j} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', background: 'var(--neutral-100)', padding: '2px 8px', borderRadius: 4 }}>{p}</code>)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Current mechanisms */}
            <div className="card">
              <div className="card-header">
                <h4 style={{ margin: 0 }}>Configured mechanisms</h4>
                <span className={`badge ${isOver ? 'badge-danger' : 'badge-success'}`}>{lookupCount}/10 DNS lookups</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isOver && (
                  <div className="alert-banner danger" style={{ marginBottom: '0.5rem' }}><AlertTriangle size={14} /><span>Too many DNS lookups ({lookupCount}/10). Remove some include/a/mx mechanisms.</span></div>
                )}
                {mechanisms.map((m, i) => {
                  const meta = SPF_MECHANISMS.find(s => s.type === m.type)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-150)' }}>
                      <select className="input select" value={m.qualifier} onChange={e => updateMechanism(i, 'qualifier', e.target.value)} style={{ width: 70, padding: '0.3rem 0.5rem', fontSize: '0.8125rem' }}>
                        <option value="+">+ pass</option>
                        <option value="-">- fail</option>
                        <option value="~">~ soft</option>
                        <option value="?">? neutral</option>
                      </select>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-600)', minWidth: 60 }}>{m.type}</code>
                      {meta?.hasValue && (
                        <input className="input" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }} placeholder="value" value={m.value} onChange={e => updateMechanism(i, 'value', e.target.value)} />
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)', padding: '0.25rem', flex: 'none' }} onClick={() => removeMechanism(i)}><Trash2 size={13} /></button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Generated record */}
            <div className="card">
              <div className="card-header">
                <h4 style={{ margin: 0 }}>Generated SPF record</h4>
                <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(generatedRecord); toast('Copied!', 'success') }}>
                  <Copy size={13} /><span>Copy</span>
                </button>
              </div>
              <div className="card-body">
                <div className="code-block">{generatedRecord}</div>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>Add this as a <strong>TXT</strong> record at your domain root (<code style={{ fontFamily: 'var(--font-mono)' }}>@</code>).</p>
                </div>
              </div>
            </div>
          </div>

          {/* Add mechanisms panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Add mechanism</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {SPF_MECHANISMS.map(m => (
                  <button key={m.type} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '0.5rem 0.75rem' }} onClick={() => addMechanism(m.type)}>
                    <Plus size={12} style={{ flex: 'none' }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{m.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 400, whiteSpace: 'normal' }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Quick add senders</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {COMMON_INCLUDES.map(inc => (
                  <button key={inc.value} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                    const allMechs = mechanisms.filter(m => ['-all', '~all', '?all'].includes(m.type))
                    const otherMechs = mechanisms.filter(m => !['-all', '~all', '?all'].includes(m.type))
                    if (otherMechs.some(m => m.value === inc.value)) { toast('Already added', 'info'); return }
                    setMechanisms([...otherMechs, { type: 'include', value: inc.value, qualifier: '+' }, ...allMechs])
                  }}>
                    <Plus size={12} /><span>{inc.label}</span>
                    <code style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>{inc.value}</code>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'domains' && (
        <div>
          {domains.length === 0 ? (
            <div className="card"><div className="empty-state"><p className="empty-title">No domains</p><p className="empty-desc">Add domains from the Domains page to see SPF status.</p></div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Domain</th><th>SPF Record</th><th>DNS Lookups</th><th>Valid</th></tr></thead>
                <tbody>
                  {domains.map(d => (
                    <tr key={d.id}>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{d.domain}</span></td>
                      <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>Run scan to fetch</span></td>
                      <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>—</span></td>
                      <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>—</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
