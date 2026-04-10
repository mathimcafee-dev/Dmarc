import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Mail, Lock, CheckCircle, AlertTriangle, ArrowRight, Eye, EyeOff, Loader, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_DESC = {
  owner:  'Full control including billing and deletion.',
  admin:  'Manage domains, members, and settings.',
  member: 'View and manage DNS records.',
  viewer: 'Read-only access to the organisation.',
}
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }

function Input({ icon: Icon, type, value, onChange, placeholder, readOnly, minLength, required, rightIcon, onRightIcon }) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1', pointerEvents: 'none' }} />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        minLength={minLength}
        required={required}
        style={{ width: '100%', height: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, paddingLeft: Icon ? 36 : 14, paddingRight: rightIcon ? 40 : 14, fontSize: 14, color: readOnly ? '#94a3b8' : '#0f172a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: readOnly ? '#f8fafc' : '#fff' }}
      />
      {rightIcon && (
        <button type="button" onClick={onRightIcon} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 0, display: 'flex' }}>
          {rightIcon}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AcceptInvitePage() {
  const navigate = useNavigate()
  const { user, signIn, signUp } = useAuth()

  const [invite, setInvite]         = useState(null)
  const [loadState, setLoadState]   = useState('loading') // loading | ready | error | expired | done | confirming | accepting
  const [errorMsg, setErrorMsg]     = useState('')
  const [tab, setTab]               = useState('signin')
  const [showPwd, setShowPwd]       = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError]   = useState('')
  const [form, setForm]             = useState({ name: '', password: '' })

  // Get token from URL — this is the ONLY way to accept an invite
  const params = new URLSearchParams(window.location.search)
  const token  = params.get('token') || ''

  // ── Load invite by token ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid invitation link — token missing. Please use the exact link from your email.')
      setLoadState('error')
      return
    }
    loadInvite()
  }, [token])

  async function loadInvite() {
    setLoadState('loading')
    const { data, error } = await supabase
      .from('org_invitations')
      .select('*, organisations(name)')
      .eq('token', token)
      .is('accepted_at', null)
      .single()

    if (error || !data) {
      setErrorMsg('Invitation not found. It may have already been accepted or the link is incorrect.')
      setLoadState('error')
      return
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setInvite(data)
      setLoadState('expired')
      return
    }

    setInvite(data)
    setLoadState('ready')
  }

  // ── If already logged in with correct email, auto-accept ───────────────────
  useEffect(() => {
    if (loadState !== 'ready' || !user || !invite) return

    if (user.email.toLowerCase() === invite.email.toLowerCase()) {
      doAccept()
    } else {
      // Logged in as wrong email — show clear message
      setAuthError(`You're signed in as ${user.email} but this invite is for ${invite.email}. Please sign out first and use the correct account.`)
    }
  }, [user, loadState, invite])

  // ── Accept the invite ───────────────────────────────────────────────────────
  async function doAccept() {
    setLoadState('accepting')
    try {
      // Add to org_members
      const { error: memErr } = await supabase
        .from('org_members')
        .upsert({
          org_id:      invite.org_id,
          user_id:     user.id,
          role:        invite.role,
          accepted_at: new Date().toISOString(),
        })
      if (memErr) throw memErr

      // Mark invitation accepted — burn the token
      await supabase
        .from('org_invitations')
        .update({ accepted_at: new Date().toISOString(), user_id: user.id })
        .eq('token', token)

      setLoadState('done')
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to accept invitation.')
      setLoadState('error')
    }
  }

  // ── Auth form submit ────────────────────────────────────────────────────────
  async function handleAuth(e) {
    e.preventDefault()
    setAuthError(''); setAuthLoading(true)

    if (tab === 'signin') {
      const { error } = await signIn(invite.email, form.password)
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      // useEffect will trigger doAccept once user state updates
    } else {
      if (form.password.length < 8) { setAuthError('Password must be at least 8 characters.'); setAuthLoading(false); return }
      const { data, error } = await signUp(invite.email, form.password, form.name)
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      // If email confirmation required
      if (data.user && !data.session) {
        setLoadState('confirming')
        setAuthLoading(false)
        return
      }
    }
    setAuthLoading(false)
  }

  // ── Shared layout wrapper ───────────────────────────────────────────────────
  function Wrap({ children }) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 440, width: '100%' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
            <div style={{ width: 30, height: 30, background: '#1a6bff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={15} color="white" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              DNS<span style={{ color: '#1a6bff' }}>Monitor</span>
            </span>
          </div>
          {children}
        </div>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadState === 'loading') return (
    <Wrap>
      <div style={{ textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Verifying invitation…
      </div>
    </Wrap>
  )

  // ── Accepting ───────────────────────────────────────────────────────────────
  if (loadState === 'accepting') return (
    <Wrap>
      <div style={{ textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Joining {invite?.organisations?.name}…
      </div>
    </Wrap>
  )

  // ── Done ────────────────────────────────────────────────────────────────────
  if (loadState === 'done') return (
    <Wrap>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={28} color="#16a34a" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>You're in!</h2>
        <p style={{ color: '#64748b', marginBottom: 6, lineHeight: 1.6 }}>
          You've joined <strong style={{ color: '#0f172a' }}>{invite?.organisations?.name}</strong> as a{' '}
          <strong style={{ color: '#1a6bff' }}>{ROLE_LABEL[invite?.role]}</strong>.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Redirecting to dashboard…</p>
      </div>
    </Wrap>
  )

  // ── Email confirm needed ────────────────────────────────────────────────────
  if (loadState === 'confirming') return (
    <Wrap>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Mail size={28} color="#1d4ed8" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Check your email</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          We sent a confirmation link to <strong>{invite?.email}</strong>.<br />
          Click it to verify your account, then return to this invitation link to join the organisation.
        </p>
      </div>
    </Wrap>
  )

  // ── Expired ─────────────────────────────────────────────────────────────────
  if (loadState === 'expired') return (
    <Wrap>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Clock size={28} color="#b45309" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Invitation expired</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
          This invitation for <strong>{invite?.email}</strong> expired on{' '}
          {new Date(invite?.expires_at).toLocaleDateString()}. Please ask the admin to send a new one.
        </p>
        <Link to="/login" style={{ display: 'inline-block', background: '#1a6bff', color: 'white', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          Go to sign in
        </Link>
      </div>
    </Wrap>
  )

  // ── Error ───────────────────────────────────────────────────────────────────
  if (loadState === 'error') return (
    <Wrap>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={28} color="#dc2626" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Invalid invitation</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>{errorMsg}</p>
        <Link to="/login" style={{ display: 'inline-block', background: '#1a6bff', color: 'white', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          Go to sign in
        </Link>
      </div>
    </Wrap>
  )

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <Wrap>
      {/* Invite banner */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          Invitation to join
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
          {invite?.organisations?.name}
        </div>
        <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 2 }}>
          Role: <strong>{ROLE_LABEL[invite?.role]}</strong> — {ROLE_DESC[invite?.role]}
        </div>
        <div style={{ fontSize: 12, color: '#93c5fd' }}>
          Invite for: {invite?.email}
        </div>
      </div>

      {/* Auth card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 0' }}>

          {authError && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 16, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{authError}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 20 }}>
            {[['signin', 'I have an account'], ['signup', 'Create account']].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setAuthError('') }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: tab === id ? '#fff' : 'transparent', color: tab === id ? '#0f172a' : '#64748b', transition: 'all 0.15s', boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAuth} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {tab === 'signup' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Full name</label>
              <Input type="text" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
          )}

          {/* Email — locked to invite email */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Email address</label>
            <Input icon={Mail} type="email" value={invite?.email || ''} readOnly />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              🔒 Locked — you must use this email to accept the invite
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Password</label>
            <Input
              icon={Lock}
              type={showPwd ? 'text' : 'password'}
              placeholder={tab === 'signup' ? 'Create a password (min. 8 chars)' : 'Enter your password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={tab === 'signup' ? 8 : undefined}
              rightIcon={showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              onRightIcon={() => setShowPwd(p => !p)}
            />
          </div>

          <button type="submit" disabled={authLoading}
            style={{ width: '100%', height: 44, background: authLoading ? '#93c5fd' : '#1a6bff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#fff', cursor: authLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', marginTop: 4 }}>
            {authLoading
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Processing…</>
              : <>{tab === 'signin' ? 'Sign in & accept invite' : 'Create account & accept invite'}<ArrowRight size={15} /></>
            }
          </button>
        </form>
      </div>

      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#94a3b8' }}>
        Expires {invite?.expires_at ? new Date(invite.expires_at).toLocaleDateString() : ''} ·{' '}
        <Link to="/login" style={{ color: '#1a6bff', textDecoration: 'none' }}>Back to sign in</Link>
      </div>
    </Wrap>
  )
}
