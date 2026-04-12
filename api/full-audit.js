const dns = require('dns').promises

async function dnsLookup(name, type) {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { Accept: 'application/dns-json' } })
    if (!res.ok) return []
    const d = await res.json()
    return d.Answer || []
  } catch { return [] }
}

function extractTxt(ans, prefix) {
  return ans.map(a => (a.data||'').replace(/"/g,'')).find(t => t.toLowerCase().startsWith(prefix)) || null
}

// Known ESP IP ranges / MX patterns / SPF includes
const ESP_SIGNALS = [
  { name: 'Google Workspace',  mx: ['google.com','googlemail.com'], spf: ['_spf.google.com','google.com'], dkim: ['google'] },
  { name: 'Microsoft 365',     mx: ['outlook.com','protection.outlook.com'], spf: ['spf.protection.outlook.com'], dkim: ['selector1','selector2'] },
  { name: 'SendGrid',          mx: [], spf: ['sendgrid.net'], dkim: ['s1','s2','sendgrid'] },
  { name: 'Mailchimp/Mandrill',mx: [], spf: ['spf.mandrillapp.com'], dkim: ['mandrill','mailchimp','k1','k2'] },
  { name: 'Amazon SES',        mx: ['amazonses.com'], spf: ['amazonses.com'], dkim: ['amazonses'] },
  { name: 'Zoho Mail',         mx: ['zoho.com'], spf: ['zoho.com'], dkim: ['zoho'] },
  { name: 'Mimecast',          mx: ['mimecast.com'], spf: ['spf.mimecast.com'], dkim: ['mimecast'] },
]

function detectProviders(mxData, spfRaw, dkimSelectors) {
  const found = []
  const mxHosts = mxData.map(m => (m.data||'').toLowerCase())
  const spf     = (spfRaw||'').toLowerCase()
  const selectors = dkimSelectors.map(s => s.toLowerCase())

  for (const esp of ESP_SIGNALS) {
    let signal = null
    if (esp.mx.some(m => mxHosts.some(h => h.includes(m)))) signal = 'MX record'
    else if (esp.spf.some(s => spf.includes(s))) signal = 'SPF include'
    else if (esp.dkim.some(s => selectors.some(d => d.includes(s)))) signal = 'DKIM selector'
    if (signal) found.push({ name: esp.name, signal })
  }
  return found
}

function attackSurface(dmarc, spf, dkimCount, mxExists) {
  const policy = dmarc?.policy
  const vectors = [
    {
      vector: 'Direct domain spoofing',
      risk: !policy || policy === 'none' ? 'high' : policy === 'quarantine' ? 'medium' : 'low',
      desc: !policy ? 'No DMARC — anyone can spoof your domain and emails will be delivered'
          : policy === 'none' ? 'p=none monitors only — spoofed emails still reach inboxes'
          : policy === 'quarantine' ? 'p=quarantine moves spoofed emails to spam — good but not complete'
          : 'p=reject — spoofed emails are blocked at the server level',
    },
    {
      vector: 'Subdomain spoofing',
      risk: !dmarc?.subdomain_policy && (!policy || policy === 'none') ? 'high' : 'low',
      desc: dmarc?.subdomain_policy === 'reject' || policy === 'reject'
          ? 'Subdomains are protected via sp= tag or parent p=reject'
          : 'Subdomains may be vulnerable — add sp=reject to your DMARC record',
    },
    {
      vector: 'SPF bypass attack',
      risk: !spf ? 'high' : spf.is_valid ? 'low' : 'medium',
      desc: !spf ? 'No SPF record — mail servers cannot verify your sending sources'
          : spf.is_valid ? 'SPF is valid and within lookup limits'
          : 'SPF record has issues — may be bypassable',
    },
    {
      vector: 'Display name spoofing',
      risk: !policy || policy === 'none' ? 'medium' : 'low',
      desc: 'Attackers can fake the display name even with DMARC. User training and DKIM help reduce this.',
    },
  ]
  return vectors
}

function scoreFindings(findings) {
  const weights = { critical: 25, high: 15, medium: 8, low: 3 }
  let deductions = 0
  findings.filter(f => !f.pass).forEach(f => { deductions += weights[f.severity] || 0 })
  return Math.max(0, 100 - deductions)
}

function verdict(score) {
  if (score >= 90) return 'Excellent — enterprise grade'
  if (score >= 75) return 'Good — minor improvements needed'
  if (score >= 50) return 'Fair — significant gaps exist'
  if (score >= 25) return 'Poor — high spoofing risk'
  return 'Critical — immediate action required'
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { domain } = req.query
  if (!domain) return res.status(400).json({ error: 'domain required' })
  const d = domain.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase()

  try {
    // Parallel DNS lookups
    const DKIM_SELECTORS = ['default','google','selector1','selector2','mail','k1','s1','s2','dkim','amazonses','mandrill','mailchimp','zoho','sendgrid','mimecast']
    const [dmarcAns, spfAns, mxAns, bimiAns, ...dkimAns] = await Promise.all([
      dnsLookup(`_dmarc.${d}`, 'TXT'),
      dnsLookup(d, 'TXT'),
      dnsLookup(d, 'MX'),
      dnsLookup(`default._bimi.${d}`, 'TXT'),
      ...DKIM_SELECTORS.map(s => dnsLookup(`${s}._domainkey.${d}`, 'TXT')),
    ])

    const dmarcRaw  = extractTxt(dmarcAns, 'v=dmarc1')
    const spfRaw    = extractTxt(spfAns, 'v=spf1')
    const bimiRaw   = extractTxt(bimiAns, 'v=bimi1')
    const mxFound   = mxAns.length > 0
    const dkimFound = DKIM_SELECTORS.filter((_, i) => dkimAns[i]?.some(a => (a.data||'').includes('v=DKIM1')))

    // Parse DMARC
    let dmarc = null
    if (dmarcRaw) {
      const tags = {}
      dmarcRaw.split(';').forEach(p => { const [k,v] = p.trim().split('='); if (k&&v) tags[k.trim().toLowerCase()] = v.trim() })
      dmarc = { policy: tags.p, subdomain_policy: tags.sp, pct: parseInt(tags.pct)||100, rua: tags.rua, adkim: tags.adkim, aspf: tags.aspf }
    }

    // Parse SPF
    let spf = null
    if (spfRaw) {
      const lookups = (spfRaw.match(/\b(include|a|mx|exists|redirect|ptr)\b/gi) || []).length
      spf = { raw: spfRaw, is_valid: lookups <= 10, lookup_count: lookups }
    }

    // Build findings
    const findings = [
      // DMARC
      { category: 'dmarc', label: 'DMARC record exists',   pass: !!dmarc, severity: 'critical', desc: dmarc ? `DMARC record found: ${dmarcRaw?.slice(0,60)}…` : 'No DMARC record — your domain is unprotected against spoofing', fix: 'Add a TXT record at _dmarc.' + d, record: !dmarc ? `v=DMARC1; p=none; rua=mailto:dmarc@${d};` : null },
      { category: 'dmarc', label: 'DMARC policy enforced', pass: dmarc?.policy === 'reject', severity: dmarc?.policy === 'quarantine' ? 'medium' : 'high', desc: !dmarc ? 'No DMARC record' : dmarc.policy === 'reject' ? 'p=reject — full enforcement' : dmarc.policy === 'quarantine' ? 'p=quarantine — upgrade to p=reject for full protection' : 'p=none — monitoring only, no enforcement', fix: `Change p= to reject in your DMARC record`, record: dmarc && dmarc.policy !== 'reject' ? `v=DMARC1; p=reject; rua=${dmarc.rua||'mailto:dmarc@'+d};` : null },
      { category: 'dmarc', label: 'RUA reporting configured', pass: !!(dmarc?.rua), severity: 'medium', desc: dmarc?.rua ? `Aggregate reports sent to: ${dmarc.rua}` : 'No rua= tag — you cannot see who is sending email as your domain', fix: 'Add rua=mailto:reports@pwonka.resend.app to your DMARC record' },
      { category: 'dmarc', label: 'DMARC pct=100',         pass: !dmarc || dmarc.pct === 100, severity: 'low', desc: !dmarc ? 'No DMARC' : dmarc.pct === 100 ? 'pct=100 — policy applies to all messages' : `pct=${dmarc.pct} — policy only applies to ${dmarc.pct}% of messages` },
      // SPF
      { category: 'spf', label: 'SPF record exists',    pass: !!spf, severity: 'critical', desc: spf ? `SPF found: ${spfRaw?.slice(0,60)}…` : 'No SPF record — mail servers cannot verify your senders', fix: 'Add a TXT record at ' + d, record: !spf ? `v=spf1 mx a include:_spf.google.com ~all` : null },
      { category: 'spf', label: 'SPF lookup count ≤ 10', pass: !spf || spf.is_valid, severity: 'high', desc: !spf ? 'No SPF' : spf.is_valid ? `${spf.lookup_count} lookups — within the 10 limit` : `${spf.lookup_count} lookups — exceeds the 10 limit, SPF will fail`, fix: 'Reduce the number of include: mechanisms or use SPF flattening' },
      { category: 'spf', label: 'SPF ends with ~all or -all', pass: !!spf && (spfRaw?.includes('~all') || spfRaw?.includes('-all')), severity: 'medium', desc: spfRaw?.includes('-all') ? '-all (hard fail) — strongest setting' : spfRaw?.includes('~all') ? '~all (soft fail) — consider upgrading to -all' : 'Missing or +all — very weak SPF policy', fix: 'Change to -all for hard fail enforcement' },
      // DKIM
      { category: 'dkim', label: 'DKIM signing active',  pass: dkimFound.length > 0, severity: 'critical', desc: dkimFound.length > 0 ? `${dkimFound.length} DKIM selector(s) found: ${dkimFound.join(', ')}` : 'No DKIM records found across 15 common selectors — emails cannot be cryptographically signed', fix: 'Enable DKIM in your email provider (Google Workspace, Microsoft 365, etc)' },
      { category: 'dkim', label: 'Multiple DKIM selectors', pass: dkimFound.length >= 2, severity: 'low', desc: dkimFound.length >= 2 ? `${dkimFound.length} selectors — supports key rotation` : 'Only 1 selector — consider adding a second for key rotation without downtime' },
      // MX
      { category: 'mx', label: 'MX records exist',      pass: mxFound, severity: 'high', desc: mxFound ? `${mxAns.length} MX record(s) found` : 'No MX records — domain cannot receive email', fix: 'Add MX records for your mail provider' },
      // BIMI
      { category: 'bimi', label: 'BIMI record configured', pass: !!bimiRaw, severity: 'low', desc: bimiRaw ? `BIMI found: ${bimiRaw?.slice(0,60)}` : 'No BIMI record — your logo will not appear in Gmail/Apple Mail', fix: `Add a TXT record at default._bimi.${d}`, record: !bimiRaw ? `v=BIMI1; l=https://${d}/bimi-logo.svg;` : null },
      // Cross-protocol
      { category: 'other', label: 'DMARC without SPF',   pass: !(dmarc && !spf), severity: 'high', desc: dmarc && !spf ? 'DMARC is configured but SPF is missing — DMARC cannot pass without SPF or DKIM alignment' : 'DMARC and SPF are both present' },
      { category: 'other', label: 'BIMI requires p=reject', pass: !bimiRaw || dmarc?.policy === 'reject', severity: 'medium', desc: bimiRaw && dmarc?.policy !== 'reject' ? 'BIMI record exists but DMARC is not p=reject — Gmail will not show your logo' : bimiRaw ? 'BIMI and p=reject are both configured correctly' : 'No BIMI record' },
    ]

    const providers    = detectProviders(mxAns, spfRaw, dkimFound)
    const surface      = attackSurface(dmarc, spf, dkimFound.length, mxFound)
    const score        = scoreFindings(findings)
    const criticalCount= findings.filter(f => !f.pass && f.severity === 'critical').length

    return res.status(200).json({
      domain: d,
      score,
      verdict: verdict(score),
      summary: `Found ${findings.filter(f => !f.pass).length} issue(s) across ${findings.length} checks. ${criticalCount > 0 ? `${criticalCount} critical issue(s) require immediate attention.` : 'No critical issues found.'}`,
      findings,
      providers,
      attackSurface: surface,
      dmarc,
      spf,
      dkim: dkimFound,
      mx: mxFound,
      bimi: !!bimiRaw,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
