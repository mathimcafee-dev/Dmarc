import { useState, useEffect } from 'react'
import { Shield, Upload, TrendingUp, Server, Globe, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { useToast } from '../components/ui/Toast'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const C = { pass: '#16a34a', fail: '#dc2626', forward: '#d97706', unknown: '#94a3b8' }

function StatCard({ label, value, color, sub }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color, borderRadius: '12px 0 0 12px' }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value?.toLocaleString() ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)', fontSize: 13 }}>No data</div>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <PieChart width={160} height={160}>
        <Pie data={data} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v) => v.toLocaleString()} />
      </PieChart>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--neutral-700)', fontWeight: 500 }}>{d.name}</span>
            <span style={{ color: 'var(--neutral-500)', marginLeft: 'auto', fontWeight: 700 }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 6, fontSize: 11, color: 'var(--neutral-400)' }}>
          Total: {total.toLocaleString()} emails
        </div>
      </div>
    </div>
  )
}

function SourceRow({ source, count, total, passCount }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  const passPct = count ? Math.round((passCount / count) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--neutral-100)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--neutral-50)', border: '1px solid var(--neutral-150)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Server size={13} color="var(--neutral-400)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>{source}</div>
        <div style={{ height: 4, background: 'var(--neutral-100)', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: passPct >= 80 ? C.pass : passPct >= 50 ? C.forward : C.fail, borderRadius: 99 }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)' }}>{count.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: passPct >= 80 ? C.pass : C.fail, fontWeight: 600 }}>{passPct}% pass</div>
      </div>
    </div>
  )
}

function ReportRow({ report, onClick, expanded }) {
  const begin = report.report_begin ? new Date(report.report_begin).toLocaleDateString('en-IN') : '—'
  const end   = report.report_end   ? new Date(report.report_end).toLocaleDateString('en-IN')   : '—'
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }}>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)' }}>{report.org_name || '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>{report.policy_domain}</div>
      </td>
      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--neutral-600)' }}>{begin} → {end}</td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: report.policy_p === 'reject' ? '#dcfce7' : report.policy_p === 'quarantine' ? '#fef3c7' : '#fee2e2', color: report.policy_p === 'reject' ? '#16a34a' : report.policy_p === 'quarantine' ? '#b45309' : '#dc2626' }}>
          p={report.policy_p || '?'}
        </span>
      </td>
      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--neutral-400)' }}>{new Date(report.created_at).toLocaleDateString('en-IN')}</td>
      <td style={{ padding: '10px 16px', color: 'var(--neutral-400)' }}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
    </tr>
  )
}

function RecordDetail({ reportId }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('dmarc_report_records').select('*').eq('report_id', reportId)
      .order('count', { ascending: false })
      .then(({ data }) => { setRecords(data || []); setLoading(false) })
  }, [reportId])

  if (loading) return <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 13 }}>Loading…</td></tr>

  return records.map((r, i) => (
    <tr key={i} style={{ background: 'var(--neutral-50)' }}>
      <td style={{ padding: '6px 16px 6px 32px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>{r.source_ip || '—'}</td>
      <td style={{ padding: '6px 16px', fontSize: 12, color: 'var(--neutral-600)' }}>{r.header_from || '—'}</td>
      <td style={{ padding: '6px 16px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: r.dkim_result === 'pass' ? '#dcfce7' : '#fee2e2', color: r.dkim_result === 'pass' ? '#16a34a' : '#dc2626' }}>DKIM {r.dkim_result}</span>
        {' '}
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: r.spf_result === 'pass' ? '#dcfce7' : '#fee2e2', color: r.spf_result === 'pass' ? '#16a34a' : '#dc2626' }}>SPF {r.spf_result}</span>
      </td>
      <td style={{ padding: '6px 16px', fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)' }}>{r.count?.toLocaleString()}</td>
      <td />
    </tr>
  ))
}

export function ReportsPage() {
  const { currentOrg } = useOrg()
  const { domains } = useDomains()
  const toast = useToast()
  const [reports, setReports]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [days, setDays]             = useState(30)
  const [filterDomain, setFilter]   = useState('all')
  const [expanded, setExpanded]     = useState(null)
  const [uploading, setUploading]   = useState(false)

  useEffect(() => { if (currentOrg) fetchReports() }, [currentOrg, days, filterDomain])

  async function fetchReports() {
    setLoading(true)
    const since = new Date(Date.now() - days * 86400000).toISOString()
    let q = supabase.from('dmarc_aggregate_reports')
      .select('*').eq('org_id', currentOrg.id)
      .gte('report_begin', since).order('report_begin', { ascending: false })
    if (filterDomain !== 'all') {
      const d = domains.find(d => d.id === filterDomain)
      if (d) q = q.eq('domain_id', filterDomain)
    }
    const { data } = await q
    setReports(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const xml = await file.text()
      const domain = xml.match(/<domain>([^<]+)<\/domain>/i)?.[1]?.trim()
      if (!domain) throw new Error('Could not find domain in XML')
      const domainRow = domains.find(d => d.domain.toLowerCase() === domain.toLowerCase())
      if (!domainRow) throw new Error(`Domain ${domain} not found in your account`)
      const res = await fetch('/api/ingest-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': 'dnsmonitor2024ingest' },
        body: JSON.stringify({ xml, domainId: domainRow.id, orgId: currentOrg.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast(`Report ingested — ${data.recordCount} records`, 'success')
      fetchReports()
    } catch (err) {
      toast(err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  // Aggregate stats from all report records
  const allRecords = reports.flatMap(r => r._records || [])

  // Compute summary from reports
  const totalReports = reports.length
  const domains_covered = [...new Set(reports.map(r => r.policy_domain))].length

  // We need record-level data for charts — fetch aggregate
  const [agg, setAgg] = useState({ pass: 0, fail: 0, total: 0, sources: [] })

  useEffect(() => {
    if (!reports.length) { setAgg({ pass: 0, fail: 0, total: 0, sources: [] }); return }
    const ids = reports.map(r => r.id)
    supabase.from('dmarc_report_records').select('*')
      .in('report_id', ids)
      .then(({ data }) => {
        const records = data || []
        const pass = records.filter(r => r.dkim_result === 'pass' && r.spf_result === 'pass').reduce((s, r) => s + (r.count || 0), 0)
        const total = records.reduce((s, r) => s + (r.count || 0), 0)
        // Source aggregation
        const srcMap = {}
        records.forEach(r => {
          const src = r.source_ip || 'unknown'
          if (!srcMap[src]) srcMap[src] = { count: 0, pass: 0 }
          srcMap[src].count += r.count || 0
          if (r.dkim_result === 'pass' && r.spf_result === 'pass') srcMap[src].pass += r.count || 0
        })
        const sources = Object.entries(srcMap)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 8)
          .map(([ip, v]) => ({ source: ip, count: v.count, passCount: v.pass }))
        setAgg({ pass, fail: total - pass, total, sources })
      })
  }, [reports])

  const pieData = [
    { name: 'DMARC Pass', value: agg.pass, color: C.pass },
    { name: 'DMARC Fail', value: agg.fail, color: C.fail },
  ].filter(d => d.value > 0)

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DMARC Reports</h1>
          <p>Aggregate report analysis for <strong>{currentOrg?.name}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input select" value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 'auto', fontSize: 13 }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <label className={`btn btn-secondary ${uploading ? 'btn-loading' : ''}`} style={{ cursor: 'pointer' }}>
            <Upload size={14} /><span>{uploading ? 'Uploading…' : 'Upload XML'}</span>
            <input type="file" accept=".xml,.gz,.zip" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* RUA setup banner */}
      <div className="alert-banner info" style={{ marginBottom: '1.5rem' }}>
        <Info size={15} />
        <span>Auto-ingest: add <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--brand-100)', padding: '1px 5px', borderRadius: 4 }}>rua=mailto:reports@pwonka.resend.app</code> to your DMARC record. Reports appear here automatically within 24h.</span>
      </div>

      {/* Domain filter */}
      <div style={{ marginBottom: '1.25rem' }}>
        <select className="input select" value={filterDomain} onChange={e => setFilter(e.target.value)} style={{ width: 'auto', fontSize: 13 }}>
          <option value="all">All domains</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><TrendingUp size={28} /></div>
            <p className="empty-title">No reports yet</p>
            <p className="empty-desc">Add <code style={{ fontFamily: 'var(--font-mono)' }}>rua=mailto:reports@pwonka.resend.app</code> to your DMARC record and reports will appear here automatically. Or upload an XML report manually.</p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={14} /><span>Upload XML report</span>
              <input type="file" accept=".xml,.gz,.zip" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            <StatCard label="Total emails" value={agg.total} color="#1a6bff" sub={`${totalReports} reports`} />
            <StatCard label="DMARC pass" value={agg.pass} color={C.pass} sub={agg.total ? `${Math.round((agg.pass/agg.total)*100)}% pass rate` : '—'} />
            <StatCard label="DMARC fail" value={agg.fail} color={C.fail} sub="Potential spoofing" />
            <StatCard label="Domains covered" value={domains_covered} color="#7c3aed" sub={`${days} day window`} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>DMARC volume breakdown</h4></div>
              <div className="card-body"><DonutChart data={pieData} /></div>
            </div>
            <div className="card">
              <div className="card-header"><h4 style={{ margin: 0 }}>Top sending sources</h4></div>
              <div className="card-body" style={{ padding: '0 1.25rem 1rem' }}>
                {agg.sources.length === 0
                  ? <div style={{ fontSize: 13, color: 'var(--neutral-400)', textAlign: 'center', padding: '1rem' }}>No source data</div>
                  : agg.sources.map((s, i) => <SourceRow key={i} {...s} total={agg.total} />)
                }
              </div>
            </div>
          </div>

          {/* Report list */}
          <div className="card">
            <div className="card-header"><h4 style={{ margin: 0 }}>Report history ({reports.length})</h4></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--neutral-50)' }}>
                  {['Sender / Domain', 'Period', 'Policy', 'Received', ''].map(h => (
                    <th key={h} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid var(--neutral-150)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <>
                    <ReportRow key={r.id} report={r} expanded={expanded === r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)} />
                    {expanded === r.id && <RecordDetail key={`d-${r.id}`} reportId={r.id} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
