import { useState, useEffect } from 'react'
import { Users, Plus, Mail, Trash2, Crown, Shield, Eye, UserCheck } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'

const ROLE_INFO = {
  owner: { label: 'Owner', icon: <Crown size={13} />, cls: 'badge-warning', desc: 'Full control including billing and deletion' },
  admin: { label: 'Admin', icon: <Shield size={13} />, cls: 'badge-brand', desc: 'Manage domains, members, and settings' },
  member: { label: 'Member', icon: <UserCheck size={13} />, cls: 'badge-neutral', desc: 'View and manage DNS records' },
  viewer: { label: 'Viewer', icon: <Eye size={13} />, cls: 'badge-neutral', desc: 'Read-only access' },
}

function RoleBadge({ role }) {
  const info = ROLE_INFO[role] || ROLE_INFO.viewer
  return <span className={`badge ${info.cls}`}>{info.icon}{info.label}</span>
}

export function MembersPage() {
  const { currentOrg, isAdmin, isOwner } = useOrg()
  const { user } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member', password: '' })
  const [showInvitePwd, setShowInvitePwd] = useState(false)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    if (!currentOrg) return
    fetchMembers()
    fetchInvitations()
  }, [currentOrg])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('org_members')
      .select(`role, accepted_at, user_id, profiles(full_name, avatar_url), auth_users:user_id(email)`)
      .eq('org_id', currentOrg.id)
      .not('accepted_at', 'is', null)
      .order('invited_at')

    // Fallback: join with auth.users is not always available via RLS
    const { data: simple } = await supabase
      .from('org_members')
      .select('id, role, accepted_at, user_id, invited_at')
      .eq('org_id', currentOrg.id)
      .not('accepted_at', 'is', null)

    if (simple) setMembers(simple)
    setLoading(false)
  }

  async function fetchInvitations() {
    const { data } = await supabase
      .from('org_invitations')
      .select('*')
      .eq('org_id', currentOrg.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
    setInvitations(data || [])
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteForm.password || inviteForm.password.length < 6) {
      toast('Password must be at least 6 characters', 'error')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:     inviteForm.email,
          role:      inviteForm.role,
          password:  inviteForm.password,
          orgId:     currentOrg.id,
          orgName:   currentOrg.name,
          invitedBy: user?.email || 'An admin',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to invite member', 'error')
        setInviting(false)
        return
      }
      if (!data.emailSent) {
        toast(`${inviteForm.email} added to org. Email delivery failed — share credentials manually.`, 'error')
      } else {
        toast(`${inviteForm.email} has been added and received their login credentials.`, 'success')
      }
      setInviteOpen(false)
      setInviteForm({ email: '', role: 'member', password: '' })
      setShowInvitePwd(false)
      fetchMembers()
      fetchInvitations()
    } catch (err) {
      toast(err.message || 'Failed to invite member', 'error')
    }
    setInviting(false)
  }

  async function revokeInvitation(id) {
    const { error } = await supabase.from('org_invitations').delete().eq('id', id)
    if (!error) { fetchInvitations(); toast('Invitation revoked', 'info') }
  }

  async function removeMember(memberId) {
    if (!window.confirm('Remove this member from the organisation?')) return
    const { error } = await supabase.from('org_members').delete().eq('id', memberId).eq('org_id', currentOrg.id)
    if (!error) { fetchMembers(); toast('Member removed', 'info') }
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Members</h1>
          <p>Manage team access to <strong style={{ color: 'var(--neutral-700)' }}>{currentOrg?.name}</strong></p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            <Plus size={15} /><span>Invite member</span>
          </button>
        )}
      </div>

      {/* Role explanation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
        {Object.entries(ROLE_INFO).map(([role, info]) => (
          <div key={role} style={{ padding: '0.875rem', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ marginBottom: '0.375rem' }}><RoleBadge role={role} /></div>
            <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: 0 }}>{info.desc}</p>
          </div>
        ))}
      </div>

      {/* Active members */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} />
            <h4 style={{ margin: 0 }}>Active members</h4>
            <span className="badge badge-neutral">{members.length}</span>
          </div>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Joined</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ height: 18, width: 200 }} /></td>
                    <td><div className="skeleton" style={{ height: 18, width: 80 }} /></td>
                    <td><div className="skeleton" style={{ height: 18, width: 100 }} /></td>
                    {isAdmin && <td />}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: '2rem' }}>No members found</td></tr>
              ) : members.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-600), var(--brand-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flex: 'none' }}>
                        {m.user_id?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-800)' }}>
                          {m.user_id === user?.id ? 'You' : `Member ${m.user_id?.slice(0, 8)}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>uid: {m.user_id?.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td><RoleBadge role={m.role} /></td>
                  <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>{new Date(m.accepted_at).toLocaleDateString('en-IN')}</span></td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      {m.user_id !== user?.id && m.role !== 'owner' && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => removeMember(m.id)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={16} />
              <h4 style={{ margin: 0 }}>Pending invitations</h4>
              <span className="badge badge-warning">{invitations.length}</span>
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Expires</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{inv.email}</span></td>
                    <td><RoleBadge role={inv.role} /></td>
                    <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>{new Date(inv.expires_at).toLocaleDateString('en-IN')}</span></td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => revokeInvitation(inv.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteForm({ email: '', role: 'member', password: '' }); setShowInvitePwd(false) }}
        title="Add team member"
        subtitle="Their account will be created immediately. They'll receive an email with their login credentials."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setInviteOpen(false); setInviteForm({ email: '', role: 'member', password: '' }); setShowInvitePwd(false) }}>Cancel</button>
            <button form="invite-form" type="submit" className={`btn btn-primary ${inviting ? 'btn-loading' : ''}`} disabled={inviting}>
              {!inviting && 'Create account & send email'}
            </button>
          </>
        }
      >
        <form id="invite-form" onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
              <input className="input" style={{ paddingLeft: '2.25rem' }} type="email" placeholder="colleague@company.com" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} required autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Temporary password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                style={{ paddingRight: '2.5rem' }}
                type={showInvitePwd ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={inviteForm.password}
                onChange={e => setInviteForm(p => ({ ...p, password: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowInvitePwd(p => !p)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', display: 'flex', padding: 0 }}>
                {showInvitePwd
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <span className="form-hint">They can change this password from Settings after logging in.</span>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Role</label>
            <select className="input select" value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}>
              <option value="admin">Admin — Manage domains and members</option>
              <option value="member">Member — View and manage DNS records</option>
              <option value="viewer">Viewer — Read-only access</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  )
}
