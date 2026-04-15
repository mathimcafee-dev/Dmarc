import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { BarChart2, Users, Calendar, ChevronDown, CheckCircle2, Clock, Cpu, ShieldCheck, UserPlus, X } from 'lucide-react'

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

const ORG_ROLES = ['account_manager','vp_sales']

export function PKISalesPanel() {
  const { currentOrg } = useOrg()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('pipeline')   // pipeline | calendar | team
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [salesRoles, setSalesRoles] = useState([])
  const [orgMembers, setOrgMembers] = useState([])
  const [myRole, setMyRole] = useState(null)
  // status update
  const [updating, setUpdating] = useState(null)
  // add role modal
  const [showAddRole, setShowAddRole] = useState(false)
  const [addRoleForm, setAddRoleForm] = useState({ user_id:'', role:'account_manager' })
  const [savingRole, setSavingRole] = useState(false)
  // calendar filter
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  // notes modal
  const [editLead, setEditLead] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => { if (currentOrg?.id) { loadAll() } }, [currentOrg?.id])

  async function loadAll() {
    setLoading(true)
    const [leadsRes, rolesRes, membersRes] = await Promise.all([
      supabase.from('pki_leads').select('*, profiles!pki_leads_account_manager_id_fkey(full_name)').eq('org_id', currentOrg.id).order('created_at', { ascending: false }),
      supabase.from('pki_sales_roles').select('*, profiles(full_name, id)').eq('org_id', currentOrg.id),
      supabase.from('org_members').select('*, profiles(full_name, id)').eq('org_id', currentOrg.id).not('accepted_at', 'is', null),
    ])
    setLeads(leadsRes.data || [])
    setSalesRoles(rolesRes.data || [])
    setOrgMembers(membersRes.data || [])
    // determine my role in sales panel
    const mine = rolesRes.data?.find(r => r.user_id === user.id)
    setMyRole(mine?.role || null)
    setLoading(false)
  }

  const isVP = myRole === 'vp_sales'
  const isAM = myRole === 'account_manager' || isVP

  // Filter leads for AM: only their assigned leads
  const visibleLeads = isVP ? leads : leads.filter(l => l.account_manager_id === user.id)

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
    setSavingNotes(false)
    setEditLead(null)
    await loadAll()
  }

  async function addSalesRole() {
    if (!addRoleForm.user_id) return
    setSavingRole(true)
    await supabase.from('pki_sales_roles').upsert({ org_id: currentOrg.id, user_id: addRoleForm.user_id, role: addRoleForm.role }, { onConflict: 'org_id,user_id' })
    setSavingRole(false)
    setShowAddRole(false)
    setAddRoleForm({ user_id:'', role:'account_manager' })
    await loadAll()
  }

  async function removeRole(userId) {
    await supabase.from('pki_sales_roles').delete().eq('org_id', currentOrg.id).eq('user_id', userId)
    await loadAll()
  }

  // ── Stats for VP ──────────────────────────────────────────────────────────
  const stats = {
    total: visibleLeads.length,
    pending: visibleLeads.filter(l=>l.status==='pending').length,
    scheduled: visibleLeads.filter(l=>l.status==='scheduled').length,
    completed: visibleLeads.filter(l=>l.status==='completed').length,
    quote: visibleLeads.filter(l=>l.status==='quote_process').length,
  }

  // Product breakdown
  const byProduct = visibleLeads.reduce((acc, l) => { acc[l.product_routed] = (acc[l.product_routed]||0)+1; return acc }, {})

  // Calendar leads for selected month
  const calLeads = visibleLeads.filter(l => l.meeting_date?.startsWith(calMonth))

  // Access guard
  if (!loading && !isAM) {
    return (
      <div style={{ padding:'2rem', maxWidth:600, textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:16, background:'var(--neutral-100)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>🔒</div>
        <h2 style={{ fontSize:'1.125rem', fontWeight:600, color:'var(--neutral-800)', marginBottom:8 }}>Sales Panel Access Required</h2>
        <p style={{ fontSize:'0.875rem', color:'var(--neutral-500)', lineHeight:1.6 }}>
          You need to be assigned as an Account Manager or VP of Sales to access this panel. Contact your organisation owner to get access.
        </p>
      </div>
    )
  }

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
            {isVP ? 'Full pipeline visibility across all account managers' : 'Your assigned discovery meetings and leads'}
          </p>
        </div>
        {isVP && (
          <button onClick={() => setShowAddRole(true)} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <UserPlus size={15}/> Manage Team
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:'1.5rem', background:'var(--neutral-100)', borderRadius:10, padding:4, width:'fit-content' }}>
        {[
          {id:'pipeline', label:'Pipeline', icon:<ShieldCheck size={14}/>},
          {id:'calendar', label:'Calendar', icon:<Calendar size={14}/>},
          ...(isVP ? [{id:'team', label:'Team', icon:<Users size={14}/>}] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', background: tab===t.id ? 'white' : 'transparent', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.8125rem', fontWeight: tab===t.id ? 600 : 400, color: tab===t.id ? 'var(--neutral-800)' : 'var(--neutral-500)', boxShadow: tab===t.id ? 'var(--shadow-xs)' : 'none', transition:'all 0.12s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--neutral-400)' }}>Loading…</div> : <>

      {/* ── PIPELINE TAB ─────────────────────────────────────────────────── */}
      {tab === 'pipeline' && (
        <>
          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
            {[
              {label:'Total leads',val:stats.total,color:'var(--neutral-700)',bg:'white'},
              {label:'Pending',val:stats.pending,color:STATUS.pending.color,bg:STATUS.pending.bg},
              {label:'Scheduled',val:stats.scheduled,color:STATUS.scheduled.color,bg:STATUS.scheduled.bg},
              {label:'Completed',val:stats.completed,color:STATUS.completed.color,bg:STATUS.completed.bg},
              {label:'Quote Process',val:stats.quote,color:STATUS.quote_process.color,bg:STATUS.quote_process.bg},
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, border:`1px solid var(--neutral-150)`, borderRadius:12, padding:'12px 16px' }}>
                <div style={{ fontSize:'1.5rem', fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)', marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Product breakdown (VP only) */}
          {isVP && Object.keys(byProduct).length > 0 && (
            <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, padding:'1rem 1.25rem', marginBottom:16 }}>
              <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:10, fontWeight:600 }}>Leads by product</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {Object.entries(byProduct).map(([prod, count]) => {
                  const pm = PM[prod] || PM.scm_enterprise
                  return (
                    <div key={prod} style={{ display:'flex', alignItems:'center', gap:6, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:8, padding:'5px 12px' }}>
                      <span>{pm.icon}</span>
                      <span style={{ fontSize:'0.8125rem', fontWeight:600, color:pm.color }}>{pm.label}</span>
                      <span style={{ fontSize:'0.8125rem', fontWeight:700, color:pm.color, background:`${pm.color}22`, borderRadius:20, width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leads table */}
          {visibleLeads.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', background:'white', border:'1px dashed var(--neutral-200)', borderRadius:14 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
              <p style={{ color:'var(--neutral-500)', fontSize:'0.875rem' }}>No leads yet. Run a discovery session and book a meeting to see it here.</p>
            </div>
          ) : (
            <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-xs)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--neutral-50)' }}>
                    {['Customer','Company','Country','Product','Meeting','Status',isVP?'AM':'','Notes'].filter(Boolean).map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--neutral-500)', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead, i) => {
                    const pm = PM[lead.product_routed] || PM.scm_enterprise
                    const st = STATUS[lead.status] || STATUS.pending
                    return (
                      <tr key={lead.id} style={{ borderTop: i > 0 ? '1px solid var(--neutral-100)' : 'none' }}>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--neutral-800)' }}>{lead.first_name} {lead.last_name}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>{lead.email}</div>
                        </td>
                        <td style={{ padding:'10px 12px', fontSize:'0.8125rem', color:'var(--neutral-700)' }}>{lead.company_name}</td>
                        <td style={{ padding:'10px 12px', fontSize:'0.8125rem', color:'var(--neutral-500)' }}>{lead.country}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:7, padding:'3px 8px', width:'fit-content' }}>
                            <span style={{ fontSize:11 }}>{pm.icon}</span>
                            <span style={{ fontSize:'0.6875rem', fontWeight:600, color:pm.color, whiteSpace:'nowrap' }}>{pm.label}</span>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          {lead.meeting_date ? (
                            <div>
                              <div style={{ fontSize:'0.8125rem', color:'var(--neutral-700)', fontWeight:500 }}>{new Date(lead.meeting_date+'T00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
                              {lead.meeting_time && <div style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>{lead.meeting_time}</div>}
                            </div>
                          ) : <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>—</span>}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ position:'relative' }}>
                            <select
                              value={lead.status}
                              onChange={e => updateStatus(lead.id, e.target.value)}
                              disabled={updating === lead.id}
                              style={{ appearance:'none', padding:'4px 28px 4px 10px', fontSize:'0.75rem', fontWeight:600, color:st.color, background:st.bg, border:`1px solid ${st.border}`, borderRadius:7, cursor:'pointer', outline:'none' }}
                            >
                              {Object.entries(STATUS).map(([val,meta]) => <option key={val} value={val}>{meta.label}</option>)}
                            </select>
                            <ChevronDown size={10} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', color:st.color, pointerEvents:'none' }}/>
                          </div>
                        </td>
                        {isVP && (
                          <td style={{ padding:'10px 12px', fontSize:'0.8125rem', color:'var(--neutral-600)' }}>
                            {lead.profiles?.full_name || <span style={{ color:'var(--neutral-400)' }}>Unassigned</span>}
                          </td>
                        )}
                        <td style={{ padding:'10px 12px' }}>
                          <button
                            onClick={() => { setEditLead(lead); setEditNotes(lead.meeting_notes||'') }}
                            style={{ background:'var(--neutral-50)', border:'1px solid var(--neutral-200)', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:'0.75rem', color:'var(--neutral-600)', fontWeight:500 }}
                          >
                            {lead.meeting_notes ? 'Edit' : 'Add'}
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

      {/* ── CALENDAR TAB ─────────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <button onClick={() => { const [y,m] = calMonth.split('-').map(Number); const d = new Date(y,m-2,1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }} style={{ background:'white', border:'1px solid var(--neutral-200)', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.8125rem' }}>← Prev</button>
            <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>
              {new Date(calMonth+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
            </div>
            <button onClick={() => { const [y,m] = calMonth.split('-').map(Number); const d = new Date(y,m,1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }} style={{ background:'white', border:'1px solid var(--neutral-200)', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.8125rem' }}>Next →</button>
            <span style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', marginLeft:8 }}>{calLeads.length} meeting{calLeads.length!==1?'s':''} this month</span>
          </div>

          {calLeads.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', background:'white', border:'1px dashed var(--neutral-200)', borderRadius:14 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
              <p style={{ color:'var(--neutral-500)', fontSize:'0.875rem' }}>No meetings scheduled for this month.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {calLeads.sort((a,b) => a.meeting_date > b.meeting_date ? 1 : -1).map(lead => {
                const pm = PM[lead.product_routed] || PM.scm_enterprise
                const st = STATUS[lead.status] || STATUS.pending
                return (
                  <div key={lead.id} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', boxShadow:'var(--shadow-xs)' }}>
                    {/* Date block */}
                    <div style={{ background:pm.color, borderRadius:12, padding:'10px 14px', textAlign:'center', flexShrink:0, minWidth:56 }}>
                      <div style={{ fontSize:'1.25rem', fontWeight:700, color:'white', lineHeight:1 }}>{new Date(lead.meeting_date+'T00:00').getDate()}</div>
                      <div style={{ fontSize:'0.6875rem', color:'rgba(255,255,255,0.75)', marginTop:2 }}>{new Date(lead.meeting_date+'T00:00').toLocaleDateString('en-GB',{month:'short'})}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                        <span style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)' }}>{lead.first_name} {lead.last_name}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>·</span>
                        <span style={{ fontSize:'0.8125rem', color:'var(--neutral-600)' }}>{lead.company_name}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>{lead.country}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:6, padding:'2px 8px' }}>
                          <span style={{ fontSize:11 }}>{pm.icon}</span>
                          <span style={{ fontSize:'0.6875rem', fontWeight:600, color:pm.color }}>{pm.label}</span>
                        </div>
                        {lead.meeting_time && (
                          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem', color:'var(--neutral-500)' }}>
                            <Clock size={12}/> {lead.meeting_time}
                          </div>
                        )}
                        {isVP && lead.profiles?.full_name && (
                          <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>AM: {lead.profiles.full_name}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <div style={{ fontSize:'0.75rem', fontWeight:600, color:st.color, background:st.bg, border:`1px solid ${st.border}`, borderRadius:7, padding:'3px 10px' }}>{st.label}</div>
                      <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)} style={{ fontSize:'0.75rem', padding:'4px 8px', border:'1px solid var(--neutral-200)', borderRadius:7, cursor:'pointer', color:'var(--neutral-600)' }}>
                        {Object.entries(STATUS).map(([val,meta]) => <option key={val} value={val}>{meta.label}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM TAB (VP only) ───────────────────────────────────────────── */}
      {tab === 'team' && isVP && (
        <div>
          <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-xs)', marginBottom:16 }}>
            <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid var(--neutral-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--neutral-800)' }}>Sales Team Roles</div>
              <button onClick={() => setShowAddRole(true)} className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.75rem', padding:'5px 12px' }}><UserPlus size={13}/> Add member</button>
            </div>
            {salesRoles.length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--neutral-400)', fontSize:'0.875rem' }}>No team members assigned yet.</div>
            ) : (
              salesRoles.map((r,i) => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1.25rem', borderTop: i > 0 ? '1px solid var(--neutral-100)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,var(--brand-600),var(--brand-400))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8125rem', fontWeight:700, color:'white', flexShrink:0 }}>
                      {(r.profiles?.full_name||'?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--neutral-800)' }}>{r.profiles?.full_name || r.user_id}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>
                        {leads.filter(l=>l.account_manager_id===r.user_id).length} leads assigned
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:600, color: r.role==='vp_sales' ? '#5B21B6' : '#1E40AF', background: r.role==='vp_sales' ? '#F5F3FF' : '#EFF6FF', border:`1px solid ${r.role==='vp_sales'?'#DDD6FE':'#BFDBFE'}`, borderRadius:7, padding:'3px 10px' }}>
                      {r.role === 'vp_sales' ? 'VP Sales' : 'Account Manager'}
                    </span>
                    {r.user_id !== user.id && (
                      <button onClick={() => removeRole(r.user_id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', padding:4, display:'flex', alignItems:'center' }} title="Remove role"><X size={14}/></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Performance summary */}
          {salesRoles.filter(r=>r.role==='account_manager').length > 0 && (
            <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-xs)' }}>
              <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid var(--neutral-100)', fontSize:'0.875rem', fontWeight:600, color:'var(--neutral-800)' }}>AM Performance</div>
              {salesRoles.filter(r=>r.role==='account_manager').map((r,i) => {
                const amLeads = leads.filter(l=>l.account_manager_id===r.user_id)
                const completed = amLeads.filter(l=>l.status==='completed').length
                const pct = amLeads.length > 0 ? Math.round((completed/amLeads.length)*100) : 0
                return (
                  <div key={r.id} style={{ padding:'0.875rem 1.25rem', borderTop: i>0?'1px solid var(--neutral-100)':'none', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,var(--brand-600),var(--brand-400))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'white', flexShrink:0 }}>
                      {(r.profiles?.full_name||'?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--neutral-800)' }}>{r.profiles?.full_name || r.user_id}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>{completed}/{amLeads.length} completed ({pct}%)</span>
                      </div>
                      <div style={{ height:5, background:'var(--neutral-150)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,var(--brand-500),var(--success-500))', borderRadius:3, transition:'width 0.5s ease' }}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      </>}

      {/* ── ADD ROLE MODAL ────────────────────────────────────────────────── */}
      {showAddRole && (
        <div style={{ position:'fixed', inset:0, background:'rgba(14,22,36,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'white', borderRadius:20, padding:'1.75rem', width:'100%', maxWidth:400, boxShadow:'var(--shadow-xl)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>Add team member role</div>
              <button onClick={() => setShowAddRole(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', fontSize:20 }}>×</button>
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
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Sales role</label>
                <select className="input" value={addRoleForm.role} onChange={e=>setAddRoleForm(p=>({...p,role:e.target.value}))} style={{ cursor:'pointer' }}>
                  <option value="account_manager">Account Manager</option>
                  <option value="vp_sales">VP of Sales</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddRole(false)} style={{ flex:1 }}>Cancel</button>
              <button className={`btn btn-primary ${savingRole?'btn-loading':''}`} onClick={addSalesRole} disabled={savingRole||!addRoleForm.user_id} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {savingRole?'':<><CheckCircle2 size={15}/> Add role</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTES MODAL ───────────────────────────────────────────────────── */}
      {editLead && (
        <div style={{ position:'fixed', inset:0, background:'rgba(14,22,36,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
          <div style={{ background:'white', borderRadius:20, padding:'1.75rem', width:'100%', maxWidth:460, boxShadow:'var(--shadow-xl)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>Meeting notes — {editLead.first_name} {editLead.last_name}</div>
              <button onClick={() => setEditLead(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', fontSize:20 }}>×</button>
            </div>
            <textarea
              className="input"
              rows={5}
              placeholder="Add notes about this meeting, follow-ups, requirements, budget signals…"
              value={editNotes}
              onChange={e=>setEditNotes(e.target.value)}
              style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
            />
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
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
