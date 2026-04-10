import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Shield, Globe, BarChart2, Settings, Users, LogOut,
  ChevronDown, Plus, Building2, Bell, HelpCircle,
  Layout, Activity, Clock, AlertTriangle, FileImage, Mail, Search
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useOrg } from '../../hooks/useOrg'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/Toast'

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: <Layout size={16} />,    label: 'Dashboard' },
      { to: '/domains',   icon: <Globe size={16} />,     label: 'Domains' },
      { to: '/activity',  icon: <Activity size={16} />,  label: 'Activity' },
    ],
  },
  {
    label: 'DNS Security',
    items: [
      { to: '/dmarc',    icon: <Shield size={16} />,      label: 'DMARC' },
      { to: '/spf',      icon: <Activity size={16} />,    label: 'SPF Records' },
      { to: '/dkim',     icon: <Activity size={16} />,    label: 'DKIM Records' },
      { to: '/timeline', icon: <Clock size={16} />,       label: 'DNS Timeline' },
      { to: '/blacklist',icon: <AlertTriangle size={16} />,label: 'Blacklist Check' },
    ],
  },
  {
    label: 'BIMI & Brand',
    items: [
      { to: '/bimi',          icon: <Globe size={16} />,     label: 'BIMI Checker' },
      { to: '/svg-converter', icon: <FileImage size={16} />, label: 'SVG VMC Converter' },
      { to: '/bimi-preview',  icon: <Mail size={16} />,      label: 'Email Preview' },
      { to: '/vmc-advisor',   icon: <Shield size={16} />,    label: 'VMC Advisor' },
    ],
  },
  {
    label: 'Email Tools',
    items: [
      { to: '/email-headers', icon: <Search size={16} />,     label: 'Header Analyser' },
      { to: '/alerts',        icon: <AlertTriangle size={16} />, label: 'Alerts' },
      { to: '/reports',       icon: <BarChart2 size={16} />,  label: 'DMARC Reports' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/members', icon: <Users size={16} />, label: 'Members' },
    ],
  },
]

export function AppSidebar() {
  const { user, profile, signOut } = useAuth()
  const { orgs, currentOrg, currentRole, switchOrg, createOrg } = useOrg()
  const navigate = useNavigate()
  const toast = useToast()
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [newOrgModal, setNewOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleCreateOrg(e) {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setCreating(true)
    const { error } = await createOrg(newOrgName.trim())
    setCreating(false)
    if (error) { toast(error.message, 'error'); return }
    setNewOrgModal(false)
    setNewOrgName('')
    toast('Organisation created!', 'success')
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
      <aside className="app-sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <Shield size={18} color="white" />
          </div>
          <span className="sidebar-logo-text">DNS<span>Monitor</span></span>
        </div>

        {/* Org Switcher */}
        <div style={{ padding: '0.5rem 0.75rem' }}>
          <div className="org-switcher" onClick={() => setOrgMenuOpen(p => !p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div style={{ width: 26, height: 26, background: 'var(--brand-700)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Building2 size={13} color="var(--brand-300, #93c5fd)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="org-name">{currentOrg?.name || 'No organisation'}</div>
                  <div className="org-role">{currentRole || 'No role'}</div>
                </div>
              </div>
              <ChevronDown size={14} color="var(--neutral-500)" style={{ flexShrink: 0, transform: orgMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </div>
          </div>

          {orgMenuOpen && (
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: '0.375rem', marginTop: '0.25rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              {orgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => { switchOrg(org); setOrgMenuOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 0.625rem', background: org.id === currentOrg?.id ? 'rgba(26,107,255,0.15)' : 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: org.id === currentOrg?.id ? 'var(--brand-400)' : 'var(--neutral-300)', fontSize: '0.8125rem', textAlign: 'left' }}
                >
                  <Building2 size={13} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</span>
                </button>
              ))}
              <button
                onClick={() => { setNewOrgModal(true); setOrgMenuOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 0.625rem', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--neutral-400)', fontSize: '0.8125rem', marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Plus size={13} /><span>New organisation</span>
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        {navSections.map(section => (
          <div key={section.label} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div className="sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={16} /><span>Settings</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Bell size={16} /><span>Notifications</span>
          </NavLink>
          <NavLink to="/help" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <HelpCircle size={16} /><span>Help & Docs</span>
          </NavLink>

          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.5rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-600), var(--brand-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flex: 'none' }}>
                {initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--neutral-200)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              </div>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem', color: 'var(--neutral-500)', flex: 'none' }} title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* New Org Modal */}
      <Modal
        open={newOrgModal}
        onClose={() => setNewOrgModal(false)}
        title="New organisation"
        subtitle="Create a separate workspace for another team or company."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setNewOrgModal(false)}>Cancel</button>
            <button form="new-org-form" type="submit" className={`btn btn-primary ${creating ? 'btn-loading' : ''}`} disabled={creating}>
              {!creating && 'Create'}
            </button>
          </>
        }
      >
        <form id="new-org-form" onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Organisation name</label>
            <input
              className="input"
              type="text"
              placeholder="Acme Corp"
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              required
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </>
  )
}
