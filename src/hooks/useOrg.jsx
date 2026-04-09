import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [currentOrg, setCurrentOrg] = useState(null)
  const [currentRole, setCurrentRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchOrgs = useCallback(async () => {
    if (!user) { setOrgs([]); setCurrentOrg(null); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('org_members')
      .select(`
        role, accepted_at,
        organisations (id, name, slug, logo_url, created_at)
      `)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .order('invited_at', { ascending: true })

    if (!error && data) {
      const list = data.map(m => ({ ...m.organisations, role: m.role }))
      setOrgs(list)
      // Restore last used org from localStorage
      const saved = localStorage.getItem('dnsmonitor_current_org')
      const found = list.find(o => o.id === saved) || list[0] || null
      setCurrentOrg(found)
      setCurrentRole(found ? data.find(m => m.organisations.id === found.id)?.role : null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  function switchOrg(org) {
    setCurrentOrg(org)
    setCurrentRole(orgs.find(o => o.id === org.id)?.role || null)
    localStorage.setItem('dnsmonitor_current_org', org.id)
  }

  async function createOrg(name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`

    const { data: org, error: orgErr } = await supabase
      .from('organisations')
      .insert({ name, slug: uniqueSlug })
      .select()
      .single()
    if (orgErr) return { error: orgErr }

    const { error: memErr } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, user_id: user.id, role: 'owner', accepted_at: new Date().toISOString() })
    if (memErr) return { error: memErr }

    await fetchOrgs()
    return { data: org }
  }

  async function inviteMember(email, role = 'member') {
    if (!currentOrg) return { error: { message: 'No org selected' } }
    const { data, error } = await supabase
      .from('org_invitations')
      .upsert({ org_id: currentOrg.id, email, role, invited_by: user.id })
      .select()
      .single()
    return { data, error }
  }

  async function updateOrg(updates) {
    if (!currentOrg) return { error: { message: 'No org selected' } }
    const { data, error } = await supabase
      .from('organisations')
      .update(updates)
      .eq('id', currentOrg.id)
      .select()
      .single()
    if (!error) {
      setCurrentOrg(prev => ({ ...prev, ...data }))
      setOrgs(prev => prev.map(o => o.id === currentOrg.id ? { ...o, ...data } : o))
    }
    return { data, error }
  }

  const isAdmin = ['owner', 'admin'].includes(currentRole)
  const isOwner = currentRole === 'owner'

  return (
    <OrgContext.Provider value={{
      orgs, currentOrg, currentRole, loading,
      switchOrg, createOrg, inviteMember, updateOrg, fetchOrgs,
      isAdmin, isOwner
    }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
