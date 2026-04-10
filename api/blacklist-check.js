// api/blacklist-check.js
// Checks a domain against major DNS blacklists (DNSBLs)

const BLACKLISTS = [
  { name: 'Spamhaus ZEN',     host: 'zen.spamhaus.org',         type: 'ip' },
  { name: 'Spamhaus DBL',     host: 'dbl.spamhaus.org',         type: 'domain' },
  { name: 'SURBL',            host: 'multi.surbl.org',          type: 'domain' },
  { name: 'Barracuda',        host: 'b.barracudacentral.org',   type: 'ip' },
  { name: 'SpamCop',          host: 'bl.spamcop.net',           type: 'ip' },
  { name: 'MXToolbox',        host: 'dnsbl.mxtoolbox.com',      type: 'domain' },
  { name: 'UCEPROTECT L1',    host: 'dnsbl-1.uceprotect.net',  type: 'ip' },
  { name: 'Sorbs SPAM',       host: 'spam.dnsbl.sorbs.net',     type: 'ip' },
  { name: 'NordSpam',         host: 'combined.njabl.org',       type: 'domain' },
  { name: 'Invaluement',      host: 'ivmSIP.invaluement.com',   type: 'ip' },
]

async function dnsLookup(name) {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`
    const res = await fetch(url, { headers: { Accept: 'application/dns-json' } })
    if (!res.ok) return null
    const data = await res.json()
    return data.Answer?.[0]?.data || null
  } catch { return null }
}

async function resolveIP(domain) {
  return await dnsLookup(domain)
}

function reverseIP(ip) {
  return ip.split('.').reverse().join('.')
}

async function checkBlacklist(bl, domain, ip) {
  try {
    let lookup
    if (bl.type === 'ip' && ip) {
      lookup = `${reverseIP(ip)}.${bl.host}`
    } else if (bl.type === 'domain') {
      lookup = `${domain}.${bl.host}`
    } else {
      return { name: bl.name, listed: false, skipped: true }
    }
    const result = await dnsLookup(lookup)
    return { name: bl.name, listed: !!result, returnCode: result || null }
  } catch {
    return { name: bl.name, listed: false, error: true }
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { domain } = req.query
  if (!domain) return res.status(400).json({ error: 'domain is required' })

  const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()

  // Resolve IP
  const ip = await resolveIP(clean)

  // Check all blacklists in parallel
  const results = await Promise.all(
    BLACKLISTS.map(bl => checkBlacklist(bl, clean, ip))
  )

  const listed = results.filter(r => r.listed)
  const clean_count = results.filter(r => !r.listed && !r.skipped && !r.error).length

  return res.status(200).json({
    domain: clean,
    ip,
    checked: results.length,
    listed_count: listed.length,
    clean_count,
    status: listed.length === 0 ? 'clean' : listed.length <= 2 ? 'warning' : 'danger',
    results,
    checked_at: new Date().toISOString(),
  })
}
