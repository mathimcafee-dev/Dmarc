import { useState, useEffect, useCallback } from 'react'
import { Clock, Globe, Shield, Activity, Filter, RefreshCw, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'

const TYPE_META = {
  dmarc:   { label: 'DMARC',   color: 'var(--brand-500)',   bg: 'var(--brand-50)',   icon: <Shield size={13} /> },
  spf:     { label: 'SPF',     color: 'var(--warning-600)', bg: 'var(--warning-50)', icon: <Activity size={13} /> },
  dkim:    { label: 'DKIM',    color: 'var(--success-600)', bg: 'var(--success-50)', icon: <Activity size={13} /> },
  bimi:    { label: 'BIMI',    color: 'var(--neutral-600)', bg: 'var(--neutral-100)',icon: <Globe size={13} /> },
  mta_sts: { label: 'MTA-STS', color: 'var(--neutral-600)', bg: 'var(--neutral-100)',icon: <Shield size={13} /> },
  tls_rpt: { label: 'TLS-RPT', color: 'var(--neutral-600)', bg: 'var(--neutral-100)',icon: <Shield size={13} /> },
  mx:      { label: 'MX',      color: 'var(--info-600)',    bg: 'var(--info-50)',    icon: <Globe size={13} /> },
  txt:     { label: 'TXT',     color: 'var(--neutral-600)', bg: 'var(--neutral-100)',icon: <Globe size={13} /> },
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.txt
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 700, background: m.bg, color: m.color }}>
      {m.icon}{m.label}
    </span>
  )
}

function TimelineRow({ entry, domainMap }) {
  const [expanded, setExpanded] = useState(false)
  const domainName = domainMap[entry.domain_id] || entry.domain_id?.slice(0, 8)
  const hasChange = entry.previous_value && entry.previous_value !== entry.new_value

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--neutral-100)', cursor: hasChange ? 'pointer' : 'default' }} onClick={() => hasChange && setExpanded(p => !p)}>
      {/* Timeline dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: hasChange ? 'var(--brand-500)' : 'var(--neutral-300)', border: '2px solid var(--neutral-0)', marginTop: 4, boxShadow: hasChange ? '0 0 0 3px var(--brand-100)' : 'none' }} />
      </div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <TypeBadge type={entry.record_type} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-800)' }}>{domainName}</span>
          {hasChange && <span style={{ fontSize: '0.75rem', color: 'var(--brand-600)', fontWeight: 600 }}>Record changed</span>}
          {!hasChange && <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>Scan snapshot</span>}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>
          {new Date(entry.change_detected_at || entry.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>

        {expanded && hasChange && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Before</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', background: 'var(--danger-50)', borderRadius: 'var(--radius-sm)', color: 'var(--danger-700)', wordBreak: 'break-all' }}>
                {entry.previous_value}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>After</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', background: 'var(--success-50)', borderRadius: 'var(--radius-sm)', color: 'var(--success-700)', wordBreak: 'break-all' }}>
                {entry.new_value}
              </div>
            </div>
          </div>
        )}
      </div>
      {hasChange && (
        <ChevronDown size={14} color="var(--neutral-400)" style={{ flexShrink: 0, marginTop: 4, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      )}
    </div>
  )
}

export function TimelinePage() {
  const { currentOrg } = useOrg()
  const { domains } = useDomains()
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ domain: 'all', type: 'all' })
  const [page, setPage] = useState(0)
  const PER_PAGE = 30

  const domainMap = Object.fromEntries(domains.map(d => [d.id, d.domain]))

  const fetchTimeline = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    const domainIds = domains.map(d => d.id)
    if (!domainIds.length) { setTimeline([]); setLoading(false); return }

    let query = supabase
      .from('dns_timeline')
      .select('*')
      .in('domain_id', domainIds)
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

    if (filter.domain !== 'all') query = query.eq('domain_id', filter.domain)
    if (filter.type !== 'all') query = query.eq('record_type', filter.type)

    const { data } = await query
    setTimeline(data || [])
    setLoading(false)
  }, [currentOrg, domains, filter, page])

  useEffect(() => { fetchTimeline() }, [fetchTimeline])

  const changesOnly = timeline.filter(e => e.previous_value && e.previous_value !== e.new_value)

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DNS Timeline</h1>
          <p>Track every DNS record change across all your domains over time.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchTimeline}>
          <RefreshCw size={14} /><span>Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total events</div>
          <div className="stat-value">{timeline.length}</div>
          <div className="stat-sub">this page</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Record changes</div>
          <div className="stat-value" style={{ color: changesOnly.length > 0 ? 'var(--warning-500)' : 'var(--success-500)' }}>{changesOnly.length}</div>
          <div className="stat-sub">detected changes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Domains tracked</div>
          <div className="stat-value">{domains.filter(d => d.status === 'active').length}</div>
          <div className="stat-sub">active domains</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Filter size={14} color="var(--neutral-500)" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>Filter:</span>
        </div>
        <select className="input select" value={filter.domain} onChange={e => { setFilter(p => ({ ...p, domain: e.target.value })); setPage(0) }} style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <option value="all">All domains</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
        </select>
        <select className="input select" value={filter.type} onChange={e => { setFilter(p => ({ ...p, type: e.target.value })); setPage(0) }} style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <option value="all">All record types</option>
          {Object.keys(TYPE_META).map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div className="card">
        <div style={{ position: 'relative', paddingLeft: '1rem' }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: '1.75rem', top: 0, bottom: 0, width: 1, background: 'var(--neutral-150)' }} />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--neutral-100)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: '0.375rem' }} />
                    <div className="skeleton" style={{ height: 12, width: '20%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Clock size={28} /></div>
              <p className="empty-title">No timeline data yet</p>
              <p className="empty-desc">Timeline entries are created every time you scan a domain. Run scans to build history.</p>
            </div>
          ) : (
            timeline.map(entry => <TimelineRow key={entry.id} entry={entry} domainMap={domainMap} />)
          )}
        </div>

        {/* Pagination */}
        {timeline.length === PER_PAGE && (
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</button>
            <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', alignSelf: 'center' }}>Page {page + 1}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  )
}
