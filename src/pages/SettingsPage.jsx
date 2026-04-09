import { useState } from 'react'
import { Building2, User, Save, Shield, AlertTriangle } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'

export function SettingsPage() {
  const { currentOrg, updateOrg, isOwner } = useOrg()
  const { profile, updateProfile, user } = useAuth()
  const toast = useToast()

  const [orgForm, setOrgForm] = useState({ name: currentOrg?.name || '' })
  const [profileForm, setProfileForm] = useState({ full_name: profile?.full_name || '' })
  const [savingOrg, setSavingOrg] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState('org')

  async function handleSaveOrg(e) {
    e.preventDefault()
    setSavingOrg(true)
    const { error } = await updateOrg({ name: orgForm.name })
    setSavingOrg(false)
    if (error) toast(error.message, 'error')
    else toast('Organisation updated', 'success')
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await updateProfile({ full_name: profileForm.full_name })
    setSavingProfile(false)
    if (error) toast(error.message, 'error')
    else toast('Profile updated', 'success')
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Settings</h1>
          <p>Manage your organisation and profile preferences.</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'org' ? 'active' : ''}`} onClick={() => setActiveTab('org')}>
          <Building2 size={14} />Organisation
        </button>
        <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <User size={14} />Profile
        </button>
        <button className={`tab ${activeTab === 'danger' ? 'active' : ''}`} onClick={() => setActiveTab('danger')}>
          <AlertTriangle size={14} />Danger zone
        </button>
      </div>

      {activeTab === 'org' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={16} />
                <h4 style={{ margin: 0 }}>Organisation settings</h4>
              </div>
            </div>
            <form onSubmit={handleSaveOrg}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {!isOwner && (
                  <div className="alert-banner info">
                    <Shield size={15} />
                    <span>Only the organisation owner can edit these settings.</span>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Organisation name</label>
                  <input
                    className="input"
                    value={orgForm.name}
                    onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                    disabled={!isOwner}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Organisation ID</label>
                  <input className="input" value={currentOrg?.id || ''} disabled style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }} />
                  <span className="form-hint">This is your unique organisation identifier.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input className="input" value={currentOrg?.slug || ''} disabled style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }} />
                </div>
              </div>
              {isOwner && (
                <div className="card-footer">
                  <button type="submit" className={`btn btn-primary ${savingOrg ? 'btn-loading' : ''}`} disabled={savingOrg}>
                    {!savingOrg && <><Save size={14} /><span>Save changes</span></>}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} />
                <h4 style={{ margin: 0 }}>Your profile</h4>
              </div>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input
                    className="input"
                    value={profileForm.full_name}
                    onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input className="input" value={user?.email || ''} disabled />
                  <span className="form-hint">Email cannot be changed here.</span>
                </div>
              </div>
              <div className="card-footer">
                <button type="submit" className={`btn btn-primary ${savingProfile ? 'btn-loading' : ''}`} disabled={savingProfile}>
                  {!savingProfile && <><Save size={14} /><span>Save profile</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ border: '1px solid var(--danger-200)' }}>
            <div className="card-header" style={{ background: 'var(--danger-50)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} color="var(--danger-600)" />
                <h4 style={{ margin: 0, color: 'var(--danger-700)' }}>Danger zone</h4>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid var(--neutral-100)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--neutral-800)' }}>Delete organisation</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)', marginTop: '0.25rem' }}>Permanently delete this organisation and all its data.</div>
                </div>
                <button className="btn btn-danger btn-sm" disabled={!isOwner} title={!isOwner ? 'Only owners can delete the organisation' : ''}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
