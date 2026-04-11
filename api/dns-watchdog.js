// api/dns-watchdog.js
// Compares latest DNS records against previous scan and fires alerts on changes
// Called by cron-job.org after every scan completes
// POST with Authorization: Bearer <CRON_SECRET>

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function severity(change) {
  // Downgrade = critical, new record = info, removal = warning
  if (change.type === 'dmarc_downgrade') return 'critical'
  if (change.type === 'dmarc_removed')   return 'critical'
  if (change.type === 'spf_removed')     return 'critical'
  if (change.type === 'dkim_removed')    return 'warning'
  if (change.type === 'spf_changed')     return 'warning'
  return 'info'
}

function describeChange(change) {
  switch (change.type) {
    case 'dmarc_downgrade': return `🚨 DMARC policy weakened: ${change.from} → ${change.to}`
    case 'dmarc_policy':    return `ℹ️ DMARC policy changed: ${change.from} → ${change.to}`
    case 'dmarc_removed':   return `🚨 DMARC record removed — domain is now unprotected`
    case 'dmarc_added':     return `✅ DMARC record added (p=${change.to})`
    case 'spf_changed':     return `⚠️ SPF record changed`
    case 'spf_removed':     return `🚨 SPF record removed`
    case 'spf_added':       return `✅ SPF record added`
    case 'dkim_removed':    return `⚠️ DKIM selector removed: ${change.selector}`
    case 'dkim_added':      return `✅ DKIM selector added: ${change.selector}`
    default:                return `ℹ️ DNS change detected`
  }
}

async function detectChanges(domainId, domainName) {
  const changes = []

  // ── DMARC ─────────────────────────────────────────────────
  const { data: dmarcRecords } = await supabase
    .from('dmarc_records').select('policy, raw_record, created_at')
    .eq('domain_id', domainId).order('created_at', { ascending: false }).limit(2)

  if (dmarcRecords?.length >= 2) {
    const [curr, prev] = dmarcRecords
    if (!curr.policy && prev.policy) {
      changes.push({ type: 'dmarc_removed', from: prev.policy, to: null })
    } else if (curr.policy && !prev.policy) {
      changes.push({ type: 'dmarc_added', from: null, to: curr.policy })
    } else if (curr.policy !== prev.policy) {
      const order = ['reject', 'quarantine', 'none']
      const downgrade = order.indexOf(curr.policy) > order.indexOf(prev.policy)
      changes.push({ type: downgrade ? 'dmarc_downgrade' : 'dmarc_policy', from: `p=${prev.policy}`, to: `p=${curr.policy}` })
    }
  } else if (dmarcRecords?.length === 1 && !dmarcRecords[0].policy) {
    changes.push({ type: 'dmarc_removed', from: 'unknown', to: null })
  }

  // ── SPF ───────────────────────────────────────────────────
  const { data: spfRecords } = await supabase
    .from('spf_records').select('raw_record, is_valid, created_at')
    .eq('domain_id', domainId).order('created_at', { ascending: false }).limit(2)

  if (spfRecords?.length >= 2) {
    const [curr, prev] = spfRecords
    if (!curr.raw_record && prev.raw_record) {
      changes.push({ type: 'spf_removed' })
    } else if (curr.raw_record && !prev.raw_record) {
      changes.push({ type: 'spf_added' })
    } else if (curr.raw_record !== prev.raw_record) {
      changes.push({ type: 'spf_changed', from: prev.raw_record, to: curr.raw_record })
    }
  }

  // ── DKIM ──────────────────────────────────────────────────
  const { data: dkimCurr } = await supabase.from('dkim_records').select('selector, created_at')
    .eq('domain_id', domainId).eq('is_current', true)
  const { data: dkimPrev } = await supabase.from('dkim_records').select('selector, created_at')
    .eq('domain_id', domainId).eq('is_current', false).order('created_at', { ascending: false })

  const currSelectors = new Set((dkimCurr || []).map(d => d.selector))
  const prevSelectors = new Set((dkimPrev || []).map(d => d.selector))

  for (const s of prevSelectors) {
    if (!currSelectors.has(s)) changes.push({ type: 'dkim_removed', selector: s })
  }
  for (const s of currSelectors) {
    if (!prevSelectors.has(s)) changes.push({ type: 'dkim_added', selector: s })
  }

  return changes
}

async function sendAlert(email, domainName, changes, appUrl) {
  const resend   = new Resend(process.env.RESEND_API_KEY)
  const critical = changes.filter(c => severity(c) === 'critical')
  const subject  = critical.length
    ? `🚨 Security alert: ${domainName} DNS changes detected`
    : `⚠️ DNS changes detected on ${domainName}`

  const rows = changes.map(c => {
    const sev   = severity(c)
    const color = sev === 'critical' ? '#dc2626' : sev === 'warning' ? '#d97706' : '#16a34a'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${color};font-weight:600">${describeChange(c)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700">${sev}</td>
    </tr>`
  }).join('')

  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL || 'DNSMonitor <mathivanan@easysecurity.in>',
    to: email,
    subject,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
  <div style="background:#060d1a;padding:20px 28px">
    <span style="font-size:15px;font-weight:700;color:#fff">DNS<span style="color:#60a5fa">Monitor</span></span>
  </div>
  <div style="padding:28px">
    <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 6px">DNS changes detected</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 20px">The following changes were detected on <strong>${domainName}</strong> in the last scan.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Change</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Severity</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${critical.length ? `<div style="margin-top:16px;padding:12px 14px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#dc2626;font-weight:600">⚠️ Critical changes detected — review your DNS immediately to ensure email deliverability is not affected.</div>` : ''}
    <div style="margin-top:20px">
      <a href="${appUrl}/domains" style="display:inline-block;padding:10px 20px;background:#1a6bff;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Review in DNSMonitor →</a>
    </div>
  </div>
  <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:14px 28px">
    <p style="font-size:11px;color:#94a3b8;margin:0">DNSMonitor · Developed by Mathivanan K with ♥ towards DNS</p>
  </div>
</div></body></html>`
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = req.headers['authorization'] || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const appUrl = process.env.APP_URL || 'https://dnsmonitor.easysecurity.in'

  try {
    // Get all active domains
    const { data: domains } = await supabase.from('domains')
      .select('id, domain, org_id').eq('status', 'active')

    if (!domains?.length) return res.status(200).json({ message: 'No active domains' })

    const results = []

    for (const domain of domains) {
      const changes = await detectChanges(domain.id, domain.domain)
      if (!changes.length) { results.push({ domain: domain.domain, changes: 0 }); continue }

      // Get org member emails
      const { data: members } = await supabase.from('org_members')
        .select('user_id').eq('org_id', domain.org_id).not('accepted_at', 'is', null)

      const { data: users } = await supabase.auth.admin.listUsers()
      const emails = (members || [])
        .map(m => users?.users?.find(u => u.id === m.user_id)?.email)
        .filter(Boolean)

      for (const email of emails) {
        await sendAlert(email, domain.domain, changes, appUrl)
      }

      // Store alert in DB
      await supabase.from('alerts').insert({
        domain_id: domain.id,
        org_id:    domain.org_id,
        type:      'dns_change',
        severity:  changes.some(c => severity(c) === 'critical') ? 'critical' : 'warning',
        message:   `${changes.length} DNS change(s) detected: ${changes.map(describeChange).join(', ')}`,
      })

      results.push({ domain: domain.domain, changes: changes.length, emails: emails.length })
    }

    return res.status(200).json({ success: true, results })
  } catch (err) {
    console.error('Watchdog error:', err)
    return res.status(500).json({ error: err.message })
  }
}
