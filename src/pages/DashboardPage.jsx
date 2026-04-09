import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Shield, AlertTriangle, CheckCircle, Plus, ArrowRight, TrendingUp, Activity, Clock, Building2 } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { supabase } from '../lib/supabase'

function HealthRing({ score, size = 80 }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? 'var(--success-500)' : score >= 50 ? 'var(--warning-500)' : 'var(--danger-500)'

  return (
    <div className="health-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={7} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="health-score-label">
        <span className="health-score-number" style={{ color }}>{score}</span>
        <span className="health-score-sub">/ 100</span>
      </div>
    </div>
  )
}

function PolicyBadge({ policy }) {
  const map = {
    none: { class: 'badge-danger', label: 'p=none' },
    quarantine: { class: 'badge-warning', label: 'p=quarantine' },
    reject: { class: 'badge-success', label: 'p=reject' },
  }
  const cfg = map[policy] || { class: 'badge-neutral', label: 'No record' }
  return <span className={`badge ${cfg.class}`}>{cfg.label}</span>
}

export function DashboardPage() {
  const { currentOrg, isAdmin } = useOrg()
  const { domains, loading } = useDomains()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (!currentOrg) return
    supabase.from('org_members').select('id').eq('org_id', currentOrg.id).not('accepted_at', 'is', null)
      .then(({ data }) => setMembers(data || []))
  }, [currentOrg])

  if (!currentOrg) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="empty-state">
          <div className="empty-icon"><Building2 size={28} /></div>
          <p className="empty-title">No organisation selected</p>
          <p className="empty-desc">Create or join an organisation to start managing DNS.</p>
        </div>
      </div>
    )
  }

  const activeDomains = domains.filter(d => d.status === 'active')
  const pendingDomains = domains.filter(d => d.status === 'pending_verification')
  const avgHealth = activeDomains.length
    ? Math.round(activeDomains.reduce((sum, d) => sum + (d.health_score || 0), 0) / activeDomains.length)
    : 0

  const stats = [
    { label: 'Total Domains', value: domains.length, icon: <Globe size={18} />, color: 'var(--brand-500)', sub: `${activeDomains.length} active` },
    { label: 'Avg Health Score', value: avgHealth, icon: <TrendingUp size={18} />, color: 'var(--success-500)', sub: 'across active domains' },
    { label: 'Pending Verification', value: pendingDomains.length, icon: <AlertTriangle size={18} />, color: 'var(--warning-500)', sub: 'domains not yet verified' },
    { label: 'Team Members', value: members.length, icon: <Activity size={18} />, color: 'var(--neutral-500)', sub: `in ${currentOrg.name}` },
  ]

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Good morning 👋</h1>
          <p>Here's the DNS health overview for <strong style={{ color: 'var(--neutral-700)' }}>{currentOrg.name}</strong></p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/domains')}>
          <Plus size={15} /><span>Add Domain</span>
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.75rem' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div className="stat-label">{s.label}</div>
              <div style={{ width: 32, height: 32, background: `${s.color}18`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                {s.icon}
              </div>
            </div>
            {loading ? <div className="skeleton" style={{ height: 36, width: 60 }} /> : (
              <>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
        {/* Domains list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Your domains</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/domains')}>
              View all <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />)}
            </div>
          ) : domains.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><Globe size={28} /></div>
                <p className="empty-title">No domains yet</p>
                <p className="empty-desc">Add your first domain to start monitoring DMARC, SPF, and DKIM.</p>
                <button className="btn btn-primary" onClick={() => navigate('/domains')}>
                  <Plus size={15} /><span>Add your first domain</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {domains.slice(0, 6).map(domain => (
                <div key={domain.id} className="domain-card" onClick={() => navigate(`/domains/${domain.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <HealthRing score={domain.health_score || 0} size={56} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="domain-name">{domain.domain}</div>
                      <div className="domain-meta" style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {domain.status === 'active' ? (
                          <span className="badge badge-success"><CheckCircle size={10} /> Verified</span>
                        ) : (
                          <span className="badge badge-warning"><Clock size={10} /> Pending</span>
                        )}
                        <PolicyBadge policy={domain.dmarc_policy} />
                      </div>
                    </div>
                    <ArrowRight size={16} color="var(--neutral-300)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Quick actions */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0 }}>Quick actions</h4>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }}>
              {[
                { label: 'Add new domain', icon: <Plus size={14} />, to: '/domains', primary: true },
                { label: 'Check DMARC policy', icon: <Shield size={14} />, to: '/dmarc' },
                { label: 'View SPF records', icon: <Activity size={14} />, to: '/spf' },
                { label: 'Invite a team member', icon: <Activity size={14} />, to: '/members' },
              ].map(action => (
                <button
                  key={action.label}
                  className={`btn ${action.primary ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => navigate(action.to)}
                >
                  {action.icon}<span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Policy health summary */}
          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0 }}>DMARC policy summary</h4>
            </div>
            <div className="card-body" style={{ padding: '1rem' }}>
              {['reject', 'quarantine', 'none'].map(policy => {
                const count = domains.filter(d => d.dmarc_policy === policy).length
                const pct = domains.length ? Math.round((count / domains.length) * 100) : 0
                const colors = { reject: 'var(--success-500)', quarantine: 'var(--warning-500)', none: 'var(--danger-500)' }
                return (
                  <div key={policy} style={{ marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-600)', fontFamily: 'var(--font-mono)' }}>p={policy}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: colors[policy] }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors[policy], borderRadius: 99, transition: 'width 0.6s var(--ease)' }} />
                    </div>
                  </div>
                )
              })}
              {domains.length === 0 && <p style={{ fontSize: '0.8125rem', textAlign: 'center', color: 'var(--neutral-400)' }}>No domain data yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
