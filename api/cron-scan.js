// api/cron-scan.js
// Vercel Cron — runs daily at 06:00 IST (00:30 UTC)
// Scans every active domain and fires alerts on detected changes
// Schedule is defined in vercel.json

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function dnsLookup(name, type) {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
    const res = await fetch(url, { headers: { Accept: 'application/dns-json' } })
    if (!res.ok) return []
    const data = await res.json()
    return data.Answer || []
  } catch { return [] }
}

function extractTxt(answers, prefix) {
  return answers.map(a => a.data?.replace(/"/g, '') || '').find(t => t.toLowerCase().startsWith(prefix)) || null
}

function parseDMARC(raw) {
  if (!raw) return null
  const tags = {}
  raw.split(';').forEach(p => {
    const [k, v] = p.trim().split('=')
    if (k && v !== undefined) tags[k.trim().toLowerCase()] = v.trim()
  })
  return { raw_record: raw, policy: tags.p || null, subdomain_policy: tags.sp || null,
    pct: parseInt(tags.pct) || 100, rua: tags.rua ? tags.rua.split(',').map(s => s.trim()) : [],
    ruf: tags.ruf ? tags.ruf.split(',').map(s => s.trim()) : [],
    adkim: tags.adkim || 'r', aspf: tags.aspf || 'r', fo: tags.fo || '0', ri: parseInt(tags.ri) || 86400 }
}

function calcHealth({ hasDMARC, policy, spfValid, spfExists, dkimFound, mxFound, bimiFound }) {
  let s = 0
  if (hasDMARC) { s += 10; if (policy === 'reject') s += 30; else if (policy === 'quarantine') s += 20; else s += 5 }
  if (spfExists) { s += 15; if (spfValid) s += 15; else s += 5 }
  if (dkimFound) s += 20
  if (mxFound)   s += 5
  if (bimiFound) s += 5
  return Math.min(s, 100)
}

async function scanDomain(domain, prevPolicy) {
  const [dmarcAns, spfAns, mxAns, bimiAns, dkimAns] = await Promise.all([
    dnsLookup(`_dmarc.${domain.domain}`, 'TXT'),
    dnsLookup(domain.domain, 'TXT'),
    dnsLookup(domain.domain, 'MX'),
    dnsLookup(`default._bimi.${domain.domain}`, 'TXT'),
    dnsLookup(`default._domainkey.${domain.domain}`, 'TXT'),
  ])

  const dmarcRaw  = extractTxt(dmarcAns, 'v=dmarc1')
  const spfRaw    = extractTxt(spfAns,   'v=spf1')
  const bimiRaw   = extractTxt(bimiAns,  'v=bimi1')
  const dkimFound = dkimAns.some(a => a.data?.includes('v=DKIM1'))
  const mxFound   = mxAns.length > 0
  const dmarc     = parseDMARC(dmarcRaw)

  const spfParts     = spfRaw ? spfRaw.split(/\s+/) : []
  const spfLookups   = spfParts.filter(p => ['include:', 'a', 'mx', 'ptr', 'exists:', 'redirect='].some(t => p.includes(t))).length
  const spfValid     = spfLookups <= 10

  const healthScore = calcHealth({
    hasDMARC: !!dmarc, policy: dmarc?.policy,
    spfExists: !!spfRaw, spfValid, dkimFound, mxFound, bimiFound: !!bimiRaw,
  })

  const alerts = []
  if (prevPolicy !== undefined && dmarc?.policy !== prevPolicy) {
    alerts.push({ type: 'dmarc_policy_change',
      message: `DMARC policy changed from p=${prevPolicy || 'none'} to p=${dmarc?.policy || 'none'} for ${domain.domain}.` })
  }
  if (spfRaw && !spfValid) {
    alerts.push({ type: 'spf_failure',
      message: `SPF record for ${domain.domain} has ${spfLookups} DNS lookups (max is 10). Email delivery may be affected.` })
  }
  if (domain.health_score && healthScore < domain.health_score - 20) {
    alerts.push({ type: 'health_score_drop',
      message: `Health score for ${domain.domain} dropped from ${domain.health_score} to ${healthScore}.` })
  }

  const now = new Date().toISOString()

  // Upsert DMARC
  if (dmarc) {
    await supabase.from('dmarc_records').update({ is_current: false }).eq('domain_id', domain.id).eq('is_current', true)
    await supabase.from('dmarc_records').insert({ domain_id: domain.id, ...dmarc, is_current: true, fetched_at: now })
  }
  // Upsert SPF
  if (spfRaw) {
    await supabase.from('spf_records').update({ is_current: false }).eq('domain_id', domain.id).eq('is_current', true)
    await supabase.from('spf_records').insert({ domain_id: domain.id, raw_record: spfRaw, lookup_count: spfLookups, is_valid: spfValid, is_current: true, fetched_at: now })
  }

  await supabase.from('domains').update({ health_score: healthScore, last_checked_at: now }).eq('id', domain.id)
  await supabase.from('dns_timeline').insert({ domain_id: domain.id, record_type: 'dmarc', new_value: dmarcRaw || 'No record', previous_value: prevPolicy ? `p=${prevPolicy}` : null, change_detected_at: now })

  return { healthScore, alerts }
}

module.exports = async function handler(req, res) {
  // Vercel Cron passes Authorization: Bearer <CRON_SECRET>
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { data: domains } = await supabase
      .from('domains').select('id, domain, org_id, health_score').eq('status', 'active')

    if (!domains?.length) return res.status(200).json({ scanned: 0 })

    // Get current DMARC policies for change detection
    const { data: currentDMARC } = await supabase
      .from('dmarc_records').select('domain_id, policy')
      .in('domain_id', domains.map(d => d.id)).eq('is_current', true)

    const prevPolicies = Object.fromEntries((currentDMARC || []).map(r => [r.domain_id, r.policy]))

    const results = []
    const alertsQueue = []
    const appUrl = process.env.APP_URL || 'https://dnsmonitor.easysecurity.in'

    // Scan in batches of 5 to be respectful to DNS
    for (let i = 0; i < domains.length; i += 5) {
      const batch = domains.slice(i, i + 5)
      const settled = await Promise.allSettled(
        batch.map(d => scanDomain(d, prevPolicies[d.id]))
      )
      settled.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          results.push(r.value)
          r.value.alerts.forEach(alert =>
            alertsQueue.push({ ...alert, domain: batch[idx] })
          )
        } else {
          console.error(`Scan failed for ${batch[idx].domain}:`, r.reason)
        }
      })
      if (i + 5 < domains.length) await new Promise(r => setTimeout(r, 600))
    }

    // Fire alerts via send-alert function
    for (const alert of alertsQueue) {
      await fetch(`${appUrl}/api/send-alert`, {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'x-api-secret':   process.env.INGEST_API_SECRET,
        },
        body: JSON.stringify({
          orgId:     alert.domain.org_id,
          domainId:  alert.domain.id,
          alertType: alert.type,
          message:   alert.message,
        }),
      }).catch(e => console.error('Alert send failed:', e.message))
    }

    return res.status(200).json({
      scanned:     results.length,
      alertsFired: alertsQueue.length,
      timestamp:   new Date().toISOString(),
    })
  } catch (err) {
    console.error('cron-scan error:', err)
    return res.status(500).json({ error: err.message })
  }
}
