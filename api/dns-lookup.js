// api/dns-lookup.js
// Public DNS lookup proxy — used by DMARC/SPF/DKIM checker pages
// Queries Cloudflare DoH so there are zero browser CORS issues

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { domain, type = 'TXT', prefix } = req.query
  if (!domain) return res.status(400).json({ error: 'domain is required' })

  const safeDomain = domain.replace(/[^a-zA-Z0-9._-]/g, '')
  const safeType = ['TXT', 'MX', 'A', 'AAAA', 'CNAME', 'NS'].includes(type.toUpperCase())
    ? type.toUpperCase()
    : 'TXT'

  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(safeDomain)}&type=${safeType}`
    const cfRes = await fetch(url, { headers: { Accept: 'application/dns-json' } })
    if (!cfRes.ok) throw new Error(`DNS query returned ${cfRes.status}`)
    const data = await cfRes.json()

    let records = (data.Answer || []).map(a => ({
      name: a.name,
      type: a.type,
      ttl: a.TTL,
      data: a.data?.replace(/"/g, '') || '',
    }))

    if (prefix) {
      records = records.filter(r => r.data.toLowerCase().startsWith(prefix.toLowerCase()))
    }

    return res.status(200).json({
      domain: safeDomain,
      type: safeType,
      records,
      status: data.Status,
      queried_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('dns-lookup error:', err)
    return res.status(500).json({ error: 'DNS lookup failed', details: err.message })
  }
}
