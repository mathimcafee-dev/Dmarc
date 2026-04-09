// api/send-alert.js
// Sends email alerts via Resend when DNS issues are detected
// POST with { orgId, domainId, alertType, message } + x-api-secret header

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return { skipped: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL || 'DNSMonitor <alerts@easysecurity.in>',
      to:   Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`)
  return res.json()
}

function buildEmail({ domain, alertType, message, orgName }) {
  const labels = {
    dmarc_policy_change: '🔔 DMARC Policy Changed',
    spf_failure:         '⚠️ SPF Record Issue',
    dkim_failure:        '⚠️ DKIM Record Issue',
    health_score_drop:   '📉 Health Score Dropped',
    new_sending_source:  '🔍 New Sending Source Detected',
    domain_expiry:       '⏰ Domain Expiry Warning',
  }
  const label   = labels[alertType] || 'DNS Alert'
  const appUrl  = process.env.APP_URL || 'https://dnsmonitor.easysecurity.in'

  return {
    subject: `${label} — ${domain} | DNSMonitor`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fc;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:2rem auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#0e1624;padding:1.5rem 2rem">
    <span style="color:white;font-weight:700;font-size:1rem">DNS<span style="color:#60a5fa">Monitor</span> by EasySecurity</span>
  </div>
  <div style="padding:2rem">
    <div style="display:inline-block;background:#fef3c7;color:#b45309;padding:4px 12px;border-radius:99px;font-size:.75rem;font-weight:600;margin-bottom:1rem">${label}</div>
    <h2 style="margin:0 0 .5rem;color:#0e1624">${domain}</h2>
    <p style="color:#606d87;line-height:1.6">${message}</p>
    <div style="background:#f8f9fc;border-radius:8px;padding:1rem;border-left:3px solid #1a6bff;margin:1.5rem 0">
      <div style="font-size:.75rem;font-weight:600;text-transform:uppercase;color:#8f9ab0;margin-bottom:.25rem">Organisation</div>
      <div style="font-size:.9375rem;color:#2a3347;font-weight:500">${orgName}</div>
    </div>
    <a href="${appUrl}/domains" style="display:inline-block;background:#1a6bff;color:white;padding:.625rem 1.375rem;border-radius:6px;text-decoration:none;font-weight:600">View in DNSMonitor →</a>
  </div>
  <div style="padding:1rem 2rem;border-top:1px solid #f1f3f8;background:#f8f9fc">
    <p style="margin:0;font-size:.75rem;color:#8f9ab0">
      You received this because alerts are configured for <strong>${domain}</strong>.
      <a href="${appUrl}/alerts" style="color:#1a6bff">Manage alerts</a>
    </p>
  </div>
</div>
</body></html>`,
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' })

  if (req.headers['x-api-secret'] !== process.env.INGEST_API_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const { orgId, domainId, alertType, message } = req.body
  if (!orgId || !alertType || !message)
    return res.status(400).json({ error: 'orgId, alertType, message required' })

  try {
    const [orgRes, domainRes, configRes] = await Promise.all([
      supabase.from('organisations').select('name').eq('id', orgId).single(),
      domainId
        ? supabase.from('domains').select('domain').eq('id', domainId).single()
        : Promise.resolve({ data: null }),
      supabase.from('alert_configs')
        .select('email_recipients')
        .eq('org_id', orgId)
        .eq('alert_type', alertType)
        .eq('is_enabled', true),
    ])

    const orgName    = orgRes.data?.name     || 'Your organisation'
    const domain     = domainRes.data?.domain || 'your domain'
    const recipients = (configRes.data || [])
      .flatMap(c => c.email_recipients)
      .filter(Boolean)

    // Always log the event
    await supabase.from('alert_events').insert({
      org_id:     orgId,
      domain_id:  domainId || null,
      alert_type: alertType,
      message,
    })

    if (!recipients.length)
      return res.status(200).json({ sent: false, reason: 'No recipients configured' })

    const email = buildEmail({ domain, alertType, message, orgName })
    await sendEmail({ to: recipients, ...email })

    return res.status(200).json({ sent: true, recipients: recipients.length })
  } catch (err) {
    console.error('send-alert error:', err)
    return res.status(500).json({ error: 'Alert failed', details: err.message })
  }
}
