import { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, CheckCircle, AlertTriangle, Shield, Activity, Globe, TrendingDown, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'

const ALERT_TYPES = [
  { value: 'dmarc_policy_change', label: 'DMARC Policy Change', desc: 'Fires when the p= value changes on any scan', icon: <Shield size={16} />, color: 'var(--brand-500)' },
  { value: 'spf_failure', label: 'SPF Lookup Limit', desc: 'Fires when SPF exceeds 10 DNS lookups', icon: <Activity size={16} />, color: 'var(--warning-500)' },
  { value: 'dkim_failure', label: 'DKIM Record Missing', desc: 'Fires when a DKIM selector disappears', icon: <Activity size={16} />, color: 'var(--danger-500)' },
  { value: 'health_score_drop', label: 'Health Score Drop', desc: 'Fires when score drops more than 20 points', icon: <TrendingDown size={16} />, color: 'var(--danger-500)' },
  { value: 'new_sending_source', label: 'New Sending Source', desc: 'Fires when unknown IPs appear in DMARC reports', icon: <Globe size={16} />, color: 'var(--neutral-600)' },
]

function AlertRow({ alert, domains, onDelete }) {
  const domainName = alert.domain_id ? domains.find(d => d.id === alert.domain_id)?.domain : 'All domains'
  const meta = ALERT_TYPES.find(t => t.value === alert.alert_type)

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${meta?.color || 'var(--neutral-500)'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta?.color || 'var(--neutral-500)' }}>
            {meta?.icon}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{meta?.label || alert.alert_type}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>{meta?.desc}</div>
          </div>
        </div>
      </td>
      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{domainName}</span></td>
      <td>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {(alert.email_recipients || []).map((email, i) => (
            <span key={i} style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--neutral-100)', borderRadius: 99, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>{email}</span>
          ))}
        </div>
      </td>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: alert.is_enabled ? 'var(--success-600)' : 'var(--neutral-400)' }}>
          {alert.is_enabled ? <><CheckCircle size={12} />Active</> : 'Disabled'}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => onDelete(alert.id)}><Trash2 size={13} /></button>
      </td>
    </tr>
  )
}

export function AlertsPage() {
  const { currentOrg, isAdmin } = useOrg()
  const { domains } = useDomains()
  const toast = useToast()
  const [alerts, setAlerts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('config')
  const [form, setForm] = useState({ alert_type: 'dmarc_policy_change', domain_id: '', email_recipients: '', is_enabled: true })
  const [saving, setSaving] = useState(false)

  const fetchAlerts = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    const [alertsRes, eventsRes] = await Promise.all([
      supabase.from('alert_configs').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }),
      supabase.from('alert_events').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(50),
    ])
    setAlerts(alertsRes.data || [])
    setEvents(eventsRes.data || [])
    setLoading(false)
  }, [currentOrg])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const recipients = form.email_recipients.split(',').map(s => s.trim()).filter(Boolean)
    if (!recipients.length) { toast('Add at least one email', 'error'); setSaving(false); return }

    const { error } = await supabase.from('alert_configs').insert({
      org_id: currentOrg.id,
      alert_type: form.alert_type,
      domain_id: form.domain_id || null,
      email_recipients: recipients,
      is_enabled: form.is_enabled,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Alert configured', 'success')
    setAddOpen(false)
    setForm({ alert_type: 'dmarc_policy_change', domain_id: '', email_recipients: '', is_enabled: true })
    fetchAlerts()
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this alert?')) return
    const { error } = await supabase.from('alert_configs').delete().eq('id', id)
    if (!error) { fetchAlerts(); toast('Alert removed', 'info') }
  }

  async function toggleAlert(id, current) {
    const { error } = await supabase.from('alert_configs').update({ is_enabled: !current }).eq('id', id)
    if (!error) fetchAlerts()
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Alerts</h1>
          <p>Get notified by email when DNS records change or issues are detected.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /><span>Add alert</span>
          </button>
        )}
      </div>

      {/* Info banner about daily cron */}
      <div className="alert-banner info" style={{ marginBottom: '1.5rem' }}>
        <Bell size={15} />
        <span>Alerts fire automatically during the <strong>daily DNS scan</strong> (runs at 06:00 IST). You can also trigger scans manually from the Domains page.</span>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}><Bell size={14} />Alert Rules ({alerts.length})</button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><Activity size={14} />Alert History ({events.length})</button>
      </div>

      {activeTab === 'config' && (
        <>
          {/* Alert type cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {ALERT_TYPES.map(type => {
              const count = alerts.filter(a => a.alert_type === type.value && a.is_enabled).length
              return (
                <div key={type.value} className="stat-card" style={{ cursor: 'pointer', borderColor: count > 0 ? type.color : 'var(--neutral-150)' }} onClick={() => { setForm(p => ({ ...p, alert_type: type.value })); setAddOpen(true) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                    <div style={{ color: type.color }}>{type.icon}</div>
                    {count > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: `${type.color}18`, color: type.color, padding: '2px 7px', borderRadius: 99 }}>{count} active</span>}
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: '0.25rem' }}>{type.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{type.desc}</div>
                </div>
              )
            })}
          </div>

          {/* Configured alerts table */}
          {loading ? (
            <div className="card"><div className="card-body"><div className="skeleton" style={{ height: 120 }} /></div></div>
          ) : alerts.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><Bell size={28} /></div>
                <p className="empty-title">No alerts configured</p>
                <p className="empty-desc">Add your first alert rule to start receiving email notifications about DNS changes.</p>
                <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={15} /><span>Add alert</span></button>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Alert type</th><th>Domain scope</th><th>Recipients</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {alerts.map(a => <AlertRow key={a.id} alert={a} domains={domains} onDelete={handleDelete} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="card">
          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Bell size={28} /></div>
              <p className="empty-title">No alerts fired yet</p>
              <p className="empty-desc">Alert events will appear here when DNS issues are detected during scans.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr><th>Alert type</th><th>Domain</th><th>Message</th><th>Fired at</th></tr></thead>
                <tbody>
                  {events.map(ev => {
                    const meta = ALERT_TYPES.find(t => t.value === ev.alert_type)
                    const domain = domains.find(d => d.id === ev.domain_id)
                    return (
                      <tr key={ev.id}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: meta?.color || 'var(--neutral-600)' }}>
                            {meta?.icon}{meta?.label || ev.alert_type}
                          </span>
                        </td>
                        <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{domain?.domain || '—'}</span></td>
                        <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>{ev.message}</span></td>
                        <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>{new Date(ev.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Alert Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Configure alert"
        subtitle="Choose what to monitor and who to notify."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button form="alert-form" type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} disabled={saving}>
              {!saving && 'Save alert'}
            </button>
          </>
        }
      >
        <form id="alert-form" onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div className="form-group">
            <label className="form-label">Alert type</label>
            <select className="input select" value={form.alert_type} onChange={e => setForm(p => ({ ...p, alert_type: e.target.value }))}>
              {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <span className="form-hint">{ALERT_TYPES.find(t => t.value === form.alert_type)?.desc}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Domain scope</label>
            <select className="input select" value={form.domain_id} onChange={e => setForm(p => ({ ...p, domain_id: e.target.value }))}>
              <option value="">All domains</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Email recipients</label>
            <input className="input" type="text" placeholder="you@company.com, team@company.com" value={form.email_recipients} onChange={e => setForm(p => ({ ...p, email_recipients: e.target.value }))} required />
            <span className="form-hint">Comma-separated email addresses. Requires <code style={{ fontFamily: 'var(--font-mono)' }}>RESEND_API_KEY</code> in Vercel env vars.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <input type="checkbox" id="enabled" checked={form.is_enabled} onChange={e => setForm(p => ({ ...p, is_enabled: e.target.checked })) } style={{ width: 16, height: 16 }} />
            <label htmlFor="enabled" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>Enable immediately</label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
