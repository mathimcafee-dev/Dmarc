import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, Plus, Search, CheckCircle, Clock, AlertTriangle,
  Trash2, RefreshCw, Copy, ExternalLink, Shield, ChevronRight, X
} from 'lucide-react'
import { useDomains } from '../hooks/useDomains'
import { useOrg } from '../hooks/useOrg'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'

function StatusBadge({ status }) {
  const map = {
    active: { cls: 'badge-success', icon: <CheckCircle size={10} />, label: 'Verified' },
    pending_verification: { cls: 'badge-warning', icon: <Clock size={10} />, label: 'Pending DNS' },
    error: { cls: 'badge-danger', icon: <AlertTriangle size={10} />, label: 'Error' },
  }
  const cfg = map[status] || map.error
  return <span className={`badge ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
}

function PolicyBadge({ policy }) {
  const map = {
    none: 'badge-danger',
    quarantine: 'badge-warning',
    reject: 'badge-success',
  }
  if (!policy) return <span className="badge badge-neutral">No DMARC</span>
  return <span className={`badge ${map[policy] || 'badge-neutral'}`}>p={policy}</span>
}

function HealthBar({ score }) {
  const color = score >= 80 ? 'var(--success-500)' : score >= 50 ? 'var(--warning-500)' : 'var(--danger-500)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 5, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width 0.5s var(--ease)' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color, minWidth: 26 }}>{score}</span>
    </div>
  )
}

function AddDomainModal({ open, onClose }) {
  const { addDomain } = useDomains()
  const toast = useToast()
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!trimmed) { setError('Enter a valid domain name'); return }
    if (!/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}$/.test(trimmed)) { setError('Enter a valid domain (e.g. example.com)'); return }
    setError('')
    setLoading(true)
    const { error } = await addDomain(trimmed)
    setLoading(false)
    if (error) { setError(error.message); return }
    toast(`${trimmed} added. Now verify DNS ownership.`, 'success')
    setDomain('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add domain"
      subtitle="Add a domain to monitor DMARC, SPF, and DKIM."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button form="add-domain-form" type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {!loading && 'Add Domain'}
          </button>
        </>
      }
    >
      <form id="add-domain-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div className="alert-banner danger"><AlertTriangle size={15} /><span>{error}</span></div>}
        <div className="form-group">
          <label className="form-label">Domain name</label>
          <div style={{ position: 'relative' }}>
            <Globe size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-mono)' }}
              type="text"
              placeholder="example.com"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              required
              autoFocus
            />
          </div>
          <span className="form-hint">Enter the root domain only — not a subdomain or URL.</span>
        </div>
        <div className="alert-banner info">
          <Shield size={15} />
          <span>After adding, you'll need to verify domain ownership by adding a DNS TXT record.</span>
        </div>
      </form>
    </Modal>
  )
}

function VerifyModal({ domain, open, onClose }) {
  const { verifyDomain } = useDomains()
  const toast = useToast()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)
  const txtRecord = `_dnsmonitor-verification=${domain?.verification_token}`

  async function handleVerify() {
    setChecking(true)
    setResult(null)
    const { verified, error } = await verifyDomain(domain.id)
    setChecking(false)
    if (verified) {
      toast('Domain verified successfully!', 'success')
      setResult({ ok: true })
      setTimeout(() => onClose(), 1500)
    } else {
      setResult({ ok: false, message: error?.message })
    }
  }

  function copyRecord() {
    navigator.clipboard.writeText(txtRecord)
    toast('Copied to clipboard', 'info')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verify domain ownership"
      subtitle={domain?.domain}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className={`btn btn-primary ${checking ? 'btn-loading' : ''}`} onClick={handleVerify} disabled={checking}>
            {!checking && <><RefreshCw size={14} /><span>Check DNS</span></>}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="alert-banner info">
          <Shield size={15} />
          <span>Add the following TXT record to your domain's DNS settings to verify ownership.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {[
            { label: 'Record type', value: 'TXT' },
            { label: 'Host / Name', value: '@' },
            { label: 'Value / Content', value: txtRecord, mono: true, copy: true },
            { label: 'TTL', value: '3600 (or Auto)' },
          ].map(row => (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid var(--neutral-100)' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--neutral-500)' }}>{row.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--neutral-800)', wordBreak: 'break-all' }}>{row.value}</code>
                {row.copy && (
                  <button className="btn btn-ghost btn-sm" onClick={copyRecord} style={{ padding: '0.25rem', flex: 'none' }}>
                    <Copy size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>
            DNS changes can take up to <strong>48 hours</strong> to propagate, though most registrars apply them within minutes.
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>
            After adding the record, click <strong>Check DNS</strong> to verify.
          </p>
        </div>

        {result && (
          <div className={`alert-banner ${result.ok ? 'success' : 'danger'}`}>
            {result.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>{result.ok ? 'Domain verified! Refreshing…' : result.message}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

function DeleteModal({ domain, open, onClose }) {
  const { removeDomain } = useDomains()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState('')

  async function handleDelete() {
    setLoading(true)
    const { error } = await removeDomain(domain.id)
    setLoading(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`${domain.domain} removed.`, 'success')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove domain"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn btn-danger ${loading ? 'btn-loading' : ''}`} onClick={handleDelete} disabled={loading || confirm !== domain?.domain}>
            {!loading && 'Remove domain'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="alert-banner danger">
          <AlertTriangle size={15} />
          <span>This will permanently delete <strong>{domain?.domain}</strong> and all associated DNS records and history.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Type <code style={{ fontFamily: 'var(--font-mono)' }}>{domain?.domain}</code> to confirm</label>
          <input className="input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={domain?.domain} />
        </div>
      </div>
    </Modal>
  )
}

export function DomainsPage() {
  const { domains, loading, scanDomain } = useDomains()
  const { isAdmin } = useOrg()
  const navigate = useNavigate()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [verifyDomain, setVerifyDomain] = useState(null)
  const [deleteDomain, setDeleteDomain] = useState(null)
  const [scanning, setScanning] = useState({})

  const filtered = domains.filter(d => d.domain.includes(search.toLowerCase()))

  async function handleScan(domain, e) {
    e.stopPropagation()
    setScanning(p => ({ ...p, [domain.id]: true }))
    const result = await scanDomain(domain.id)
    setScanning(p => ({ ...p, [domain.id]: false }))
    if (result.error) toast(result.error.message, 'error')
    else toast(`Scan complete: health score ${result.healthScore}`, 'success')
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Domains</h1>
          <p>Add and manage the domains you want to monitor for DMARC, SPF, and DKIM.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /><span>Add domain</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: 360 }}>
        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
        <input
          className="input"
          style={{ paddingLeft: '2.25rem' }}
          placeholder="Search domains…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--neutral-400)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Globe size={28} /></div>
            <p className="empty-title">{search ? 'No matching domains' : 'No domains yet'}</p>
            <p className="empty-desc">{search ? `No domains match "${search}"` : 'Add your first domain to start monitoring DMARC, SPF, and DKIM security.'}</p>
            {!search && isAdmin && (
              <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                <Plus size={15} /><span>Add your first domain</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th>DMARC Policy</th>
                <th>Health Score</th>
                <th>Last Scanned</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(domain => (
                <tr key={domain.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/domains/${domain.id}`)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 32, height: 32, background: 'var(--neutral-100)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Globe size={15} color="var(--neutral-500)" />
                      </div>
                      <div>
                        <div className="domain-name" style={{ fontSize: '0.875rem' }}>{domain.domain}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>
                          Added {new Date(domain.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={domain.status} /></td>
                  <td><PolicyBadge policy={domain.dmarc_policy} /></td>
                  <td style={{ minWidth: 120 }}>
                    <HealthBar score={domain.health_score || 0} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>
                      {domain.last_checked_at ? new Date(domain.last_checked_at).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                      {domain.status === 'pending_verification' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setVerifyDomain(domain)} title="Verify ownership">
                          <CheckCircle size={13} /><span>Verify</span>
                        </button>
                      )}
                      {domain.status === 'active' && (
                        <button className={`btn btn-secondary btn-sm ${scanning[domain.id] ? 'btn-loading' : ''}`} onClick={(e) => handleScan(domain, e)} disabled={scanning[domain.id]} title="Scan DNS records">
                          {!scanning[domain.id] && <RefreshCw size={13} />}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => window.open(`https://${domain.domain}`, '_blank')} title="Open website">
                        <ExternalLink size={13} />
                      </button>
                      {isAdmin && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteDomain(domain)} title="Remove domain">
                          <Trash2 size={13} />
                        </button>
                      )}
                      <ChevronRight size={15} color="var(--neutral-300)" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AddDomainModal open={addOpen} onClose={() => setAddOpen(false)} />
      <VerifyModal domain={verifyDomain} open={!!verifyDomain} onClose={() => setVerifyDomain(null)} />
      <DeleteModal domain={deleteDomain} open={!!deleteDomain} onClose={() => setDeleteDomain(null)} />
    </div>
  )
}
