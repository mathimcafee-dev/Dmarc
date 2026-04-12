import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from './useOrg'

export function useDomains() {
  const { currentOrg } = useOrg()
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDomains = useCallback(async () => {
    if (!currentOrg) { setDomains([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('domains')
      .select(`
        *,
        dmarc_records!inner(policy, fetched_at),
        spf_records(is_valid, fetched_at),
        dkim_records(selector, is_valid)
      `)
      .eq('org_id', currentOrg.id)
      .eq('dmarc_records.is_current', true)
      .order('created_at', { ascending: false })

    if (!error) setDomains(data || [])
    setLoading(false)
  }, [currentOrg])

  // Simpler fetch without joins for listings
  const fetchDomainsBasic = useCallback(async () => {
    if (!currentOrg) { setDomains([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })

    if (!error) setDomains(data || [])
    setLoading(false)
  }, [currentOrg])

  useEffect(() => { fetchDomainsBasic() }, [fetchDomainsBasic])

  async function addDomain(domainName) {
    if (!currentOrg) return { error: { message: 'No org selected' } }
    const clean = domainName.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const { data, error } = await supabase
      .from('domains')
      .insert({ org_id: currentOrg.id, domain: clean })
      .select()
      .single()
    if (!error) setDomains(prev => [data, ...prev])
    return { data, error }
  }

  async function removeDomain(id) {
    const { error } = await supabase.from('domains').delete().eq('id', id)
    if (!error) setDomains(prev => prev.filter(d => d.id !== id))
    return { error }
  }

  async function verifyDomain(domainId) {
    // In production this calls a Vercel API function
    // which does DNS TXT lookup for the verification token
    const domain = domains.find(d => d.id === domainId)
    if (!domain) return { error: { message: 'Domain not found' } }

    try {
      const res = await fetch(`/api/dns-lookup?domain=${domain.domain}&token=${domain.verification_token}`)
      const result = await res.json()
      if (result.verified) {
        const { data, error } = await supabase
          .from('domains')
          .update({ status: 'active', verified_at: new Date().toISOString() })
          .eq('id', domainId)
          .select()
          .single()
        if (!error) setDomains(prev => prev.map(d => d.id === domainId ? data : d))
        return { data, verified: true }
      }
      return { verified: false, error: { message: 'TXT record not found. DNS changes can take up to 48 hours.' } }
    } catch {
      return { error: { message: 'Verification service unavailable' } }
    }
  }

  async function scanDomain(domainId) {
    const domain = domains.find(d => d.id === domainId)
    if (!domain) return { error: { message: 'Domain not found' } }

    try {
      const res = await fetch(`/api/scan-domain?domain=${domain.domain}&domainId=${domainId}`)
      const result = await res.json()
      if (!result.error) {
        setDomains(prev => prev.map(d =>
          d.id === domainId ? { ...d, health_score: result.healthScore, last_checked_at: new Date().toISOString() } : d
        ))
      }
      return result
    } catch {
      return { error: { message: 'Scan service unavailable' } }
    }
  }

  return { domains, loading, addDomain, removeDomain, verifyDomain, scanDomain, refetch: fetchDomainsBasic }
}
