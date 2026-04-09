import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Building2, ArrowRight, Users, Globe } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useToast } from '../components/ui/Toast'

export function OnboardingPage() {
  const { createOrg } = useOrg()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(1) // 1: org name, 2: done
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!orgName.trim()) { setError('Organisation name is required'); return }
    setError('')
    setLoading(true)
    const { error } = await createOrg(orgName.trim())
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep(2)
    setTimeout(() => {
      toast('Organisation created! Add your first domain.', 'success')
      navigate('/dashboard')
    }, 1400)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--neutral-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 520 }} className="fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-400))', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 32px rgba(26,107,255,0.3)' }}>
            <Shield size={26} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem' }}>Welcome to DNSMonitor</h1>
          <p style={{ color: 'var(--neutral-500)', marginTop: '0.25rem' }}>Let's set up your organisation</p>
        </div>

        {/* Step indicators */}
        <div className="steps" style={{ marginBottom: '2rem' }}>
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
            <div className="step-num">{step > 1 ? '✓' : '1'}</div>
            <div className="step-label">Organisation</div>
          </div>
          <div className="step-connector" />
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-num">2</div>
            <div className="step-label">Add Domains</div>
          </div>
          <div className="step-connector" />
          <div className="step">
            <div className="step-num">3</div>
            <div className="step-label">Configure</div>
          </div>
        </div>

        {step === 1 && (
          <div className="card slide-up">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, background: 'var(--brand-50)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} color="var(--brand-500)" />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Create your organisation</h3>
                  <p style={{ fontSize: '0.8125rem', margin: 0 }}>This is your workspace in DNSMonitor</p>
                </div>
              </div>
            </div>
            <div className="card-body">
              {error && (
                <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
                  <Shield size={16} /><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Organisation name</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Acme Corp, My Agency, etc."
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    required
                    autoFocus
                  />
                  <span className="form-hint">This will be visible to all members of your workspace.</span>
                </div>

                {/* What you get */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                  {[
                    { icon: <Globe size={14} />, text: 'Unlimited domain scanning' },
                    { icon: <Users size={14} />, text: 'Invite team members' },
                    { icon: <Shield size={14} />, text: 'DMARC & SPF monitoring' },
                    { icon: <ArrowRight size={14} />, text: 'DNS health timeline' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>
                      <span style={{ color: 'var(--brand-500)' }}>{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                  disabled={loading || !orgName.trim()}
                  style={{ width: '100%' }}
                >
                  {!loading && <><span>Create Organisation</span><ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card slide-up" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ width: 64, height: 64, background: 'var(--success-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Building2 size={28} color="var(--success-600)" />
            </div>
            <h2>Organisation created!</h2>
            <p style={{ color: 'var(--neutral-500)', marginTop: '0.5rem' }}>
              <strong style={{ color: 'var(--neutral-700)' }}>{orgName}</strong> is ready. Taking you to the dashboard…
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ width: 40, height: 4, background: 'var(--brand-500)', borderRadius: 99, margin: '0 auto', animation: 'grow 1.4s ease forwards' }} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes grow { from { width: 0; } to { width: 40px; } }
      `}</style>
    </div>
  )
}
