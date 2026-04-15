import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { BarChart2, Users, Calendar, ChevronDown, CheckCircle2, Clock, ShieldCheck, UserPlus, X, Settings } from 'lucide-react'

const PM = {
  scm_enterprise: { label:'SCM Enterprise',         color:'#0D6E56', bg:'#E8F7F2', icon:'🏢' },
  private_pki:    { label:'Private PKI',             color:'#1A4FBA', bg:'#EBF0FD', icon:'🔒' },
  smime:          { label:'S/MIME Solutions',        color:'#4E35C2', bg:'#EDEBFC', icon:'✉️' },
  devops:         { label:'DevOps PKI',              color:'#0F5C8A', bg:'#E6F2FA', icon:'⚙️' },
  code_signing:   { label:'Code Signing',            color:'#2D6B1A', bg:'#EBF5E6', icon:'📝' },
  pqc:            { label:'PQC / Quantum Labs',      color:'#3C2E99', bg:'#EDEAFB', icon:'⚛️' },
  vmc_cmc:        { label:'VMC / CMC (BIMI)',        color:'#854F0B', bg:'#FEF3E0', icon:'🏷️' },
  ms_ca_mgmt:     { label:'Microsoft CA Management',color:'#0F3A8A', bg:'#E8EFFB', icon:'🖥️' },
}

const STATUS = {
  pending:       { label:'Pending',       color:'#92400E', bg:'#FFFBEB', border:'#FDE68A' },
  scheduled:     { label:'Scheduled',     color:'#1E40AF', bg:'#EFF6FF', border:'#BFDBFE' },
  completed:     { label:'Completed',     color:'#166534', bg:'#F0FDF4', border:'#BBF7D0' },
  quote_process: { label:'Quote Process', color:'#5B21B6', bg:'#F5F3FF', border:'#DDD6FE' },
}

export function PKISalesPanel() {
  const { currentOrg } = useOrg()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('pipeline')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [salesRoles, setSalesRoles] = useState([])
  const [orgMembers, setOrgMembers] = useState([])
  const [myRole, setMyRole] = useState(null)       // 'vp_sales' | 'account_manager' | null
  const [orgRole, setOrgRole] = useState(null)     // 'owner' | 'admin' | 'member' | 'viewer'
  const [updating, setUpdating] = useState(null)
  const [showAddRole, setShowAddRole] = useState(false)
  const [addRoleForm, setAddRoleForm] = useState({ user_id:'', role:'account_manager' })
  const [savingRole, setSavingRole] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const [editLead, setEditLead] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => { if (currentOrg?.id && user?.id) loadAll() }, [currentOrg?.id, user?.id])

  async function loadAll() {
    setLoading(true)
    const [leadsRes, rolesRes, membersRes, orgMemberRes] = await Promise.all([
      supabase.from('pki_leads')
        .select('*, profiles!pki_leads_account_manager_id_fkey(full_name)')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false }),
      supabase.from('pki_sales_roles')
        .select('*, profiles(full_name, id)')
        .eq('org_id', currentOrg.id),
      supabase.from('org_members')
        .select('*, profiles(full_name, id)')
        .eq('org_id', currentOrg.id)
        .not('accepted_at', 'is', null),
      supabase.from('org_members')
        .select('role')
        .eq('org_id', currentOrg.id)
        .eq('user_id', user.id)
        .single(),
    ])

    const roles = rolesRes.data || []
    const members = membersRes.data || []

    setLeads(leadsRes.data || [])
    setSalesRoles(roles)
    setOrgMembers(members)
    setOrgRole(orgMemberRes.data?.role || null)

    const mine = roles.find(r => r.user_id === user.id)
    setMyRole(mine?.role || null)
    setLoading(false)
  }

  // Auto-bootstrap: org owner/admin who has no sales role yet can claim VP Sales
  async function claimVPRole() {
    setBootstrapping(true)
    await supabase.from('pki_sales_roles').upsert(
      { org_id: currentOrg.id, user_id: user.id, role: 'vp_sales' },
      { onConflict: 'org_id,user_id' }
    )
    setBootstrapping(false)
    await loadAll()
  }

  const isVP = myRole === 'vp_sales'
  const isAM = myRole === 'account_manager' || isVP
  const canBootstrap = !isAM && ['owner','admin'].includes(orgRole)
  const visibleLeads = isVP ? leads : leads.filter(l => l.account_manager_id === user.id)

  const stats = {
    total: visibleLeads.length,
    pending: visibleLeads.filter(l => l.status === 'pending').length,
    scheduled: visibleLeads.filter(l => l.status === 'scheduled').length,
    completed: visibleLeads.filter(l => l.status === 'completed').length,
    quote: visibleLeads.filter(l => l.status === 'quote_process').length,
  }
  const byProduct = visibleLeads.reduce((acc, l) => { acc[l.product_routed] = (acc[l.product_routed]||0)+1; return acc }, {})
  const calLeads = visibleLeads.filter(l => l.meeting_date?.startsWith(calMonth))

  async function updateStatus(leadId, status) {
    setUpdating(leadId)
    await supabase.from('pki_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId)
    setUpdating(null)
    await loadAll()
  }

  async function saveNotes() {
    if (!editLead) return
    setSavingNotes(true)
    await supabase.from('pki_leads').update({ meeting_notes: editNotes, updated_at: new Date().toISOString() }).eq('id', editLead.id)
    setSavingNotes(false); setEditLead(null)
    await loadAll()
  }

  async function addSalesRole() {
    if (!addRoleForm.user_id) return
    setSavingRole(true)
    await supabase.from('pki_sales_roles').upsert(
      { org_id: currentOrg.id, user_id: addRoleForm.user_id, role: addRoleForm.role },
      { onConflict: 'org_id,user_id' }
    )
    setSavingRole(false); setShowAddRole(false)
    setAddRoleForm({ user_id:'', role:'account_manager' })
    await loadAll()
  }

  async function removeRole(userId) {
    if (!confirm('Remove this person\'s sales panel access?')) return
    await supabase.from('pki_sales_roles').delete().eq('org_id', currentOrg.id).eq('user_id', userId)
    await loadAll()
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
        <div style={{ textAlign:'center', color:'var(--neutral-400)', fontSize:'0.875rem' }}>Loading Sales Panel…</div>
      </div>
    )
  }

  // ── BOOTSTRAP SCREEN — org owner/admin who hasn't claimed a role yet ──────
  if (canBootstrap) {
    return (
      <div style={{ padding:'2rem', maxWidth:540, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:20, overflow:'hidden', boxShadow:'var(--shadow-md)' }}>
          <div style={{ background:'linear-gradient(135deg,#1A4FBA,#3C2E99)', padding:'2rem', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:18, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:32 }}>🏆</div>
            <h2 style={{ color:'white', fontSize:'1.25rem', fontWeight:700, margin:'0 0 6px' }}>Set Up Your Sales Panel</h2>
            <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'0.875rem', margin:0 }}>You're an org {orgRole} — claim your role to unlock the full sales dashboard.</p>
          </div>
          <div style={{ padding:'1.75rem' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
              {[
                { icon:'📊', title:'VP of Sales — Full access', desc:'See all leads, all account managers, pipeline analytics, team performance.', role:'vp_sales', color:'#3C2E99' },
                { icon:'👤', title:'Account Manager', desc:'See only your assigned leads and scheduled meetings.', role:'account_manager', color:'#1A4FBA' },
              ].map(opt => (
                <button
                  key={opt.role}
                  onClick={async () => {
                    setBootstrapping(true)
                    await supabase.from('pki_sales_roles').upsert(
                      { org_id: currentOrg.id, user_id: user.id, role: opt.role },
                      { onConflict: 'org_id,user_id' }
                    )
                    setBootstrapping(false)
                    await loadAll()
                  }}
                  disabled={bootstrapping}
                  style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 16px', background:'var(--neutral-50)', border:`2px solid var(--neutral-200)`, borderRadius:12, cursor:'pointer', textAlign:'left', transition:'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.border=`2px solid ${opt.color}`; e.currentTarget.style.background=`${opt.color}08` }}
                  onMouseLeave={e => { e.currentTarget.style.border='2px solid var(--neutral-200)'; e.currentTarget.style.background='var(--neutral-50)' }}
                >
                  <div style={{ width:42, height:42, borderRadius:12, background:opt.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{opt.icon}</div>
                  <div>
                    <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)', marginBottom:3 }}>{opt.title}</div>
                    <div style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', lineHeight:1.5 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <p style={{ fontSize:'0.75rem', color:'var(--neutral-400)', textAlign:'center', margin:0 }}>
              You can change this later from the Team tab inside the Sales Panel.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── NO ACCESS — non-owner, non-admin with no role ─────────────────────────
  if (!isAM) {
    return (
      <div style={{ padding:'2rem', maxWidth:500, margin:'0 auto', textAlign:'center' }}>
        <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, padding:'2.5rem', boxShadow:'var(--shadow-xs)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
          <h2 style={{ fontSize:'1.125rem', fontWeight:600, color:'var(--neutral-800)', marginBottom:8 }}>Sales Panel Access Required</h2>
          <p style={{ fontSize:'0.875rem', color:'var(--neutral-500)', lineHeight:1.6, margin:0 }}>
            You need to be assigned as an Account Manager or VP of Sales.<br/>
            Contact your organisation owner to get access.
          </p>
        </div>
      </div>
    )
  }

  // ── MAIN PANEL ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'1.5rem 2rem', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1A4FBA,#3C2E99)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BarChart2 size={17} color="white"/>
            </div>
            <h1 style={{ fontSize:'1.375rem', fontWeight:600, letterSpacing:'-0.02em', margin:0 }}>
              {isVP ? 'VP Sales Panel' : 'My Meetings'}
            </h1>
          </div>
          <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', margin:0, paddingLeft:44 }}>
            {isVP ? `Full pipeline · ${leads.length} total leads across ${salesRoles.filter(r=>r.role==='account_manager').length} account manager${salesRoles.filter(r=>r.role==='account_manager').length!==1?'s':''}` : `Your assigned leads · ${visibleLeads.length} total`}
          </p>
        </div>
        {isVP && (
          <button onClick={() => setShowAddRole(true)} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <UserPlus size={15}/> Add Team Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:'1.5rem', background:'var(--neutral-100)', borderRadius:10, padding:4, width:'fit-content' }}>
        {[
          { id:'pipeline', label:'Pipeline', icon:<ShieldCheck size={14}/> },
          { id:'calendar', label:'Calendar', icon:<Calendar size={14}/> },
          ...(isVP ? [{ id:'team', label:'Team', icon:<Users size={14}/> }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', background: tab===t.id ? 'white' : 'transparent', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.8125rem', fontWeight: tab===t.id ? 600 : 400, color: tab===t.id ? 'var(--neutral-800)' : 'var(--neutral-500)', boxShadow: tab===t.id ? 'var(--shadow-xs)' : 'none', transition:'all 0.12s' }}>
            {t.icon} {t.label}
            {t.id === 'pipeline' && stats.pending > 0 && <span style={{ background:'#EF4444', color:'white', borderRadius:20, fontSize:10, fontWeight:700, padding:'1px 6px', marginLeft:2 }}>{stats.pending}</span>}
          </button>
        ))}
      </div>

      {/* ── PIPELINE ─────────────────────────────────────────────────────── */}
      {tab === 'pipeline' && (
        <>
          {/* Stat cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
            {[
              { label:'Total Leads',    val:stats.total,    color:'var(--neutral-700)', bg:'white',               border:'var(--neutral-150)' },
              { label:'Pending',        val:stats.pending,  color:STATUS.pending.color,       bg:STATUS.pending.bg,       border:STATUS.pending.border },
              { label:'Scheduled',      val:stats.scheduled,color:STATUS.scheduled.color,     bg:STATUS.scheduled.bg,     border:STATUS.scheduled.border },
              { label:'Completed',      val:stats.completed,color:STATUS.completed.color,     bg:STATUS.completed.bg,     border:STATUS.completed.border },
              { label:'Quote Process',  val:stats.quote,    color:STATUS.quote_process.color, bg:STATUS.quote_process.bg, border:STATUS.quote_process.border },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:'1.75rem', fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)', marginTop:5 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Product breakdown (VP) */}
          {isVP && Object.keys(byProduct).length > 0 && (
            <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, padding:'1rem 1.25rem', marginBottom:16 }}>
              <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:10, fontWeight:600 }}>Pipeline by product</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {Object.entries(byProduct).sort((a,b) => b[1]-a[1]).map(([prod, count]) => {
                  const pm = PM[prod] || PM.scm_enterprise
                  const pct = Math.round((count / leads.length) * 100)
                  return (
                    <div key={prod} style={{ display:'flex', alignItems:'center', gap:7, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:9, padding:'6px 12px' }}>
                      <span style={{ fontSize:14 }}>{pm.icon}</span>
                      <span style={{ fontSize:'0.8125rem', fontWeight:600, color:pm.color }}>{pm.label}</span>
                      <span style={{ fontSize:'0.75rem', fontWeight:700, color:'white', background:pm.color, borderRadius:20, padding:'1px 7px' }}>{count}</span>
                      <span style={{ fontSize:'0.75rem', color:pm.color, opacity:0.7 }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leads table */}
          {visibleLeads.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem 2rem', background:'white', border:'1px dashed var(--neutral-200)', borderRadius:14 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <h3 style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-700)', marginBottom:6 }}>No leads yet</h3>
              <p style={{ fontSize:'0.875rem', color:'var(--neutral-500)', margin:0 }}>
                {isVP ? 'Run a discovery session, book a meeting, and it will appear here.' : 'No leads have been assigned to you yet.'}
              </p>
            </div>
          ) : (
            <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, overflow:'auto', boxShadow:'var(--shadow-xs)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead>
                  <tr style={{ background:'var(--neutral-50)', borderBottom:'1px solid var(--neutral-150)' }}>
                    {['Customer','Company','Country','Product','Meeting','Status',isVP?'Account Manager':'','Notes'].filter(h=>h!=='').map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--neutral-500)', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead, i) => {
                    const pm = PM[lead.product_routed] || PM.scm_enterprise
                    const st = STATUS[lead.status] || STATUS.pending
                    return (
                      <tr key={lead.id} style={{ borderTop: i > 0 ? '1px solid var(--neutral-100)' : 'none', background: i % 2 === 0 ? 'white' : 'var(--neutral-50)' }}>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--neutral-800)' }}>{lead.first_name} {lead.last_name}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--neutral-400)', marginTop:1 }}>{lead.email}</div>
                        </td>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ fontSize:'0.875rem', color:'var(--neutral-700)' }}>{lead.company_name}</div>
                        </td>
                        <td style={{ padding:'11px 12px', fontSize:'0.8125rem', color:'var(--neutral-500)' }}>{lead.country}</td>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:7, padding:'3px 8px', width:'fit-content', whiteSpace:'nowrap' }}>
                            <span style={{ fontSize:11 }}>{pm.icon}</span>
                            <span style={{ fontSize:'0.6875rem', fontWeight:600, color:pm.color }}>{pm.label}</span>
                          </div>
                        </td>
                        <td style={{ padding:'11px 12px' }}>
                          {lead.meeting_date ? (
                            <div>
                              <div style={{ fontSize:'0.8125rem', color:'var(--neutral-700)', fontWeight:500 }}>
                                {new Date(lead.meeting_date+'T00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                              </div>
                              {lead.meeting_time && <div style={{ fontSize:'0.75rem', color:'var(--neutral-400)', display:'flex', alignItems:'center', gap:3 }}><Clock size={11}/>{lead.meeting_time}</div>}
                            </div>
                          ) : <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>Not scheduled</span>}
                        </td>
                        <td style={{ padding:'11px 12px' }}>
                          <div style={{ position:'relative', display:'inline-block' }}>
                            <select
                              value={lead.status}
                              onChange={e => updateStatus(lead.id, e.target.value)}
                              disabled={updating === lead.id}
                              style={{ appearance:'none', WebkitAppearance:'none', padding:'5px 28px 5px 10px', fontSize:'0.75rem', fontWeight:600, color:st.color, background:st.bg, border:`1px solid ${st.border}`, borderRadius:8, cursor:'pointer', outline:'none' }}
                            >
                              {Object.entries(STATUS).map(([val,meta]) => <option key={val} value={val}>{meta.label}</option>)}
                            </select>
                            <ChevronDown size={10} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', color:st.color, pointerEvents:'none' }}/>
                          </div>
                        </td>
                        {isVP && (
                          <td style={{ padding:'11px 12px' }}>
                            <span style={{ fontSize:'0.8125rem', color: lead.profiles?.full_name ? 'var(--neutral-700)' : 'var(--neutral-400)' }}>
                              {lead.profiles?.full_name || 'Unassigned'}
                            </span>
                          </td>
                        )}
                        <td style={{ padding:'11px 12px' }}>
                          <button
                            onClick={() => { setEditLead(lead); setEditNotes(lead.meeting_notes||'') }}
                            style={{ background: lead.meeting_notes ? 'var(--info-50)' : 'var(--neutral-50)', border:`1px solid ${lead.meeting_notes ? 'var(--info-500)' : 'var(--neutral-200)'}22`, borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', color: lead.meeting_notes ? 'var(--info-600)' : 'var(--neutral-500)', fontWeight:500, whiteSpace:'nowrap' }}
                          >
                            {lead.meeting_notes ? '📝 Edit' : '+ Notes'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── CALENDAR ─────────────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <button onClick={() => { const [y,m] = calMonth.split('-').map(Number); const d = new Date(y,m-2,1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }} style={{ background:'white', border:'1px solid var(--neutral-200)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:'0.8125rem', fontWeight:500 }}>← Prev</button>
            <div style={{ fontSize:'1.0625rem', fontWeight:700, color:'var(--neutral-800)', minWidth:160, textAlign:'center' }}>
              {new Date(calMonth+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
            </div>
            <button onClick={() => { const [y,m] = calMonth.split('-').map(Number); const d = new Date(y,m,1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }} style={{ background:'white', border:'1px solid var(--neutral-200)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:'0.8125rem', fontWeight:500 }}>Next →</button>
            <div style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', background:'var(--neutral-100)', borderRadius:8, padding:'6px 12px' }}>
              {calLeads.length} meeting{calLeads.length!==1?'s':''} this month
            </div>
          </div>

          {calLeads.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem 2rem', background:'white', border:'1px dashed var(--neutral-200)', borderRadius:14 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
              <h3 style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-700)', marginBottom:6 }}>No meetings this month</h3>
              <p style={{ fontSize:'0.875rem', color:'var(--neutral-500)', margin:0 }}>Book a meeting from the discovery result to see it here.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[...calLeads].sort((a,b) => (a.meeting_date+a.meeting_time) > (b.meeting_date+b.meeting_time) ? 1 : -1).map(lead => {
                const pm = PM[lead.product_routed] || PM.scm_enterprise
                const st = STATUS[lead.status] || STATUS.pending
                const dayNum = new Date(lead.meeting_date+'T00:00').getDate()
                const monthShort = new Date(lead.meeting_date+'T00:00').toLocaleDateString('en-GB',{month:'short'})
                return (
                  <div key={lead.id} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', boxShadow:'var(--shadow-xs)' }}>
                    <div style={{ background:pm.color, borderRadius:14, padding:'10px 14px', textAlign:'center', flexShrink:0, minWidth:52 }}>
                      <div style={{ fontSize:'1.375rem', fontWeight:700, color:'white', lineHeight:1 }}>{dayNum}</div>
                      <div style={{ fontSize:'0.6875rem', color:'rgba(255,255,255,0.75)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>{monthShort}</div>
                    </div>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                        <span style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)' }}>{lead.first_name} {lead.last_name}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>·</span>
                        <span style={{ fontSize:'0.875rem', color:'var(--neutral-600)' }}>{lead.company_name}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)', background:'var(--neutral-100)', borderRadius:6, padding:'1px 7px' }}>{lead.country}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:6, padding:'2px 8px' }}>
                          <span style={{ fontSize:11 }}>{pm.icon}</span>
                          <span style={{ fontSize:'0.6875rem', fontWeight:600, color:pm.color }}>{pm.label}</span>
                        </div>
                        {lead.meeting_time && <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.8125rem', color:'var(--neutral-500)', fontWeight:500 }}><Clock size={13}/>{lead.meeting_time}</div>}
                        {isVP && lead.profiles?.full_name && <span style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>AM: {lead.profiles.full_name}</span>}
                        {lead.meeting_notes && <span style={{ fontSize:'0.75rem', color:'var(--info-600)', background:'var(--info-50)', borderRadius:6, padding:'1px 7px' }}>📝 Has notes</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <div style={{ position:'relative' }}>
                        <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)} style={{ appearance:'none', WebkitAppearance:'none', padding:'6px 28px 6px 10px', fontSize:'0.75rem', fontWeight:600, color:st.color, background:st.bg, border:`1px solid ${st.border}`, borderRadius:8, cursor:'pointer', outline:'none' }}>
                          {Object.entries(STATUS).map(([val,meta]) => <option key={val} value={val}>{meta.label}</option>)}
                        </select>
                        <ChevronDown size={10} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', color:st.color, pointerEvents:'none' }}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM (VP only) ────────────────────────────────────────────────── */}
      {tab === 'team' && isVP && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start' }}>
          {/* Team roster */}
          <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid var(--neutral-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)' }}>Sales Team</div>
              <button onClick={() => setShowAddRole(true)} style={{ display:'flex', alignItems:'center', gap:5, background:'var(--brand-500)', color:'white', border:'none', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:'0.75rem', fontWeight:600 }}><UserPlus size={13}/> Add</button>
            </div>
            {salesRoles.length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--neutral-400)', fontSize:'0.875rem' }}>No team members yet.</div>
            ) : salesRoles.map((r, i) => {
              const amLeads = leads.filter(l => l.account_manager_id === r.user_id)
              return (
                <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1.25rem', borderTop: i>0?'1px solid var(--neutral-100)':'none', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${r.role==='vp_sales'?'#3C2E99,#1A4FBA':'#0D6E56,#1A4FBA'})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.875rem', fontWeight:700, color:'white', flexShrink:0 }}>
                      {(r.profiles?.full_name||'?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--neutral-800)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.profiles?.full_name || 'Unknown'}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>{amLeads.length} lead{amLeads.length!==1?'s':''} assigned</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                    <span style={{ fontSize:'0.6875rem', fontWeight:700, color: r.role==='vp_sales'?'#5B21B6':'#1E40AF', background: r.role==='vp_sales'?'#F5F3FF':'#EFF6FF', border:`1px solid ${r.role==='vp_sales'?'#DDD6FE':'#BFDBFE'}`, borderRadius:6, padding:'3px 8px', whiteSpace:'nowrap' }}>
                      {r.role === 'vp_sales' ? 'VP Sales' : 'Acct Mgr'}
                    </span>
                    {r.user_id !== user.id && (
                      <button onClick={() => removeRole(r.user_id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', padding:3, display:'flex', alignItems:'center' }} title="Remove"><X size={14}/></button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AM Performance */}
          <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid var(--neutral-100)', fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)' }}>AM Performance</div>
            {salesRoles.filter(r=>r.role==='account_manager').length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--neutral-400)', fontSize:'0.875rem' }}>No account managers assigned yet.</div>
            ) : salesRoles.filter(r=>r.role==='account_manager').map((r, i) => {
              const amLeads = leads.filter(l => l.account_manager_id === r.user_id)
              const completed = amLeads.filter(l => l.status==='completed').length
              const inProgress = amLeads.filter(l => ['scheduled','quote_process'].includes(l.status)).length
              const pct = amLeads.length > 0 ? Math.round((completed/amLeads.length)*100) : 0
              return (
                <div key={r.id} style={{ padding:'1rem 1.25rem', borderTop: i>0?'1px solid var(--neutral-100)':'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#0D6E56,#1A4FBA)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'white', flexShrink:0 }}>
                        {(r.profiles?.full_name||'?').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--neutral-800)' }}>{r.profiles?.full_name || 'Unknown'}</span>
                    </div>
                    <span style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>{completed}/{amLeads.length} done</span>
                  </div>
                  <div style={{ height:6, background:'var(--neutral-150)', borderRadius:4, overflow:'hidden', marginBottom:6 }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#22C55E,#16A34A)', borderRadius:4, transition:'width 0.6s ease' }}/>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    {[{label:`${amLeads.filter(l=>l.status==='pending').length} pending`,color:'#92400E',bg:'#FFFBEB'},{label:`${inProgress} active`,color:'#1E40AF',bg:'#EFF6FF'},{label:`${pct}% close rate`,color:'#166534',bg:'#F0FDF4'}].map(chip=>(
                      <span key={chip.label} style={{ fontSize:'0.6875rem', fontWeight:600, color:chip.color, background:chip.bg, borderRadius:6, padding:'2px 7px' }}>{chip.label}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ADD ROLE MODAL ────────────────────────────────────────────────── */}
      {showAddRole && (
        <div style={{ position:'fixed', inset:0, background:'rgba(14,22,36,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'white', borderRadius:20, padding:'1.75rem', width:'100%', maxWidth:400, boxShadow:'var(--shadow-xl)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>Add team member</div>
              <button onClick={() => setShowAddRole(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', fontSize:22, lineHeight:1 }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Organisation member</label>
                <select className="input" value={addRoleForm.user_id} onChange={e=>setAddRoleForm(p=>({...p,user_id:e.target.value}))} style={{ cursor:'pointer' }}>
                  <option value="">Select member…</option>
                  {orgMembers.filter(m => !salesRoles.find(r=>r.user_id===m.user_id)).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.user_id}</option>
                  ))}
                </select>
                {orgMembers.filter(m => !salesRoles.find(r=>r.user_id===m.user_id)).length === 0 && (
                  <p style={{ fontSize:'0.75rem', color:'var(--neutral-400)', marginTop:5 }}>All org members already have sales roles.</p>
                )}
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Sales role</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[{val:'account_manager',label:'Account Manager',icon:'👤'},{val:'vp_sales',label:'VP of Sales',icon:'🏆'}].map(opt => (
                    <button key={opt.val} onClick={() => setAddRoleForm(p=>({...p,role:opt.val}))} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background: addRoleForm.role===opt.val ? '#EFF6FF' : 'var(--neutral-50)', border:`2px solid ${addRoleForm.role===opt.val ? '#3B82F6' : 'var(--neutral-200)'}`, borderRadius:10, cursor:'pointer', textAlign:'left' }}>
                      <span style={{ fontSize:18 }}>{opt.icon}</span>
                      <span style={{ fontSize:'0.8125rem', fontWeight:600, color: addRoleForm.role===opt.val ? '#1E40AF' : 'var(--neutral-700)' }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddRole(false)} style={{ flex:1 }}>Cancel</button>
              <button className={`btn btn-primary ${savingRole?'btn-loading':''}`} onClick={addSalesRole} disabled={savingRole||!addRoleForm.user_id} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {savingRole?'':<><CheckCircle2 size={15}/> Assign role</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTES MODAL ───────────────────────────────────────────────────── */}
      {editLead && (
        <div style={{ position:'fixed', inset:0, background:'rgba(14,22,36,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'white', borderRadius:20, padding:'1.75rem', width:'100%', maxWidth:480, boxShadow:'var(--shadow-xl)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>Meeting Notes</div>
                <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)', marginTop:2 }}>{editLead.first_name} {editLead.last_name} · {editLead.company_name}</div>
              </div>
              <button onClick={() => setEditLead(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', fontSize:22, lineHeight:1 }}>×</button>
            </div>
            <textarea className="input" rows={6} placeholder="Add meeting notes, budget signals, follow-up actions, requirements discussed…" value={editNotes} onChange={e=>setEditNotes(e.target.value)} style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6, marginBottom:12 }}/>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" onClick={() => setEditLead(null)} style={{ flex:1 }}>Cancel</button>
              <button className={`btn btn-primary ${savingNotes?'btn-loading':''}`} onClick={saveNotes} disabled={savingNotes} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {savingNotes?'':<><CheckCircle2 size={15}/> Save notes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
