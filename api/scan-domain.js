// api/scan-domain.js
// Full DNS scan: DMARC, SPF, DKIM, BIMI, MX via Cloudflare DoH
// Computes health score and upserts all records to Supabase

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
  return answers
    .map(a => a.data?.replace(/"/g, '') || '')
    .find(t => t.toLowerCase().startsWith(prefix)) || null
}

function parseDMARC(raw) {
  if (!raw) return null
  const tags = {}
  raw.split(';').forEach(p => {
    const [k, v] = p.trim().split('=')
    if (k && v !== undefined) tags[k.trim().toLowerCase()] = v.trim()
  })
  return {
    raw_record: raw,
    policy: tags.p || null,
    subdomain_policy: tags.sp || null,
    pct: parseInt(tags.pct) || 100,
    rua: tags.rua ? tags.rua.split(',').map(s => s.trim()) : [],
    ruf: tags.ruf ? tags.ruf.split(',').map(s => s.trim()) : [],
    adkim: tags.adkim || 'r',
    aspf: tags.aspf || 'r',
    fo: tags.fo || '0',
    ri: parseInt(tags.ri) || 86400,
  }
}

function parseSPF(raw) {
  if (!raw) return null
  const parts = raw.split(/\s+/)
  const mechanisms = parts.slice(1).map(p => {
    const qualifier = ['+', '-', '~', '?'].includes(p[0]) ? p[0] : '+'
    const mech = ['+', '-', '~', '?'].includes(p[0]) ? p.slice(1) : p
    const colonIdx = mech.indexOf(':')
    const eqIdx = mech.indexOf('=')
    const splitIdx = colonIdx > -1 ? colonIdx : eqIdx
    const type = splitIdx > -1 ? mech.slice(0, splitIdx) : mech
    const value = splitIdx > -1 ? mech.slice(splitIdx + 1) : ''
    return { qualifier, type: type.toLowerCase(), value }
  })
  const lookupTypes = ['include', 'a', 'mx', 'ptr', 'exists', 'redirect']
  const lookupCount = mechanisms.filter(m => lookupTypes.includes(m.type)).length
  return { raw_record: raw, mechanisms, lookup_count: lookupCount, is_valid: lookupCount <= 10 }
}

function calcHealthScore({ hasDMARC, dmarcPolicy, spf, dkimFound, mxFound, bimiFound }) {
  let score = 0
  if (hasDMARC) {
    score += 10
    if (dmarcPolicy === 'reject')     score += 30
    else if (dmarcPolicy === 'quarantine') score += 20
    else                              score += 5
  }
  if (spf) {
    score += 15
    if (spf.is_valid) score += 15
    else              score += 5
  }
  if (dkimFound) score += 20
  if (mxFound)   score += 5
  if (bimiFound) score += 5
  return Math.min(score, 100)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  const { domain, domainId } = req.query
  if (!domain || !domainId) return res.status(400).json({ error: 'domain and domainId required' })

  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '')

  try {
    const DKIM_SELECTORS = [
      'default', 'google', 'selector1', 'selector2',
      'mail', 'email', 'k1', 'k2', 's1', 's2',
      'dkim', 'mimecast', 'mailjet', 'sendgrid',
      'smtp', 'amazonses', 'mandrill', 'mailchimp',
      'zoho', 'outlook',
    ]

    const [dmarcAns, spfAns, mxAns, bimiAns, ...dkimAnswers] =
      await Promise.all([
        dnsLookup(`_dmarc.${safeDomain}`, 'TXT'),
        dnsLookup(safeDomain, 'TXT'),
        dnsLookup(safeDomain, 'MX'),
        dnsLookup(`default._bimi.${safeDomain}`, 'TXT'),
        ...DKIM_SELECTORS.map(s => dnsLookup(`${s}._domainkey.${safeDomain}`, 'TXT')),
      ])

    const dmarcRaw = extractTxt(dmarcAns, 'v=dmarc1')
    const spfRaw   = extractTxt(spfAns,   'v=spf1')
    const bimiRaw  = extractTxt(bimiAns,  'v=bimi1')

    const dkimSelectors = DKIM_SELECTORS
      .map((selector, i) => ({ selector, answers: dkimAnswers[i] || [] }))
      .filter(d => d.answers.some(a => a.data?.includes('v=DKIM1')))

    const dmarc   = parseDMARC(dmarcRaw)
    const spf     = parseSPF(spfRaw)
    const mxFound = mxAns.length > 0

    const healthScore = calcHealthScore({
      hasDMARC: !!dmarc,
      dmarcPolicy: dmarc?.policy,
      spf,
      dkimFound: dkimSelectors.length > 0,
      mxFound,
      bimiFound: !!bimiRaw,
    })

    const now = new Date().toISOString()

    // ── DMARC ──────────────────────────────────────────────────────────────
    if (dmarc) {
      await supabase.from('dmarc_records').update({ is_current: false })
        .eq('domain_id', domainId).eq('is_current', true)
      await supabase.from('dmarc_records').insert({
        domain_id: domainId, ...dmarc, is_current: true, fetched_at: now,
      })
    }

    // ── SPF ────────────────────────────────────────────────────────────────
    if (spf) {
      await supabase.from('spf_records').update({ is_current: false })
        .eq('domain_id', domainId).eq('is_current', true)
      await supabase.from('spf_records').insert({
        domain_id: domainId, ...spf, is_current: true, fetched_at: now,
      })
    }

    // ── DKIM ───────────────────────────────────────────────────────────────
    for (const dk of dkimSelectors) {
      const raw = dk.answers.find(a => a.data?.includes('v=DKIM1'))?.data?.replace(/"/g, '') || null
      await supabase.from('dkim_records').update({ is_current: false })
        .eq('domain_id', domainId).eq('selector', dk.selector).eq('is_current', true)
      await supabase.from('dkim_records').insert({
        domain_id: domainId, selector: dk.selector,
        raw_record: raw, is_valid: true, is_current: true, fetched_at: now,
      })
    }

    // ── BIMI ───────────────────────────────────────────────────────────────
    if (bimiRaw) {
      const bimiTags = {}
      bimiRaw.split(';').forEach(p => {
        const [k, v] = p.trim().split('=')
        if (k && v) bimiTags[k.trim().toLowerCase()] = v.trim()
      })
      await supabase.from('bimi_records').update({ is_current: false })
        .eq('domain_id', domainId).eq('is_current', true)
      await supabase.from('bimi_records').insert({
        domain_id: domainId, raw_record: bimiRaw,
        logo_url: bimiTags.l || null, vmc_url: bimiTags.a || null,
        is_valid: true, is_current: true, fetched_at: now,
      })
    }

    // ── Domain health + timeline ───────────────────────────────────────────
    await supabase.from('domains')
      .update({ health_score: healthScore, last_checked_at: now })
      .eq('id', domainId)

    await supabase.from('dns_timeline').insert([
      { domain_id: domainId, record_type: 'dmarc', new_value: dmarcRaw || 'No record', change_detected_at: now },
      { domain_id: domainId, record_type: 'spf',   new_value: spfRaw   || 'No record', change_detected_at: now },
    ])

    return res.status(200).json({
      domain: safeDomain,
      healthScore,
      dmarc:  dmarc  ? { policy: dmarc.policy, rua: dmarc.rua, pct: dmarc.pct } : null,
      spf:    spf    ? { lookupCount: spf.lookup_count, isValid: spf.is_valid }  : null,
      dkim:   { found: dkimSelectors.length > 0, selectors: dkimSelectors.map(d => d.selector) },
      bimi:   { found: !!bimiRaw },
      mx:     { found: mxFound, count: mxAns.length },
    })
  } catch (err) {
    console.error('scan-domain error:', err)
    return res.status(500).json({ error: 'Scan failed', details: err.message })
  }
}
