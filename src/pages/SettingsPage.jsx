import { useState, useEffect } from 'react'
import { Building2, User, Save, Shield, Bell, Mail, Lock, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'profile',       label: 'Profile',        icon: User },
  { id: 'password',      label: 'Password',        icon: Lock },
  { id: 'org',           label: 'Organisation',    icon: Building2 },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'digest',        label: 'Weekly Digest',   icon: Mail },
  { id: 'danger',        label: 'Danger Zone',     icon: Shield },
]

export function SettingsPage() {
  const { currentOrg, updateOrg, isOwner, fetchOrgs } = useOrg()
  const { profile, updateProfile, user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('profile')

  // Forms
  const [profileForm, setProfileForm]     = useState({ full_name: profile?.full_name || '' })
  const [pwForm, setPwForm]               = useState({ current: '', next: '', confirm: '' })
  const [orgForm, setOrgForm]             = useState({ name: currentOrg?.name || '' })
  const [notifForm, setNotifForm]         = useState({ dns_changes: true, health_drops: true, blacklist: true, scan_complete: false })
  const [digestForm, setDigestForm]       = useState({ enabled: false, day: 'monday', time: '08:00', include_health: true, include_dmarc: true, include_blacklist: true })
  const [confirmName, setConfirmName]     = useState('')
  const [showPw, setShowPw]               = useState(false)

  // Loading states
  const [saving, setSaving] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setProfileForm({ full_name: profile?.full_name || '' })
    setOrgForm({ name: currentOrg?.name || '' })
    loadPrefs()
  }, [profile, currentOrg])

  async function loadPrefs() {
    if (!user) return
    const { data } = await supabase.from('user_preferences')
      .select('*').eq('user_id', user.id).single()
    if (data) {
      if (data.notifications) setNotifForm(data.notifications)
      if (data.digest)        setDigestForm(data.digest)
    }
  }

  async function savePrefs(key, value) {
    if (!user) return
    const { data: existing } = await supabase.from('user_preferences')
      .select('id').eq('user_id', user.id).single()
    if (existing) {
      await supabase.from('user_preferences').update({ [key]: value }).eq('user_id', user.id)
    } else {
      await supabase.from('user_preferences').insert({ user_id: user.id, [key]: value })
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault(); setSaving('profile')
    const { error } = await updateProfile({ full_name: profileForm.full_name })
    setSaving('')
    error ? toast(error.message, 'error') : toast('Profile updated', 'success')
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { toast('Passwords do not match', 'error'); return }
    if (pwForm.next.length < 8) { toast('Password must be at least 8 characters', 'error'); return }
    setSaving('pw')
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setSaving('')
    if (error) toast(error.message, 'error')
    else { toast('Password updated successfully', 'success'); setPwForm({ current: '', next: '', confirm: '' }) }
  }

  async function handleSaveOrg(e) {
    e.preventDefault(); setSaving('org')
    const { error } = await updateOrg({ name: orgForm.name })
    setSaving('')
    error ? toast(error.message, 'error') : toast('Organisation updated', 'success')
  }

  async function handleSaveNotifications() {
    setSaving('notif')
    await savePrefs('notifications', notifForm)
    setSaving('')
    toast('Notification preferences saved', 'success')
  }

  async function handleSaveDigest() {
    setSaving('digest')
    await savePrefs('digest', digestForm)
    setSaving('')
    toast('Weekly digest preferences saved', 'success')
  }

  async function handleDeleteOrg() {
    if (confirmName !== currentOrg?.name) { toast('Name does not match', 'error'); return }
    setDeleting(true)
    try {
      await supabase.from('domains').delete().eq('org_id', currentOrg.id)
      await supabase.from('org_members').delete().eq('org_id', currentOrg.id)
      await supabase.from('organisations').delete().eq('id', currentOrg.id)
      await fetchOrgs()
      toast('Organisation deleted', 'success')
    } catch (err) { toast(err.message, 'error') }
    setDeleting(false)
  }

  const Section = ({ title, sub, children }) => (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header">
        <div>
          <h4 style={{ margin: 0 }}>{title}</h4>
          {sub && <div style={{ fontSize: 12, color: 'var(--neutral-400)', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )

  const Field = ({ label, hint, children }) => (
    <div className="form-group" style={{ marginBottom: '1rem' }}>
      <label className="form-label">{label}</label>
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  )

  const Toggle = ({ label, desc, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--neutral-100)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--neutral-800)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div onClick={() => onChange(!checked)}
        style={{ width: 40, height: 22, borderRadius: 99, background: checked ? '#1a6bff' : 'var(--neutral-200)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Settings</h1>
          <p>Manage your account, organisation and preferences.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Sidebar nav */}
        <div className="card" style={{ padding: '0.5rem' }}>
          {TABS.map(t => {
            const Icon = t.icon
            const danger = t.id === 'danger'
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`nav-item ${tab === t.id ? 'active' : ''}`}
                style={{ width: '100%', color: danger && tab !== t.id ? 'var(--danger-500)' : undefined }}>
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div>
          {/* Profile */}
          {tab === 'profile' && (
            <Section title="Profile" sub="Your personal information">
              <form onSubmit={handleSaveProfile}>
                <Field label="Full name">
                  <input className="input" value={profileForm.full_name}
                    onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your name" />
                </Field>
                <Field label="Email address" hint="Email cannot be changed here. Contact support.">
                  <input className="input" value={user?.email || ''} disabled style={{ background: 'var(--neutral-50)', color: 'var(--neutral-400)' }} />
                </Field>
                <button type="submit" className={`btn btn-primary ${saving === 'profile' ? 'btn-loading' : ''}`} disabled={saving === 'profile'}>
                  {saving !== 'profile' && <><Save size={14} />Save changes</>}
                </button>
              </form>
            </Section>
          )}

          {/* Password */}
          {tab === 'password' && (
            <Section title="Change password" sub="Use a strong password of at least 8 characters">
              <form onSubmit={handleChangePassword}>
                <Field label="New password">
                  <input className="input" type={showPw ? 'text' : 'password'} value={pwForm.next}
                    onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                    placeholder="Min. 8 characters" autoComplete="new-password" minLength={8} required />
                </Field>
                <Field label="Confirm new password">
                  <input className="input" type={showPw ? 'text' : 'password'} value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Repeat password" autoComplete="new-password" required />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                  <input type="checkbox" id="showpw" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
                  <label htmlFor="showpw" style={{ fontSize: 13, color: 'var(--neutral-600)', cursor: 'pointer' }}>Show passwords</label>
                </div>
                {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
                  <div className="alert-banner danger" style={{ marginBottom: '1rem' }}><AlertTriangle size={14} /><span>Passwords do not match</span></div>
                )}
                {pwForm.next && pwForm.confirm && pwForm.next === pwForm.confirm && (
                  <div className="alert-banner success" style={{ marginBottom: '1rem' }}><CheckCircle size={14} /><span>Passwords match</span></div>
                )}
                <button type="submit" className={`btn btn-primary ${saving === 'pw' ? 'btn-loading' : ''}`}
                  disabled={saving === 'pw' || pwForm.next !== pwForm.confirm || pwForm.next.length < 8}>
                  {saving !== 'pw' && <><Lock size={14} />Update password</>}
                </button>
              </form>
            </Section>
          )}

          {/* Organisation */}
          {tab === 'org' && (
            <Section title="Organisation" sub="Settings for your current organisation">
              <form onSubmit={handleSaveOrg}>
                <Field label="Organisation name">
                  <input className="input" value={orgForm.name}
                    onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                    disabled={!isOwner} placeholder="Organisation name" required />
                </Field>
                <Field label="Organisation ID" hint="Use this when contacting support">
                  <input className="input" value={currentOrg?.id || ''} disabled style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--neutral-50)', color: 'var(--neutral-400)' }} />
                </Field>
                {isOwner && (
                  <button type="submit" className={`btn btn-primary ${saving === 'org' ? 'btn-loading' : ''}`} disabled={saving === 'org'}>
                    {saving !== 'org' && <><Save size={14} />Save changes</>}
                  </button>
                )}
              </form>
            </Section>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <Section title="Notification preferences" sub="Choose what triggers an alert email">
              <Toggle label="DNS record changes" desc="Alert when DMARC, SPF or DKIM records change"
                checked={notifForm.dns_changes} onChange={v => setNotifForm(p => ({ ...p, dns_changes: v }))} />
              <Toggle label="Health score drops" desc="Alert when a domain health score drops below 50"
                checked={notifForm.health_drops} onChange={v => setNotifForm(p => ({ ...p, health_drops: v }))} />
              <Toggle label="Blacklist detected" desc="Alert when a domain appears on a blacklist"
                checked={notifForm.blacklist} onChange={v => setNotifForm(p => ({ ...p, blacklist: v }))} />
              <Toggle label="Scan complete" desc="Alert after every automatic scan completes"
                checked={notifForm.scan_complete} onChange={v => setNotifForm(p => ({ ...p, scan_complete: v }))} />
              <div style={{ marginTop: '1.25rem' }}>
                <button className={`btn btn-primary ${saving === 'notif' ? 'btn-loading' : ''}`}
                  onClick={handleSaveNotifications} disabled={saving === 'notif'}>
                  {saving !== 'notif' && <><Save size={14} />Save preferences</>}
                </button>
              </div>
            </Section>
          )}

          {/* Weekly Digest */}
          {tab === 'digest' && (
            <>
              <Section title="Weekly email digest" sub="Get a summary of your DNS health every week">
                <Toggle label="Enable weekly digest" desc="Receive a summary email with domain health scores and changes"
                  checked={digestForm.enabled} onChange={v => setDigestForm(p => ({ ...p, enabled: v }))} />
                {digestForm.enabled && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Field label="Send on">
                      <select className="input select" value={digestForm.day}
                        onChange={e => setDigestForm(p => ({ ...p, day: e.target.value }))}>
                        {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Send at (IST)">
                      <select className="input select" value={digestForm.time}
                        onChange={e => setDigestForm(p => ({ ...p, time: e.target.value }))}>
                        {['06:00','07:00','08:00','09:00','10:00'].map(t => (
                          <option key={t} value={t}>{t} IST</option>
                        ))}
                      </select>
                    </Field>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-600)', marginBottom: 8 }}>Include in digest:</div>
                      <Toggle label="Health scores" desc="Domain health score for each monitored domain"
                        checked={digestForm.include_health} onChange={v => setDigestForm(p => ({ ...p, include_health: v }))} />
                      <Toggle label="DMARC policy summary" desc="Count of domains at each policy level"
                        checked={digestForm.include_dmarc} onChange={v => setDigestForm(p => ({ ...p, include_dmarc: v }))} />
                      <Toggle label="Blacklist status" desc="Any domains currently listed on blacklists"
                        checked={digestForm.include_blacklist} onChange={v => setDigestForm(p => ({ ...p, include_blacklist: v }))} />
                    </div>
                  </div>
                )}
                <div style={{ marginTop: '1.25rem' }}>
                  <button className={`btn btn-primary ${saving === 'digest' ? 'btn-loading' : ''}`}
                    onClick={handleSaveDigest} disabled={saving === 'digest'}>
                    {saving !== 'digest' && <><Save size={14} />Save digest settings</>}
                  </button>
                </div>
              </Section>

              <div className="card" style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-150)' }}>
                <div className="card-body">
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)', marginBottom: 4 }}>How the digest works</div>
                  <div style={{ fontSize: 12, color: 'var(--brand-600)', lineHeight: 1.6 }}>
                    The weekly digest runs automatically via cron every Monday morning. It emails all org members
                    a summary of each domain's health score, DMARC policy, and any blacklist issues detected in the last 7 days.
                    Your preferences here control what's included and when it's sent.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Danger zone */}
          {tab === 'danger' && isOwner && (
            <div className="card" style={{ border: '1px solid var(--danger-200)' }}>
              <div className="card-header" style={{ background: 'var(--danger-50)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trash2 size={16} color="var(--danger-600)" />
                  <h4 style={{ margin: 0, color: 'var(--danger-700)' }}>Delete organisation</h4>
                </div>
              </div>
              <div className="card-body">
                <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
                  <AlertTriangle size={15} />
                  <span>This will permanently delete <strong>{currentOrg?.name}</strong>, all domains, DNS records, and reports. This cannot be undone.</span>
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Type <strong>{currentOrg?.name}</strong> to confirm</label>
                  <input className="input" value={confirmName} onChange={e => setConfirmName(e.target.value)}
                    placeholder={currentOrg?.name} style={{ borderColor: confirmName && confirmName !== currentOrg?.name ? 'var(--danger-400)' : undefined }} />
                </div>
                <button className={`btn ${deleting ? 'btn-loading' : ''}`}
                  style={{ background: 'var(--danger-500)', color: '#fff', border: 'none' }}
                  onClick={handleDeleteOrg}
                  disabled={deleting || confirmName !== currentOrg?.name}>
                  {!deleting && <><Trash2 size={14} />Delete organisation permanently</>}
                </button>
              </div>
            </div>
          )}
          {tab === 'danger' && !isOwner && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><Shield size={28} /></div>
                <p className="empty-title">Owner access required</p>
                <p className="empty-desc">Only the organisation owner can delete the organisation.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
