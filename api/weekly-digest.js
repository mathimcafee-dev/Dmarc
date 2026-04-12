const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function scoreColor(s) { return s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626' }
function policyBadge(p) {
  const map = { reject: ['#dcfce7','#15803d'], quarantine: ['#fef3c7','#b45309'], none: ['#fee2e2','#dc2626'] }
  const [bg, color] = map[p] || ['#f1f5f9','#64748b']
  return `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:${bg};color:${color}">p=${p||'none'}</span>`
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = req.headers['authorization'] || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !req.query.force) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const resend  = new Resend(process.env.RESEND_API_KEY)
  const appUrl  = process.env.APP_URL || 'https://dnsmonitor.easysecurity.in'
  const from    = process.env.ALERT_FROM_EMAIL || 'DNSMonitor <mathivanan@easysecurity.in>'

  try {
    const { data: orgs } = await supabase.from('organisations').select('id, name')
    if (!orgs?.length) return res.status(200).json({ message: 'No orgs' })

    let sent = 0
    for (const org of orgs) {
      // Get domains
      const { data: domains } = await supabase.from('domains')
        .select('id, domain, health_score, dmarc_policy, status, last_checked_at')
        .eq('org_id', org.id).eq('status', 'active')
      if (!domains?.length) continue

      // Get member emails
      const { data: members } = await supabase.from('org_members')
        .select('user_id').eq('org_id', org.id).not('accepted_at', 'is', null)
      const { data: users } = await supabase.auth.admin.listUsers()
      const emails = (members || [])
        .map(m => users?.users?.find(u => u.id === m.user_id)?.email)
        .filter(Boolean)
      if (!emails.length) continue

      // Check user digest preferences — only send if enabled
      const avgScore   = Math.round(domains.reduce((s,d) => s + (d.health_score||0), 0) / domains.length)
      const critical   = domains.filter(d => (d.health_score||0) < 50)
      const rejectCount= domains.filter(d => d.dmarc_policy === 'reject').length
      const date       = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

      const domainRows = domains.map(d => `
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9">${d.domain}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:center">
            <span style="font-size:18px;font-weight:900;color:${scoreColor(d.health_score||0)}">${d.health_score||0}</span>
            <span style="font-size:10px;color:#94a3b8">/100</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">${policyBadge(d.dmarc_policy)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:${scoreColor(d.health_score||0)};font-weight:600">
            ${(d.health_score||0) >= 80 ? '✓ Healthy' : (d.health_score||0) >= 50 ? '⚠ Needs work' : '✗ Critical'}
          </td>
        </tr>`).join('')

      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#060d1a;padding:20px 28px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:16px;font-weight:700;color:#fff">DNS<span style="color:#60a5fa">Monitor</span></span>
    <span style="font-size:11px;color:#475569;background:rgba(255,255,255,0.05);padding:4px 10px;border-radius:99px">Weekly Digest</span>
  </div>
  <div style="padding:28px">
    <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 4px">DNS Health Summary</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 20px">${org.name} · ${date}</p>

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#1a6bff">${domains.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">Domains</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:${scoreColor(avgScore)}">${avgScore}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">Avg health</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#16a34a">${rejectCount}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">p=reject</div>
      </div>
    </div>

    ${critical.length ? `<div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#dc2626;font-weight:600">
      ⚠️ ${critical.length} domain${critical.length > 1 ? 's need' : ' needs'} immediate attention — health score below 50
    </div>` : `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#15803d;font-weight:600">
      ✓ All domains are healthy this week
    </div>`}

    <!-- Domain table -->
    <table style="width:100%;border-collapse:collapse;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase">Domain</th>
          <th style="padding:8px 14px;text-align:center;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase">Score</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase">DMARC</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase">Status</th>
        </tr>
      </thead>
      <tbody>${domainRows}</tbody>
    </table>

    <div style="margin-top:20px">
      <a href="${appUrl}/dashboard" style="display:inline-block;padding:10px 20px;background:#1a6bff;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">View full dashboard →</a>
    </div>
  </div>
  <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:14px 28px">
    <p style="font-size:11px;color:#94a3b8;margin:0">DNSMonitor · Developed by Mathivanan K with ♥ towards DNS · <a href="${appUrl}/settings" style="color:#1a6bff">Manage digest settings</a></p>
  </div>
</div></body></html>`

      for (const email of emails) {
        await resend.emails.send({ from, to: email, subject: `Weekly DNS digest — ${org.name}`, html })
        sent++
      }
    }
    return res.status(200).json({ success: true, sent })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
