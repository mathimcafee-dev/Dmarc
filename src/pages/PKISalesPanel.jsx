import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { BarChart2, Users, Calendar, ChevronDown, CheckCircle2, Clock, ShieldCheck, UserPlus, X } from 'lucide-react'

const PM = {
  scm_enterprise:{ label:'SCM Enterprise',        color:'#0D6E56', bg:'#E8F7F2', icon:'🏢' },
  private_pki:   { label:'Private PKI',            color:'#1A4FBA', bg:'#EBF0FD', icon:'🔒' },
  smime:         { label:'S/MIME Solutions',       color:'#4E35C2', bg:'#EDEBFC', icon:'✉️' },
  devops:        { label:'DevOps PKI',             color:'#0F5C8A', bg:'#E6F2FA', icon:'⚙️' },
  code_signing:  { label:'Code Signing',           color:'#2D6B1A', bg:'#EBF5E6', icon:'📝' },
  pqc:           { label:'PQC / Quantum Labs',     color:'#3C2E99', bg:'#EDEAFB', icon:'⚛️' },
  vmc_cmc:       { label:'VMC / CMC (BIMI)',       color:'#854F0B', bg:'#FEF3E0', icon:'🏷️' },
  ms_ca_mgmt:    { label:'Microsoft CA Management',color:'#0F3A8A', bg:'#E8EFFB', icon:'🖥️' },
}
const STATUS = {
  pending:      { label:'Pending',       color:'#92400E', bg:'#FFFBEB', border:'#FDE68A' },
  scheduled:    { label:'Scheduled',     color:'#1E40AF', bg:'#EFF6FF', border:'#BFDBFE' },
  completed:    { label:'Completed',     color:'#166534', bg:'#F0FDF4', border:'#BBF7D0' },
  quote_process:{ label:'Quote Process', color:'#5B21B6', bg:'#F5F3FF', border:'#DDD6FE' },
}

function dn(m) {
  return m?.display_name || m?.full_name || m?.email || (m?.user_id ? m.user_id.slice(0,8)+'…' : 'Unknown')
}
function ini(name) {
  if (!name) return '?'
  return name.split(/[\s@]/).filter(Boolean).map(p=>p[0]).slice(0,2).join('').toUpperCase()
}

export function PKISalesPanel() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const [tab, setTab] = useState('pipeline')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [orgMembers, setOrgMembers] = useState([])   // from RPC — all members with emails
  const [accountManagers, setAccountManagers] = useState([])  // pki_sales_roles rows, enriched
  const [orgRole, setOrgRole] = useState(null)
  const [isAM, setIsAM] = useState(false)
  const [updating, setUpdating] = useState(null)
  const [showAddAM, setShowAddAM] = useState(false)
  const [addAMUserId, setAddAMUserId] = useState('')
  const [savingAM, setSavingAM] = useState(false)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [editLead, setEditLead] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [editDeal, setEditDeal] = useState(null)       // lead being edited for deal value
  const [dealValue, setDealValue] = useState('')
  const [dealCurrency, setDealCurrency] = useState('USD')
  const [savingDeal, setSavingDeal] = useState(false)
  const [approvingId, setApprovingId] = useState(null) // lead being approved/rejected

  const isVP = ['owner','admin'].includes(orgRole)
  const hasAccess = isVP || isAM

  useEffect(() => { if (currentOrg?.id && user?.id) loadAll() }, [currentOrg?.id, user?.id])

  async function loadAll() {
    setLoading(true)
    try {
      // 1. My org role
      const { data: me } = await supabase
        .from('org_members').select('role')
        .eq('org_id', currentOrg.id).eq('user_id', user.id).single()
      const myOrgRole = me?.role || null
      setOrgRole(myOrgRole)

      // 2. All org members with emails via SECURITY DEFINER RPC
      const { data: members, error: rpcErr } = await supabase
        .rpc('get_org_members_with_emails', { p_org_id: currentOrg.id })
      if (rpcErr) console.error('RPC error:', rpcErr)
      const allMembers = members || []
      setOrgMembers(allMembers)

      // 3. Account managers from pki_sales_roles
      const { data: amsRaw } = await supabase
        .from('pki_sales_roles').select('*')
        .eq('org_id', currentOrg.id).eq('role', 'account_manager')

      // Enrich with email from RPC result
      const ams = (amsRaw || []).map(am => {
        const m = allMembers.find(x => x.user_id === am.user_id) || {}
        return {
          ...am,
          email: am.email || m.email || null,
          display_name: am.display_name || m.full_name || m.email || am.user_id?.slice(0,8)+'…',
        }
      })
      setAccountManagers(ams)

      // 4. Am I an AM?
      const amEntry = ams.find(a => a.user_id === user.id)
      setIsAM(!!amEntry && !['owner','admin'].includes(myOrgRole))

      // 5. Leads
      const { data: leadsData } = await supabase
        .from('pki_leads').select('*')
        .eq('org_id', currentOrg.id).order('created_at', { ascending: false })

      const enriched = (leadsData || []).map(l => ({
        ...l,
        am_name: ams.find(a => a.user_id === l.account_manager_id)?.display_name || null,
      }))
      setLeads(enriched)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const visibleLeads = isVP ? leads : leads.filter(l => l.account_manager_id === user.id)
  const stats = {
    total: visibleLeads.length,
    pending: visibleLeads.filter(l=>l.status==='pending').length,
    scheduled: visibleLeads.filter(l=>l.status==='scheduled').length,
    completed: visibleLeads.filter(l=>l.status==='completed').length,
    quote: visibleLeads.filter(l=>l.status==='quote_process').length,
  }
  const byProduct = visibleLeads.reduce((acc,l) => { acc[l.product_routed]=(acc[l.product_routed]||0)+1; return acc },{})
  const calLeads = visibleLeads.filter(l => l.meeting_date?.startsWith(calMonth))

  // Eligible for AM: not owner/admin, not already an AM
  const eligibleForAM = orgMembers.filter(m =>
    !['owner','admin'].includes(m.org_role) &&
    !accountManagers.find(am => am.user_id === m.user_id)
  )

  async function updateStatus(leadId, status) {
    setUpdating(leadId)
    await supabase.from('pki_leads').update({ status, updated_at:new Date().toISOString() }).eq('id', leadId)
    setUpdating(null); await loadAll()
  }

  async function deleteLead(leadId) {
    if (!confirm('Delete this lead permanently?')) return
    await supabase.from('pki_leads').delete().eq('id', leadId)
    await loadAll()
  }

  async function saveNotes() {
    if (!editLead) return
    setSavingNotes(true)
    await supabase.from('pki_leads').update({ meeting_notes:editNotes, updated_at:new Date().toISOString() }).eq('id', editLead.id)
    setSavingNotes(false); setEditLead(null); await loadAll()
  }

  async function saveDeal() {
    if (!editDeal) return
    setSavingDeal(true)
    const val = parseFloat(dealValue)
    await supabase.from('pki_leads').update({
      deal_value: isNaN(val) ? null : val,
      deal_currency: dealCurrency,
      updated_at: new Date().toISOString()
    }).eq('id', editDeal.id)
    setSavingDeal(false); setEditDeal(null); await loadAll()
  }

  async function approveLead(leadId, approval_status) {
    setApprovingId(leadId)
    await supabase.from('pki_leads').update({ approval_status, updated_at: new Date().toISOString() }).eq('id', leadId)
    setApprovingId(null); await loadAll()
  }

  async function handleAddAM() {
    if (!addAMUserId) return
    setSavingAM(true)
    const m = orgMembers.find(x => x.user_id === addAMUserId)
    await supabase.from('pki_sales_roles').upsert({
      org_id: currentOrg.id,
      user_id: addAMUserId,
      role: 'account_manager',
      email: m?.email || null,
      display_name: m?.full_name || m?.email || null,
    }, { onConflict: 'org_id,user_id' })
    setSavingAM(false); setShowAddAM(false); setAddAMUserId(''); await loadAll()
  }

  async function removeAM(userId) {
    if (!confirm('Remove this account manager?')) return
    await supabase.from('pki_sales_roles').delete().eq('org_id',currentOrg.id).eq('user_id',userId)
    await loadAll()
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'var(--neutral-400)',fontSize:'0.875rem'}}>Loading Sales Panel…</div>
  )

  if (!hasAccess) return (
    <div style={{padding:'2rem',maxWidth:500,margin:'0 auto',textAlign:'center'}}>
      <div style={{background:'white',border:'1px solid var(--neutral-150)',borderRadius:16,padding:'2.5rem',boxShadow:'var(--shadow-xs)'}}>
        <div style={{fontSize:48,marginBottom:12}}>🔒</div>
        <h2 style={{fontSize:'1.125rem',fontWeight:600,color:'var(--neutral-800)',marginBottom:8}}>Sales Panel Access Required</h2>
        <p style={{fontSize:'0.875rem',color:'var(--neutral-500)',lineHeight:1.6,margin:0}}>
          You need to be assigned as an Account Manager.<br/>Contact the VP of Sales to get access.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{padding:'1.5rem 2rem',maxWidth:1100}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#1A4FBA,#3C2E99)',display:'flex',alignItems:'center',justifyContent:'center'}}><BarChart2 size={17} color="white"/></div>
            <h1 style={{fontSize:'1.375rem',fontWeight:600,letterSpacing:'-0.02em',margin:0}}>{isVP?'VP Sales Panel':'My Assigned Meetings'}</h1>
          </div>
          <p style={{fontSize:'0.8125rem',color:'var(--neutral-500)',margin:0,paddingLeft:44}}>
            {isVP?`Full pipeline · ${leads.length} leads · ${accountManagers.length} account manager${accountManagers.length!==1?'s':''}`:`Your assigned leads — ${visibleLeads.length} total`}
          </p>
        </div>
        {isVP && <button onClick={()=>setShowAddAM(true)} className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}}><UserPlus size={15}/> Add Account Manager</button>}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:'1.5rem',background:'var(--neutral-100)',borderRadius:10,padding:4,width:'fit-content'}}>
        {[{id:'pipeline',label:'Pipeline',icon:<ShieldCheck size={14}/>},{id:'calendar',label:'Calendar',icon:<Calendar size={14}/>},...(isVP?[{id:'team',label:'Account Managers',icon:<Users size={14}/>}]:[])].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:tab===t.id?'white':'transparent',border:'none',borderRadius:8,cursor:'pointer',fontSize:'0.8125rem',fontWeight:tab===t.id?600:400,color:tab===t.id?'var(--neutral-800)':'var(--neutral-500)',boxShadow:tab===t.id?'var(--shadow-xs)':'none',transition:'all 0.12s'}}>
            {t.icon} {t.label}
            {t.id==='pipeline'&&stats.pending>0&&<span style={{background:'#EF4444',color:'white',borderRadius:20,fontSize:10,fontWeight:700,padding:'1px 6px',marginLeft:2}}>{stats.pending}</span>}
          </button>
        ))}
      </div>

      {/* PIPELINE */}
      {tab==='pipeline'&&(<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20}}>
          {[{label:'Total Leads',val:stats.total,color:'var(--neutral-700)',bg:'white',border:'var(--neutral-150)'},{label:'Pending',val:stats.pending,color:STATUS.pending.color,bg:STATUS.pending.bg,border:STATUS.pending.border},{label:'Scheduled',val:stats.scheduled,color:STATUS.scheduled.color,bg:STATUS.scheduled.bg,border:STATUS.scheduled.border},{label:'Completed',val:stats.completed,color:STATUS.completed.color,bg:STATUS.completed.bg,border:STATUS.completed.border},{label:'Quote Process',val:stats.quote,color:STATUS.quote_process.color,bg:STATUS.quote_process.bg,border:STATUS.quote_process.border}].map(s=>(
            <div key={s.label} style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:'1.75rem',fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
              <div style={{fontSize:'0.75rem',color:'var(--neutral-500)',marginTop:5}}>{s.label}</div>
            </div>
          ))}
          {isVP&&(()=>{
            const pipelineVal = visibleLeads.filter(l=>l.deal_value).reduce((sum,l)=>sum+(l.deal_value||0),0)
            const approved = visibleLeads.filter(l=>l.approval_status==='approved').reduce((sum,l)=>sum+(l.deal_value||0),0)
            return pipelineVal > 0 ? <>
              <div style={{background:'#F5F3FF',border:'1px solid #DDD6FE',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:'1.25rem',fontWeight:700,color:'#5B21B6',lineHeight:1}}>${pipelineVal.toLocaleString()}</div>
                <div style={{fontSize:'0.75rem',color:'#7C3AED',marginTop:5}}>Pipeline value</div>
              </div>
              {approved>0&&<div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:'1.25rem',fontWeight:700,color:'#166534',lineHeight:1}}>${approved.toLocaleString()}</div>
                <div style={{fontSize:'0.75rem',color:'#16A34A',marginTop:5}}>Approved deals</div>
              </div>}
            </> : null
          })()}
        </div>
        {isVP&&Object.keys(byProduct).length>0&&(
          <div style={{background:'white',border:'1px solid var(--neutral-150)',borderRadius:14,padding:'1rem 1.25rem',marginBottom:16}}>
            <div style={{fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--neutral-500)',marginBottom:10,fontWeight:600}}>Pipeline by product</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).map(([prod,count])=>{const pm=PM[prod]||PM.scm_enterprise;const pct=Math.round((count/leads.length)*100);return(
                <div key={prod} style={{display:'flex',alignItems:'center',gap:7,background:pm.bg,border:`1px solid ${pm.color}22`,borderRadius:9,padding:'6px 12px'}}>
                  <span style={{fontSize:14}}>{pm.icon}</span>
                  <span style={{fontSize:'0.8125rem',fontWeight:600,color:pm.color}}>{pm.label}</span>
                  <span style={{fontSize:'0.75rem',fontWeight:700,color:'white',background:pm.color,borderRadius:20,padding:'1px 7px'}}>{count}</span>
                  <span style={{fontSize:'0.75rem',color:pm.color,opacity:0.7}}>{pct}%</span>
                </div>
              )})}
            </div>
          </div>
        )}
        {visibleLeads.length===0?(
          <div style={{textAlign:'center',padding:'3rem 2rem',background:'white',border:'1px dashed var(--neutral-200)',borderRadius:14}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <h3 style={{fontSize:'1rem',fontWeight:600,color:'var(--neutral-700)',marginBottom:6}}>No leads yet</h3>
            <p style={{fontSize:'0.875rem',color:'var(--neutral-500)',margin:0}}>{isVP?'Run a discovery session, book a meeting, and it will appear here.':'No leads assigned to you yet.'}</p>
          </div>
        ):(
          <div style={{background:'white',border:'1px solid var(--neutral-150)',borderRadius:14,overflow:'auto',boxShadow:'var(--shadow-xs)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
              <thead><tr style={{background:'var(--neutral-50)',borderBottom:'1px solid var(--neutral-150)'}}>
                {['Customer','Company','Country','Product','Meeting','Status',...(isVP?['Account Manager','Deal Value','Approval','']:[]),...(isAM?['Deal Value','Notes']:[])].map((h,i)=>(
                  <th key={i} style={{padding:'10px 12px',textAlign:'left',fontSize:'0.6875rem',textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--neutral-500)',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {visibleLeads.map((lead,i)=>{
                  const pm=PM[lead.product_routed]||PM.scm_enterprise;const st=STATUS[lead.status]||STATUS.pending
                  return(
                  <tr key={lead.id} style={{borderTop:i>0?'1px solid var(--neutral-100)':'none'}}>
                    <td style={{padding:'11px 12px'}}>
                      <div style={{fontSize:'0.875rem',fontWeight:600,color:'var(--neutral-800)'}}>{lead.first_name} {lead.last_name}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--neutral-400)',marginTop:1}}>{lead.email}</div>
                    </td>
                    <td style={{padding:'11px 12px',fontSize:'0.875rem',color:'var(--neutral-700)'}}>{lead.company_name}</td>
                    <td style={{padding:'11px 12px',fontSize:'0.8125rem',color:'var(--neutral-500)'}}>{lead.country}</td>
                    <td style={{padding:'11px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,background:pm.bg,border:`1px solid ${pm.color}22`,borderRadius:7,padding:'3px 8px',width:'fit-content',whiteSpace:'nowrap'}}>
                        <span style={{fontSize:11}}>{pm.icon}</span><span style={{fontSize:'0.6875rem',fontWeight:600,color:pm.color}}>{pm.label}</span>
                      </div>
                    </td>
                    <td style={{padding:'11px 12px'}}>
                      {lead.meeting_date?(
                        <div>
                          <div style={{fontSize:'0.8125rem',color:'var(--neutral-700)',fontWeight:500}}>{new Date(lead.meeting_date+'T00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
                          {lead.meeting_time&&<div style={{fontSize:'0.75rem',color:'var(--neutral-400)',display:'flex',alignItems:'center',gap:3,marginTop:1}}><Clock size={11}/>{lead.meeting_time}</div>}
                        </div>
                      ):<span style={{fontSize:'0.75rem',color:'var(--neutral-400)'}}>Not scheduled</span>}
                    </td>
                    {/* Status — AM can change, VP sees badge only */}
                    <td style={{padding:'11px 12px'}}>
                      {isAM ? (
                        <div style={{position:'relative',display:'inline-block'}}>
                          <select value={lead.status} onChange={e=>updateStatus(lead.id,e.target.value)} disabled={updating===lead.id}
                            style={{appearance:'none',WebkitAppearance:'none',padding:'5px 26px 5px 10px',fontSize:'0.75rem',fontWeight:600,color:st.color,background:st.bg,border:`1px solid ${st.border}`,borderRadius:8,cursor:'pointer',outline:'none'}}>
                            {Object.entries(STATUS).map(([val,meta])=><option key={val} value={val}>{meta.label}</option>)}
                          </select>
                          <ChevronDown size={10} style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',color:st.color,pointerEvents:'none'}}/>
                        </div>
                      ) : (
                        <span style={{fontSize:'0.75rem',fontWeight:600,color:st.color,background:st.bg,border:`1px solid ${st.border}`,borderRadius:8,padding:'4px 10px',whiteSpace:'nowrap'}}>{st.label}</span>
                      )}
                    </td>
                    {/* VP: AM name + Delete */}
                    {/* VP: AM name */}
                    {isVP&&<td style={{padding:'11px 12px',fontSize:'0.8125rem',color:lead.am_name?'var(--neutral-700)':'var(--neutral-400)'}}>{lead.am_name||'Unassigned'}</td>}
                    {/* VP: Deal value (read-only) */}
                    {isVP&&<td style={{padding:'11px 12px'}}>
                      {lead.deal_value
                        ? <span style={{fontSize:'0.875rem',fontWeight:600,color:'#5B21B6'}}>{lead.deal_currency||'USD'} {Number(lead.deal_value).toLocaleString()}</span>
                        : <span style={{fontSize:'0.75rem',color:'var(--neutral-400)'}}>—</span>}
                    </td>}
                    {/* VP: Approval button */}
                    {isVP&&<td style={{padding:'11px 12px'}}>
                      {lead.approval_status ? (
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontSize:'0.75rem',fontWeight:600,padding:'3px 9px',borderRadius:7,whiteSpace:'nowrap',
                            color:lead.approval_status==='approved'?'#166534':lead.approval_status==='rejected'?'#991B1B':'#92400E',
                            background:lead.approval_status==='approved'?'#F0FDF4':lead.approval_status==='rejected'?'#FEF2F2':'#FFFBEB',
                            border:`1px solid ${lead.approval_status==='approved'?'#BBF7D0':lead.approval_status==='rejected'?'#FECACA':'#FDE68A'}`
                          }}>
                            {lead.approval_status==='approved'?'✓ Approved':lead.approval_status==='rejected'?'✗ Rejected':'↩ Rework'}
                          </span>
                          <button onClick={()=>approveLead(lead.id,null)} disabled={approvingId===lead.id}
                            style={{background:'none',border:'none',cursor:'pointer',color:'var(--neutral-400)',fontSize:14,padding:2}} title="Reset">×</button>
                        </div>
                      ) : lead.deal_value ? (
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>approveLead(lead.id,'approved')} disabled={approvingId===lead.id}
                            style={{padding:'4px 9px',fontSize:'0.75rem',fontWeight:600,background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,cursor:'pointer',color:'#166534',whiteSpace:'nowrap'}}>✓ Approve</button>
                          <button onClick={()=>approveLead(lead.id,'rejected')} disabled={approvingId===lead.id}
                            style={{padding:'4px 9px',fontSize:'0.75rem',fontWeight:600,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,cursor:'pointer',color:'#DC2626',whiteSpace:'nowrap'}}>✗ Reject</button>
                          <button onClick={()=>approveLead(lead.id,'rework')} disabled={approvingId===lead.id}
                            style={{padding:'4px 9px',fontSize:'0.75rem',fontWeight:600,background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:6,cursor:'pointer',color:'#92400E',whiteSpace:'nowrap'}}>↩ Rework</button>
                        </div>
                      ) : <span style={{fontSize:'0.75rem',color:'var(--neutral-400)'}}>No deal value</span>}
                    </td>}
                    {/* VP: Delete */}
                    {isVP&&(
                      <td style={{padding:'11px 12px'}}>
                        <button onClick={()=>deleteLead(lead.id)}
                          style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:'0.75rem',color:'#DC2626',fontWeight:500,whiteSpace:'nowrap'}}>
                          🗑 Delete
                        </button>
                      </td>
                    )}
                    {/* AM: Deal Value — editable */}
                    {isAM&&<td style={{padding:'11px 12px'}}>
                      <button onClick={()=>{setEditDeal(lead);setDealValue(lead.deal_value||'');setDealCurrency(lead.deal_currency||'USD')}}
                        style={{display:'flex',alignItems:'center',gap:5,background:lead.deal_value?'#F5F3FF':'var(--neutral-50)',border:`1px solid ${lead.deal_value?'#DDD6FE':'var(--neutral-200)'}`,borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:'0.75rem',fontWeight:600,color:lead.deal_value?'#5B21B6':'var(--neutral-500)',whiteSpace:'nowrap'}}>
                        {lead.deal_value ? `${lead.deal_currency||'USD'} ${Number(lead.deal_value).toLocaleString()}` : '+ Deal value'}
                        {lead.approval_status&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:5,background:lead.approval_status==='approved'?'#BBF7D0':lead.approval_status==='rejected'?'#FECACA':'#FDE68A',color:lead.approval_status==='approved'?'#166534':lead.approval_status==='rejected'?'#991B1B':'#92400E'}}>{lead.approval_status==='approved'?'✓':lead.approval_status==='rejected'?'✗':'↩'}</span>}
                      </button>
                    </td>}
                    {/* AM: Notes */}
                    {isAM&&(
                      <td style={{padding:'11px 12px'}}>
                        <button onClick={()=>{setEditLead(lead);setEditNotes(lead.meeting_notes||'')}}
                          style={{background:lead.meeting_notes?'#EFF6FF':'var(--neutral-50)',border:`1px solid ${lead.meeting_notes?'#BFDBFE':'var(--neutral-200)'}`,borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:'0.75rem',color:lead.meeting_notes?'#1E40AF':'var(--neutral-500)',fontWeight:500,whiteSpace:'nowrap'}}>
                          {lead.meeting_notes?'📝 Edit':'+ Notes'}
                        </button>
                      </td>
                    )}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </>)}

      {/* CALENDAR */}
      {tab==='calendar'&&(
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
            <button onClick={()=>{const[y,m]=calMonth.split('-').map(Number);const d=new Date(y,m-2,1);setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}} className="btn btn-secondary">← Prev</button>
            <div style={{fontSize:'1.0625rem',fontWeight:700,color:'var(--neutral-800)',minWidth:180,textAlign:'center'}}>{new Date(calMonth+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div>
            <button onClick={()=>{const[y,m]=calMonth.split('-').map(Number);const d=new Date(y,m,1);setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}} className="btn btn-secondary">Next →</button>
            <span style={{fontSize:'0.8125rem',color:'var(--neutral-500)',background:'var(--neutral-100)',borderRadius:8,padding:'6px 12px'}}>{calLeads.length} meeting{calLeads.length!==1?'s':''} this month</span>
          </div>
          {calLeads.length===0?(
            <div style={{textAlign:'center',padding:'3rem 2rem',background:'white',border:'1px dashed var(--neutral-200)',borderRadius:14}}>
              <div style={{fontSize:40,marginBottom:12}}>📅</div>
              <h3 style={{fontSize:'1rem',fontWeight:600,color:'var(--neutral-700)',marginBottom:6}}>No meetings this month</h3>
              <p style={{fontSize:'0.875rem',color:'var(--neutral-500)',margin:0}}>Book a meeting from the discovery result to see it here.</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[...calLeads].sort((a,b)=>(a.meeting_date+a.meeting_time)>(b.meeting_date+b.meeting_time)?1:-1).map(lead=>{
                const pm=PM[lead.product_routed]||PM.scm_enterprise;const st=STATUS[lead.status]||STATUS.pending
                return(
                <div key={lead.id} style={{background:'white',border:'1px solid var(--neutral-150)',borderRadius:14,padding:'1rem 1.25rem',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',boxShadow:'var(--shadow-xs)'}}>
                  <div style={{background:pm.color,borderRadius:14,padding:'10px 14px',textAlign:'center',flexShrink:0,minWidth:52}}>
                    <div style={{fontSize:'1.375rem',fontWeight:700,color:'white',lineHeight:1}}>{new Date(lead.meeting_date+'T00:00').getDate()}</div>
                    <div style={{fontSize:'0.6875rem',color:'rgba(255,255,255,0.75)',marginTop:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>{new Date(lead.meeting_date+'T00:00').toLocaleDateString('en-GB',{month:'short'})}</div>
                  </div>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
                      <span style={{fontSize:'0.9375rem',fontWeight:600,color:'var(--neutral-800)'}}>{lead.first_name} {lead.last_name}</span>
                      <span style={{fontSize:'0.75rem',color:'var(--neutral-400)'}}>·</span>
                      <span style={{fontSize:'0.875rem',color:'var(--neutral-600)'}}>{lead.company_name}</span>
                      <span style={{fontSize:'0.75rem',color:'var(--neutral-400)',background:'var(--neutral-100)',borderRadius:6,padding:'1px 7px'}}>{lead.country}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,background:pm.bg,border:`1px solid ${pm.color}22`,borderRadius:6,padding:'2px 8px'}}>
                        <span style={{fontSize:11}}>{pm.icon}</span><span style={{fontSize:'0.6875rem',fontWeight:600,color:pm.color}}>{pm.label}</span>
                      </div>
                      {lead.meeting_time&&<div style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.8125rem',color:'var(--neutral-500)',fontWeight:500}}><Clock size={13}/>{lead.meeting_time}</div>}
                      {isVP&&lead.am_name&&<span style={{fontSize:'0.75rem',color:'var(--neutral-500)'}}>AM: {lead.am_name}</span>}
                    </div>
                  </div>
                  <div style={{flexShrink:0}}>
                    {isAM ? (
                      <div style={{position:'relative'}}>
                        <select value={lead.status} onChange={e=>updateStatus(lead.id,e.target.value)}
                          style={{appearance:'none',WebkitAppearance:'none',padding:'6px 26px 6px 10px',fontSize:'0.75rem',fontWeight:600,color:st.color,background:st.bg,border:`1px solid ${st.border}`,borderRadius:8,cursor:'pointer',outline:'none'}}>
                          {Object.entries(STATUS).map(([val,meta])=><option key={val} value={val}>{meta.label}</option>)}
                        </select>
                        <ChevronDown size={10} style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',color:st.color,pointerEvents:'none'}}/>
                      </div>
                    ) : (
                      <span style={{fontSize:'0.75rem',fontWeight:600,color:st.color,background:st.bg,border:`1px solid ${st.border}`,borderRadius:8,padding:'5px 12px',whiteSpace:'nowrap'}}>{st.label}</span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* TEAM TAB */}
      {tab==='team'&&isVP&&(
        <div style={{display:'grid',gridTemplateColumns:'minmax(300px,1fr) minmax(300px,1fr)',gap:16,alignItems:'start'}}>
          <div style={{background:'white',border:'1px solid var(--neutral-150)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-xs)'}}>
            <div style={{padding:'0.875rem 1.25rem',borderBottom:'1px solid var(--neutral-100)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:'0.9375rem',fontWeight:600,color:'var(--neutral-800)'}}>Account Managers</div>
                <div style={{fontSize:'0.75rem',color:'var(--neutral-500)',marginTop:2}}>Appear in the meeting booking dropdown</div>
              </div>
              <button onClick={()=>setShowAddAM(true)} style={{display:'flex',alignItems:'center',gap:5,background:'var(--brand-500)',color:'white',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:'0.75rem',fontWeight:600}}><UserPlus size={13}/> Add AM</button>
            </div>
            {accountManagers.length===0?(
              <div style={{padding:'2.5rem',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:10}}>👤</div>
                <p style={{color:'var(--neutral-500)',fontSize:'0.875rem',marginBottom:16}}>No account managers yet.</p>
                <button onClick={()=>setShowAddAM(true)} style={{background:'var(--brand-500)',color:'white',border:'none',borderRadius:9,padding:'8px 18px',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer'}}>Add first AM</button>
              </div>
            ):accountManagers.map((am,i)=>{
              const name=dn(am);const amLeads=leads.filter(l=>l.account_manager_id===am.user_id)
              return(
              <div key={am.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.875rem 1.25rem',borderTop:i>0?'1px solid var(--neutral-100)':'none',gap:10}}>
                <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#0D6E56,#1A4FBA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.9375rem',fontWeight:700,color:'white',flexShrink:0}}>{ini(name)}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'0.875rem',fontWeight:600,color:'var(--neutral-800)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--neutral-500)'}}>{amLeads.length} lead{amLeads.length!==1?'s':''} assigned</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <span style={{fontSize:'0.6875rem',fontWeight:700,color:'#1E40AF',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:6,padding:'3px 8px'}}>Account Manager</span>
                  <button onClick={()=>removeAM(am.user_id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--neutral-400)',padding:3,display:'flex',alignItems:'center'}}><X size={15}/></button>
                </div>
              </div>
            )})}
          </div>

          <div style={{background:'white',border:'1px solid var(--neutral-150)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-xs)'}}>
            <div style={{padding:'0.875rem 1.25rem',borderBottom:'1px solid var(--neutral-100)',fontSize:'0.9375rem',fontWeight:600,color:'var(--neutral-800)'}}>AM Performance</div>
            {accountManagers.length===0?(
              <div style={{padding:'2rem',textAlign:'center',color:'var(--neutral-400)',fontSize:'0.875rem'}}>Add account managers to see their performance.</div>
            ):accountManagers.map((am,i)=>{
              const name=dn(am);const amLeads=leads.filter(l=>l.account_manager_id===am.user_id)
              const completed=amLeads.filter(l=>l.status==='completed').length
              const active=amLeads.filter(l=>['scheduled','quote_process'].includes(l.status)).length
              const pct=amLeads.length>0?Math.round((completed/amLeads.length)*100):0
              return(
              <div key={am.id} style={{padding:'1rem 1.25rem',borderTop:i>0?'1px solid var(--neutral-100)':'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#0D6E56,#1A4FBA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:700,color:'white'}}>{ini(name)}</div>
                    <span style={{fontSize:'0.875rem',fontWeight:500,color:'var(--neutral-800)'}}>{name}</span>
                  </div>
                  <span style={{fontSize:'0.75rem',color:'var(--neutral-500)'}}>{completed}/{amLeads.length} completed</span>
                </div>
                <div style={{height:6,background:'var(--neutral-150)',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                  <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#22C55E,#16A34A)',borderRadius:4,transition:'width 0.6s ease'}}/>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[{label:`${amLeads.filter(l=>l.status==='pending').length} pending`,color:'#92400E',bg:'#FFFBEB'},{label:`${active} active`,color:'#1E40AF',bg:'#EFF6FF'},{label:`${pct}% close rate`,color:'#166534',bg:'#F0FDF4'}].map(chip=>(
                    <span key={chip.label} style={{fontSize:'0.6875rem',fontWeight:600,color:chip.color,background:chip.bg,borderRadius:6,padding:'2px 8px'}}>{chip.label}</span>
                  ))}
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* ADD AM MODAL */}
      {showAddAM&&(
        <div style={{position:'fixed',inset:0,background:'rgba(14,22,36,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:'white',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:440,boxShadow:'var(--shadow-xl)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div style={{fontSize:'1rem',fontWeight:600,color:'var(--neutral-800)'}}>Add Account Manager</div>
              <button onClick={()=>{setShowAddAM(false);setAddAMUserId('')}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--neutral-400)',fontSize:22,lineHeight:1}}>×</button>
            </div>
            <p style={{fontSize:'0.8125rem',color:'var(--neutral-500)',marginBottom:16,lineHeight:1.5}}>
              Selected member will appear in the meeting booking dropdown and can log in to see their assigned leads.
            </p>

            {eligibleForAM.length===0?(
              <div style={{background:'var(--neutral-50)',border:'1px solid var(--neutral-200)',borderRadius:12,padding:'1.25rem',textAlign:'center',marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:8}}>👥</div>
                <div style={{fontSize:'0.875rem',fontWeight:600,color:'var(--neutral-700)',marginBottom:4}}>
                  {orgMembers.filter(m=>!['owner','admin'].includes(m.org_role)).length===0
                    ? 'No other members in this organisation'
                    : 'All members are already Account Managers'}
                </div>
                <div style={{fontSize:'0.8125rem',color:'var(--neutral-500)',lineHeight:1.5}}>
                  {orgMembers.filter(m=>!['owner','admin'].includes(m.org_role)).length===0
                    ? 'Invite members via the Members page (sidebar → Management → Members). Once they accept, they\'ll appear here.'
                    : 'Remove an existing AM first, or invite new members.'}
                </div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16,maxHeight:280,overflowY:'auto'}}>
                {eligibleForAM.map(m=>{
                  const name=m.full_name||m.email||m.user_id.slice(0,8)+'…'
                  const isSel=addAMUserId===m.user_id
                  return(
                  <button key={m.user_id} onClick={()=>setAddAMUserId(m.user_id)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:isSel?'#EFF6FF':'var(--neutral-50)',border:`2px solid ${isSel?'#3B82F6':'var(--neutral-200)'}`,borderRadius:10,cursor:'pointer',textAlign:'left',transition:'all 0.1s',width:'100%'}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${isSel?'#1D4ED8,#3B82F6':'#475569,#64748B'})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',fontWeight:700,color:'white',flexShrink:0}}>
                      {ini(name)}
                    </div>
                    <div style={{flex:1,minWidth:0,textAlign:'left'}}>
                      <div style={{fontSize:'0.875rem',fontWeight:600,color:isSel?'#1E40AF':'var(--neutral-800)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div>
                      {m.full_name&&m.email&&<div style={{fontSize:'0.75rem',color:'var(--neutral-500)',marginTop:1}}>{m.email}</div>}
                      <div style={{fontSize:'0.75rem',color:'var(--neutral-400)',marginTop:1}}>Org role: {m.org_role}</div>
                    </div>
                    {isSel&&<CheckCircle2 size={20} color="#3B82F6" style={{flexShrink:0}}/>}
                  </button>
                )})}
              </div>
            )}

            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-secondary" onClick={()=>{setShowAddAM(false);setAddAMUserId('')}} style={{flex:1}}>Cancel</button>
              <button className={`btn btn-primary ${savingAM?'btn-loading':''}`} onClick={handleAddAM} disabled={savingAM||!addAMUserId} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {savingAM?'':<><CheckCircle2 size={15}/> Assign as AM</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEAL VALUE MODAL */}
      {editDeal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(14,22,36,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:'white',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:400,boxShadow:'var(--shadow-xl)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <div style={{fontSize:'1rem',fontWeight:600,color:'var(--neutral-800)'}}>Deal Value</div>
                <div style={{fontSize:'0.75rem',color:'var(--neutral-500)',marginTop:2}}>{editDeal.first_name} {editDeal.last_name} · {editDeal.company_name}</div>
              </div>
              <button onClick={()=>setEditDeal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--neutral-400)',fontSize:22,lineHeight:1}}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'100px 1fr',gap:10,marginBottom:16}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Currency</label>
                <select className="input" value={dealCurrency} onChange={e=>setDealCurrency(e.target.value)} style={{cursor:'pointer'}}>
                  {['USD','EUR','GBP','INR','AUD','CAD','SGD','AED'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Deal value</label>
                <input className="input" type="number" min="0" placeholder="e.g. 50000" value={dealValue} onChange={e=>setDealValue(e.target.value)}/>
              </div>
            </div>
            {editDeal.approval_status&&(
              <div style={{background:editDeal.approval_status==='approved'?'#F0FDF4':editDeal.approval_status==='rejected'?'#FEF2F2':'#FFFBEB',border:`1px solid ${editDeal.approval_status==='approved'?'#BBF7D0':editDeal.approval_status==='rejected'?'#FECACA':'#FDE68A'}`,borderRadius:8,padding:'8px 12px',fontSize:'0.8125rem',fontWeight:600,color:editDeal.approval_status==='approved'?'#166534':editDeal.approval_status==='rejected'?'#991B1B':'#92400E',marginBottom:16}}>
                VP decision: {editDeal.approval_status==='approved'?'✓ Approved':editDeal.approval_status==='rejected'?'✗ Rejected':'↩ Rework required'}
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-secondary" onClick={()=>setEditDeal(null)} style={{flex:1}}>Cancel</button>
              <button className={`btn btn-primary ${savingDeal?'btn-loading':''}`} onClick={saveDeal} disabled={savingDeal||!dealValue} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {savingDeal?'':<><CheckCircle2 size={15}/> Save deal value</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTES MODAL */}
      {editLead&&(
        <div style={{position:'fixed',inset:0,background:'rgba(14,22,36,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:'white',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:480,boxShadow:'var(--shadow-xl)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <div style={{fontSize:'1rem',fontWeight:600,color:'var(--neutral-800)'}}>Meeting Notes</div>
                <div style={{fontSize:'0.75rem',color:'var(--neutral-500)',marginTop:2}}>{editLead.first_name} {editLead.last_name} · {editLead.company_name}</div>
              </div>
              <button onClick={()=>setEditLead(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--neutral-400)',fontSize:22,lineHeight:1}}>×</button>
            </div>
            <textarea className="input" rows={6} placeholder="Budget signals, requirements, follow-up actions…" value={editNotes} onChange={e=>setEditNotes(e.target.value)} style={{resize:'vertical',fontFamily:'inherit',lineHeight:1.6,marginBottom:12}}/>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-secondary" onClick={()=>setEditLead(null)} style={{flex:1}}>Cancel</button>
              <button className={`btn btn-primary ${savingNotes?'btn-loading':''}`} onClick={saveNotes} disabled={savingNotes} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {savingNotes?'':<><CheckCircle2 size={15}/> Save notes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
