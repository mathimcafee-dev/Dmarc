import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, User, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'

function BrandPanel() {
  const features = [
    'DMARC policy management & monitoring',
    'SPF, DKIM, BIMI record management',
    'Multi-tenant organisation support',
    'DNS health timeline & change history',
    'Real-time alerts & weekly digests',
  ]
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-bg" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 32px rgba(26,107,255,0.4)',
          }}>
            <Shield size={26} color="white" />
          </div>
          <h2 style={{ color: 'white', fontSize: '1.625rem', marginBottom: '0.5rem' }}>
            DNS<span style={{ color: 'var(--brand-400)' }}>Monitor</span>
          </h2>
          <p style={{ color: 'var(--neutral-400)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            Complete DMARC & DNS security management platform for EasySecurity.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <CheckCircle size={15} color="var(--brand-400)" />
              <span style={{ color: 'var(--neutral-300)', fontSize: '0.875rem' }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color: 'var(--neutral-500)', fontSize: '0.8125rem' }}>
            Part of the <strong style={{ color: 'var(--neutral-300)' }}>EasySecurity</strong> platform
          </p>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
    setLoading(false)
    if (error) { setError(error.message); return }
    toast('Welcome back!', 'success')
    navigate('/dashboard')
  }

  return (
    <div className="auth-shell">
      <BrandPanel />
      <div className="auth-panel">
        <div className="auth-form-wrap fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <div style={{
                width: 32, height: 32,
                background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield size={16} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
                DNS<span style={{ color: 'var(--brand-500)' }}>Monitor</span>
              </span>
            </div>
            <h1 style={{ marginTop: '1.5rem', marginBottom: '0.375rem' }}>Sign in</h1>
            <p style={{ color: 'var(--neutral-500)', fontSize: '0.9375rem' }}>
              Manage your DMARC & DNS security
            </p>
          </div>

          {error && (
            <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
              <Shield size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input
                  className={`input ${error ? 'error' : ''}`}
                  style={{ paddingLeft: '2.25rem' }}
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: 0, display: 'flex' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Link to="/forgot-password" style={{ fontSize: '0.8125rem' }}>Forgot password?</Link>
              </div>
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`} disabled={loading} style={{ marginTop: '0.5rem', width: '100%' }}>
              {!loading && <><span>Sign in</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--neutral-500)', marginTop: '1.5rem' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ fontWeight: 600 }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { data, error } = await signUp(form.email, form.password, form.name)
    setLoading(false)
    if (error) { setError(error.message); return }
    if (data.user && !data.session) {
      setDone(true) // Email confirmation required
    } else {
      toast('Account created! Set up your organisation.', 'success')
      navigate('/onboarding')
    }
  }

  if (done) return (
    <div className="auth-shell">
      <BrandPanel />
      <div className="auth-panel">
        <div className="auth-form-wrap fade-in" style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--success-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Mail size={28} color="var(--success-600)" />
          </div>
          <h2>Check your email</h2>
          <p style={{ marginTop: '0.5rem', color: 'var(--neutral-500)' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--neutral-700)' }}>{form.email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <BrandPanel />
      <div className="auth-panel">
        <div className="auth-form-wrap fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={16} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>DNS<span style={{ color: 'var(--brand-500)' }}>Monitor</span></span>
            </div>
            <h1 style={{ marginTop: '1.5rem', marginBottom: '0.375rem' }}>Create account</h1>
            <p style={{ color: 'var(--neutral-500)', fontSize: '0.9375rem' }}>Start managing your domain security</p>
          </div>

          {error && (
            <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
              <Shield size={16} /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem' }} type="text" placeholder="Mathi Kumar" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Work email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem' }} type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }} type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: 0, display: 'flex' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="form-hint">Must be at least 8 characters</span>
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`} disabled={loading} style={{ marginTop: '0.5rem', width: '100%' }}>
              {!loading && <><span>Create account</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--neutral-500)', marginTop: '1.5rem' }}>
            Already have an account?{' '}<Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
