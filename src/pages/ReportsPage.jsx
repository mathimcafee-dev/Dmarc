import { useState, useEffect, useCallback } from 'react'
import { Shield, Upload, CheckCircle, AlertTriangle, XCircle, Globe, Server, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useDomains } from '../hooks/useDomains'
import { useToast } from '../components/ui/Toast'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  pass: '#22c55e',
  fail: '#ef4444',
  none: '#94a3b8',
  quarantine: '#f59e0b',
  reject: '#22c55e',
}

function ResultBadge({ result }) {
  const map = {
    pass: 'badge-success',
    fail: 'badge-danger',
    none: 'badge-neutral',
  }
  return <span className={`badge ${map[result] || 'badge-neutral'}`}>{result || '—'}</span>
}

function ReportCard({ report, onClick }) {
  const begin = report.report_begin ? new Date(report.report_begin).toLocaleDateString('en-IN') : '—'
  const end = report.report_end ? new Date(report.report_end).toLocaleDateString('en-IN') : '—'
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }}>
      <td><span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-800)' }}>{report.org_name || '—'}</span></td>
      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{report.policy_domain || '—'}</span></td>
      <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-600)' }}>{begin} → {end}</span></td>
      <td>
        {report.policy_p && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: COLORS[report.policy_p] || 'var(--neutral-600)' }}>p={report.policy_p}</span>
        )}
      </td>
      <td><span style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>{new Date(report.created_at).toLocaleDateString('en-IN')}</span></td>
    </tr>
  )
}

function ReportDetail({ reportId, onClose }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('dmarc_report_records').select('*').eq('report_id', reportId).order('count', { ascending: false })
      .then(({ data }) => { setRecords(data || []); setLoading(false) })
  }, [reportId])

  const totalEmails = records.reduce((s, r) => s + (r.count || 0), 0)
  const passing = records.filter(r => r.dkim_result === 'pass' && r.spf_result === 'pass').reduce((s, r) => s + r.count, 0)
  const failing = totalEmails - passing

  const pieData = [
    { name: 'DMARC Pass', value: passing },
    { name: 'DMARC Fail', value: failing },
  ].filter(d => d.value > 0)

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginBottom: '1rem', paddingLeft: 0 }}>← Back to reports</button>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-card"><div className="stat-label">Total emails</div><div className="stat-value">{totalEmails.toLocaleString('en-IN')}</div></div>
            <div className="stat-card"><div className="stat-label">DMARC Pass</div><div className="stat-value" style={{ color: 'var(--success-500)' }}>{passing.toLocaleString('en-IN')}</div><div className="stat-sub">{totalEmails ? Math.round((passing / totalEmails) * 100) : 0}%</div></div>
            <div className="stat-card"><div className="stat-label">DMARC Fail</div><div className="stat-value" style={{ color: failing > 0 ? 'var(--danger-500)' : 'var(--success-500)' }}>{failing.toLocaleString('en-IN')}</div><div className="stat-sub">{totalEmails ? Math.round((failing / totalEmails) * 100) : 0}%</div></div>
            <div className="stat-card"><div className="stat-label">Sending IPs</div><div className="stat-value">{records.length}</div></div>
          </div>

          {pieData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Pass/Fail split</h4></div>
                <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={i === 0 ? COLORS.pass : COLORS.fail} />)}
                      </Pie>
                      <Tooltip formatter={(v) => v.toLocaleString('en-IN')} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h4 style={{ margin: 0 }}>Top senders by volume</h4></div>
                <div className="card-body" style={{ padding: '0.75rem' }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={records.slice(0, 5)} margin={{ left: -20 }}>
                      <XAxis dataKey="source_ip" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--brand-500)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Source IP</th><th>Count</th><th>Disposition</th><th>DKIM</th><th>SPF</th><th>From</th></tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{r.source_ip}</code></td>
                    <td><strong>{r.count?.toLocaleString('en-IN')}</strong></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: r.disposition === 'none' ? 'var(--success-600)' : 'var(--danger-600)', fontWeight: 600 }}>{r.disposition}</span></td>
                    <td><ResultBadge result={r.dkim_result} /></td>
                    <td><ResultBadge result={r.spf_result} /></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{r.header_from}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export function ReportsPage() {
  const { currentOrg } = useOrg()
  const { domains } = useDomains()
  const toast = useToast()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [filterDomain, setFilterDomain] = useState('all')
  const [uploading, setUploading] = useState(false)

  const fetchReports = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    let query = supabase.from('dmarc_aggregate_reports').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(100)
    if (filterDomain !== 'all') query = query.eq('domain_id', filterDomain)
    const { data } = await query
    setReports(data || [])
    setLoading(false)
  }, [currentOrg, filterDomain])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function handleXMLUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.zip')) {
      toast('Upload a .xml DMARC report file', 'error'); return
    }
    setUploading(true)
    try {
      const text = await file.text()
      // Find domain in report
      const domainMatch = text.match(/<domain>([^<]+)<\/domain>/)
      const reportDomain = domainMatch?.[1]
      const matchedDomain = domains.find(d => d.domain === reportDomain)

      if (!matchedDomain) {
        toast(`Domain ${reportDomain} is not in your monitored list. Add it first.`, 'error')
        setUploading(false)
        return
      }

      const res = await fetch('/api/ingest-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': 'local-dev' },
        body: JSON.stringify({ xml: text, domainId: matchedDomain.id, orgId: currentOrg.id }),
      })
      const result = await res.json()
      if (result.success) {
        toast(`Report ingested: ${result.recordCount} sending sources`, 'success')
        fetchReports()
      } else {
        toast(result.error || 'Ingest failed', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  if (selectedReport) {
    return (
      <div className="page-content fade-in">
        <ReportDetail reportId={selectedReport} onClose={() => setSelectedReport(null)} />
      </div>
    )
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>DMARC Reports</h1>
          <p>Analyse aggregate reports (RUA) to understand who's sending email as your domain.</p>
        </div>
        <label className={`btn btn-primary ${uploading ? 'btn-loading' : ''}`} style={{ cursor: 'pointer' }}>
          {!uploading && <><Upload size={15} /><span>Upload XML</span></>}
          <input type="file" accept=".xml" onChange={handleXMLUpload} style={{ display: 'none' }} />
        </label>
      </div>

      <div className="alert-banner info" style={{ marginBottom: '1.5rem' }}>
        <Shield size={15} />
        <span>To receive DMARC reports automatically, add <code style={{ fontFamily: 'var(--font-mono)' }}>rua=mailto:your@email.com</code> to your DMARC record. Mail providers will send XML reports daily. Upload them here or set up a mail-to-webhook bridge.</span>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '1.25rem' }}>
        <select className="input select" value={filterDomain} onChange={e => setFilterDomain(e.target.value)} style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.75rem', fontSize: '0.8125rem' }}>
          <option value="all">All domains</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><TrendingUp size={28} /></div>
            <p className="empty-title">No DMARC reports yet</p>
            <p className="empty-desc">Upload a DMARC aggregate XML report to see sending source analysis. Mail providers send these daily to your <code style={{ fontFamily: 'var(--font-mono)' }}>rua=</code> address.</p>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={15} /><span>Upload your first report</span>
              <input type="file" accept=".xml" onChange={handleXMLUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Reporting org</th><th>Domain</th><th>Report period</th><th>Policy</th><th>Received</th></tr></thead>
            <tbody>
              {reports.map(r => <ReportCard key={r.id} report={r} onClick={() => setSelectedReport(r.id)} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
