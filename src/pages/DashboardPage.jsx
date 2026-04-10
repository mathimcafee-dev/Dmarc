import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Shield, AlertTriangle, CheckCircle, Plus, ArrowRight, TrendingUp, Activity, Clock, Building2, Users, Zap } from 'lucide-react'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { supabase } from '../lib/supabase'

function HealthRing({ score, size = 64 }) {
  const r = (size / 2) - 7
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  const bg    = score >= 80 ? '#dcfce7' : score >= 50 ? '#fef3c7' : '#fee2e2'
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.24, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
      </div>
    </div>
  )
}

function BigScoreRing({ score }) {
  const size = 120
  const r = 46
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  const label = score >= 80 ? 'Excellent' : score >= 50 ? 'Needs work' : 'Critical'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={60} cy={60} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={10} />
          <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${color}66)` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{score}</span>
          <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, padding: '2px 10px', borderRadius: 99, background: `${color}18` }}>{label}</span>
    </div>
  )
}

function PolicyBadge({ policy }) {
  const map = {
    none:        { bg: '#fee2e2', color: '#dc2626', label: 'p=none' },
    quarantine:  { bg: '#fef3c7', color: '#b45309', label: 'p=quarantine' },
    reject:      { bg: '#dcfce7', color: '#16a34a', label: 'p=reject' },
  }
  const cfg = map[policy] || { bg: 'var(--neutral-100)', color: 'var(--neutral-500)', label: 'No record' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
}

export function DashboardPage() {
  const { currentOrg, isAdmin } = useOrg()
  const { domains, loading } = useDomains()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!currentOrg) return
    supabase.from('org_members').select('id').eq('org_id', currentOrg.id).not('accepted_at', 'is', null)
      .then(({ data }) => setMembers(data || []))
  }, [currentOrg])

  if (!currentOrg) return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="empty-state">
        <div className="empty-icon"><Building2 size={28} /></div>
        <p className="empty-title">No organisation selected</p>
        <p className="empty-desc">Create or join an organisation to start managing DNS.</p>
      </div>
    </div>
  )

  const activeDomains = domains.filter(d => d.status === 'active')
  const avgHealth = activeDomains.length
    ? Math.round(activeDomains.reduce((sum, d) => sum + (d.health_score || 0), 0) / activeDomains.length) : 0
  const pendingDomains = domains.filter(d => d.status === 'pending_verification')
  const rejectCount = domains.filter(d => d.dmarc_policy === 'reject').length
  const criticalCount = domains.filter(d => (d.health_score || 0) < 50).length

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>{greeting} 👋</h1>
          <p>DNS health overview for <strong style={{ color: 'var(--neutral-700)' }}>{currentOrg.name}</strong></p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/domains')}>
          <Plus size={15} /><span>Add Domain</span>
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Domains',   value: domains.length,          sub: `${activeDomains.length} active`,       icon: <Globe size={16} />,        accent: '#1a6bff' },
          { label: 'Avg Health',      value: avgHealth,               sub: 'across all domains',                    icon: <TrendingUp size={16} />,   accent: avgHealth >= 80 ? '#16a34a' : avgHealth >= 50 ? '#d97706' : '#dc2626', big: true },
          { label: 'p=reject',        value: rejectCount,             sub: `of ${domains.length} domains`,          icon: <Shield size={16} />,       accent: '#16a34a' },
          { label: 'Need attention',  value: criticalCount + pendingDomains.length, sub: 'pending or score < 50',   icon: <AlertTriangle size={16} />, accent: criticalCount + pendingDomains.length > 0 ? '#dc2626' : '#16a34a' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: s.accent, borderRadius: '12px 0 0 12px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${s.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent }}>
                {s.icon}
              </div>
            </div>
            {loading
              ? <div className="skeleton" style={{ height: 40, width: 64 }} />
              : <div style={{ fontSize: s.big ? 36 : 32, fontWeight: 900, color: s.accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{s.value}</div>
            }
            <div style={{ fontSize: 12, color: 'var(--neutral-400)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Domains */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <h3 style={{ margin: 0 }}>Your domains</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/domains')}>View all <ArrowRight size={13} /></button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 'var(--radius-lg)' }} />)}
            </div>
          ) : domains.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><Globe size={28} /></div>
                <p className="empty-title">No domains yet</p>
                <p className="empty-desc">Add your first domain to start monitoring.</p>
                <button className="btn btn-primary" onClick={() => navigate('/domains')}><Plus size={15} /><span>Add domain</span></button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {domains.slice(0, 6).map(domain => (
                <div key={domain.id} className="domain-card" onClick={() => navigate(`/domains/${domain.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.125rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <HealthRing score={domain.health_score || 0} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="domain-name" style={{ fontWeight: 700, marginBottom: 4 }}>{domain.domain}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {domain.status === 'active'
                        ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={9} />Verified</span>
                        : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />Pending</span>
                      }
                      <PolicyBadge policy={domain.dmarc_policy} />
                    </div>
                  </div>
                  <ArrowRight size={15} color="var(--neutral-300)" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Big score card */}
          {activeDomains.length > 0 && (
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-500)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio health</div>
              <BigScoreRing score={avgHealth} />
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--neutral-50)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{rejectCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>p=reject</div>
                </div>
                <div style={{ background: 'var(--neutral-50)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: criticalCount > 0 ? '#dc2626' : '#16a34a' }}>{criticalCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>critical</div>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Quick actions</h4></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }}>
              {[
                { label: 'Add new domain',       icon: <Plus size={14} />,     to: '/domains',  primary: true },
                { label: 'Check DMARC policy',   icon: <Shield size={14} />,   to: '/dmarc' },
                { label: 'View SPF records',     icon: <Activity size={14} />, to: '/spf' },
                { label: 'Invite team member',   icon: <Users size={14} />,    to: '/members' },
                { label: 'Analyse email headers',icon: <Zap size={14} />,      to: '/email-headers' },
              ].map(a => (
                <button key={a.label} className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => navigate(a.to)}>
                  {a.icon}<span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Policy breakdown */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>DMARC policies</h4></div>
            <div className="card-body" style={{ padding: '1rem' }}>
              {['reject','quarantine','none'].map(p => {
                const count = domains.filter(d => d.dmarc_policy === p).length
                const pct = domains.length ? Math.round((count/domains.length)*100) : 0
                const colors = { reject:'#16a34a', quarantine:'#d97706', none:'#dc2626' }
                return (
                  <div key={p} style={{ marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--neutral-600)', fontFamily: 'var(--font-mono)' }}>p={p}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors[p] }}>{count}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors[p], borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
              {domains.length === 0 && <p style={{ fontSize: 12, textAlign: 'center', color: 'var(--neutral-400)' }}>No data yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
