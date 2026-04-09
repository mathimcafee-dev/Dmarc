import { useState, useEffect, useCallback } from 'react'
import { Activity, Globe, Shield, Users, Settings, RefreshCw, CheckCircle, AlertTriangle, Plus, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'

const ACTION_META = {
  domain_added:    { icon: <Plus size={13} />,         color: 'var(--success-500)',  bg: 'var(--success-50)' },
  domain_verified: { icon: <CheckCircle size={13} />,  color: 'var(--success-600)',  bg: 'var(--success-50)' },
  domain_removed:  { icon: <AlertTriangle size={13} />,color: 'var(--danger-500)',   bg: 'var(--danger-50)'  },
  domain_scanned:  { icon: <RefreshCw size={13} />,    color: 'var(--brand-500)',    bg: 'var(--brand-50)'   },
  member_invited:  { icon: <Users size={13} />,        color: 'var(--neutral-600)',  bg: 'var(--neutral-100)'},
  member_removed:  { icon: <Users size={13} />,        color: 'var(--danger-500)',   bg: 'var(--danger-50)'  },
  alert_fired:     { icon: <AlertTriangle size={13} />,color: 'var(--warning-600)',  bg: 'var(--warning-50)' },
  settings_updated:{ icon: <Settings size={13} />,     color: 'var(--neutral-600)',  bg: 'var(--neutral-100)'},
}

function ActionIcon({ action }) {
  const meta = ACTION_META[action] || { icon: <Activity size={13} />, color: 'var(--neutral-500)', bg: 'var(--neutral-100)' }
  return (
    <div style={{ width: 28, height: 28, borderRadius: 7, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0 }}>
      {meta.icon}
    </div>
  )
}

function DomainHealthSummary({ domains }) {
  const active = domains.filter(d => d.status === 'active')
  if (!active.length) return null

  const buckets = {
    excellent: active.filter(d => d.health_score >= 80).length,
    good:      active.filter(d => d.health_score >= 60 && d.health_score < 80).length,
    fair:      active.filter(d => d.health_score >= 40 && d.health_score < 60).length,
    poor:      active.filter(d => d.health_score < 40).length,
  }

  const bars = [
    { label: 'Excellent (80+)', count: buckets.excellent, color: 'var(--success-500)' },
    { label: 'Good (60–79)',    count: buckets.good,      color: 'var(--brand-500)'   },
    { label: 'Fair (40–59)',    count: buckets.fair,      color: 'var(--warning-500)' },
    { label: 'Poor (<40)',      count: buckets.poor,      color: 'var(--danger-500)'  },
  ]

  return (
    <div className="card">
      <div className="card-header"><h4 style={{ margin: 0 }}>Domain health distribution</h4></div>
      <div className="card-body">
        {bars.map(bar => (
          <div key={bar.label} style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>{bar.label}</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: bar.color }}>{bar.count}</span>
            </div>
            <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${active.length ? (bar.count / active.length) * 100 : 0}%`, background: bar.color, borderRadius: 99, transition: 'width 0.6s var(--ease)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ActivityPage() {
  const { currentOrg } = useOrg()
  const { domains } = useDomains()
  const [logs, setLogs] = useState([])
  const [recentScans, setRecentScans] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)

    const [logsRes, timelineRes] = await Promise.all([
      supabase.from('audit_logs').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('dns_timeline').select('*, domains(domain)').in('domain_id', domains.map(d => d.id)).order('created_at', { ascending: false }).limit(20),
    ])

    setLogs(logsRes.data || [])
    setRecentScans(timelineRes.data || [])
    setLoading(false)
  }, [currentOrg, domains])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  // Build combined feed from audit logs + timeline
  const feed = [...logs, ...recentScans.map(t => ({
    id: t.id,
    action: 'domain_scanned',
    resource_type: 'domain',
    metadata: { domain: t.domains?.domain, record_type: t.record_type },
    created_at: t.created_at,
    _source: 'timeline',
  }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 60)

  function formatAction(log) {
    if (log._source === 'timeline') {
      return `${log.metadata?.record_type?.toUpperCase() || 'DNS'} scan recorded for ${log.metadata?.domain || 'domain'}`
    }
    const labels = {
      domain_added: `Domain added`,
      domain_verified: `Domain verified`,
      domain_removed: `Domain removed`,
      domain_scanned: `Domain scanned`,
      member_invited: `Member invited`,
      member_removed: `Member removed`,
      alert_fired: `Alert fired`,
      settings_updated: `Settings updated`,
    }
    return labels[log.action] || log.action
  }

  const pendingDomains = domains.filter(d => d.status === 'pending_verification')
  const neverScanned = domains.filter(d => d.status === 'active' && !d.last_checked_at)

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DNS Activity</h1>
          <p>Recent actions, scans, and events across your organisation.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchActivity}>
          <RefreshCw size={14} /><span>Refresh</span>
        </button>
      </div>

      {/* Notices */}
      {pendingDomains.length > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: '1rem' }}>
          <Clock size={15} />
          <span><strong>{pendingDomains.length} domain{pendingDomains.length > 1 ? 's' : ''}</strong> pending DNS verification: {pendingDomains.map(d => d.domain).join(', ')}</span>
        </div>
      )}
      {neverScanned.length > 0 && (
        <div className="alert-banner info" style={{ marginBottom: '1rem' }}>
          <RefreshCw size={15} />
          <span><strong>{neverScanned.length} domain{neverScanned.length > 1 ? 's' : ''}</strong> never scanned: {neverScanned.map(d => d.domain).join(', ')}. Head to Domains to run a scan.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>
        {/* Activity feed */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} />
              <h4 style={{ margin: 0 }}>Recent activity</h4>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: '1rem' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--neutral-100)', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: '0.375rem' }} />
                    <div className="skeleton" style={{ height: 11, width: '30%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Activity size={28} /></div>
              <p className="empty-title">No activity yet</p>
              <p className="empty-desc">Activity appears here as you add domains, run scans, and manage your team.</p>
            </div>
          ) : (
            <div style={{ padding: '0 1rem' }}>
              {feed.map((log, i) => (
                <div key={log.id || i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0', borderBottom: i < feed.length - 1 ? '1px solid var(--neutral-100)' : 'none', alignItems: 'flex-start' }}>
                  <ActionIcon action={log.action} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--neutral-800)', marginBottom: '0.125rem' }}>{formatAction(log)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <DomainHealthSummary domains={domains} />

          {/* Quick stats */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Overview</h4></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Total domains', value: domains.length },
                { label: 'Verified', value: domains.filter(d => d.status === 'active').length, color: 'var(--success-600)' },
                { label: 'Pending verify', value: pendingDomains.length, color: pendingDomains.length > 0 ? 'var(--warning-600)' : 'var(--neutral-500)' },
                { label: 'Never scanned', value: neverScanned.length, color: neverScanned.length > 0 ? 'var(--warning-600)' : 'var(--neutral-500)' },
                { label: 'Activity events', value: feed.length },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid var(--neutral-100)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--neutral-600)' }}>{item.label}</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: item.color || 'var(--neutral-900)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
