// api/verify-domain.js
// Vercel serverless function — proxies DNS TXT lookup via Cloudflare DoH

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { domain, token } = req.query
  if (!domain || !token) return res.status(400).json({ error: 'domain and token are required' })

  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '')
  if (!safeDomain || safeDomain.length > 253) return res.status(400).json({ error: 'Invalid domain' })

  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${safeDomain}&type=TXT`
    const response = await fetch(url, { headers: { Accept: 'application/dns-json' } })
    if (!response.ok) throw new Error(`DNS query failed: ${response.status}`)
    const data = await response.json()
    const answers = data.Answer || []
    const verified = answers.some(answer => {
      const txt = answer.data?.replace(/"/g, '') || ''
      return txt.includes(`_dnsmonitor-verification=${token}`)
    })
    return res.status(200).json({ verified, domain: safeDomain, answers: answers.map(a => a.data) })
  } catch (err) {
    console.error('verify-domain error:', err)
    return res.status(500).json({ error: 'DNS lookup failed', details: err.message })
  }
}
