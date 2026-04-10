const { Resend } = require('resend')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, orgName, role, invitedBy, token } = req.body

  if (!email || !orgName || !token) {
    return res.status(400).json({ error: 'email, orgName and token are required' })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set')
    return res.status(500).json({ error: 'Email service not configured — RESEND_API_KEY missing' })
  }

  const appUrl   = process.env.APP_URL || 'https://dnsmonitor.easysecurity.in'
  const fromEmail = process.env.ALERT_FROM_EMAIL || 'DNSMonitor <mathivanan@easysecurity.in>'

  console.log('Sending invite to:', email, 'from:', fromEmail)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const roleLabels = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
    const roleLabel = roleLabels[role] || 'Member'
    const roleDesc = {
      owner: 'Full control including billing and deletion.',
      admin: 'Manage domains, members, and settings.',
      member: 'View and manage DNS records.',
      viewer: 'Read-only access to the organisation.',
    }[role] || ''

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to join ${orgName} on DNSMonitor`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#060d1a;padding:24px 32px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:16px;font-weight:700;color:#fff;">DNS<span style="color:#60a5fa;">Monitor</span></span>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">You're invited!</h1>
      <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">
        <strong style="color:#0f172a;">${invitedBy || 'A team member'}</strong> has invited you to join
        <strong style="color:#0f172a;">${orgName}</strong> on DNSMonitor as a
        <strong style="color:#1a6bff;">${roleLabel}</strong>.
      </p>
      <div style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Your role: ${roleLabel}</div>
        <div style="font-size:13px;color:#374151;">${roleDesc}</div>
      </div>
      <a href="${appUrl}/accept-invite?token=${token}" style="display:inline-block;background:#1a6bff;color:#fff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;">
        Accept invitation →
      </a>
      <p style="font-size:13px;color:#94a3b8;margin:20px 0 0;line-height:1.6;">
        Sign up or sign in with <strong>${email}</strong> to join automatically.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 32px;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        DNSMonitor by EasySecurity ·
        <a href="${appUrl}" style="color:#1a6bff;text-decoration:none;">dnsmonitor.easysecurity.in</a>
      </p>
      <p style="font-size:11px;color:#cbd5e1;margin:4px 0 0;">
        If you weren't expecting this, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`.trim(),
    })

    // Log the full Resend response so we can debug
    if (error) {
      console.error('Resend API error:', JSON.stringify(error))
      return res.status(500).json({ error: error.message || 'Failed to send email', details: error })
    }

    console.log('Invite email sent successfully, id:', data?.id)
    return res.status(200).json({ success: true, id: data?.id })

  } catch (err) {
    console.error('Send invite exception:', err?.message, err?.response?.data)
    return res.status(500).json({ error: err.message || 'Failed to send invitation email' })
  }
}
