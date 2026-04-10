const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, role, password, orgId, orgName, invitedBy } = req.body

  if (!email || !role || !password || !orgId || !orgName) {
    return res.status(400).json({ error: 'email, role, password, orgId and orgName are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // Service role client — can create users server-side
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // ── Step 1: Create or fetch the user ──────────────────────────────────────
    let userId

    // Try to create user
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so they can login immediately
    })

    if (createErr) {
      if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists')) {
        // User exists — update their password and proceed
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existing = existingUsers?.users?.find(u => u.email === email)
        if (!existing) return res.status(400).json({ error: 'User exists but could not be found' })
        userId = existing.id

        // Update their password
        await supabase.auth.admin.updateUserById(userId, { password })
      } else {
        console.error('Create user error:', createErr)
        return res.status(500).json({ error: createErr.message })
      }
    } else {
      userId = newUser.user.id
    }

    // ── Step 2: Create profile if missing ─────────────────────────────────────
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: email.split('@')[0],
    }, { onConflict: 'id', ignoreDuplicates: true })

    // ── Step 3: Add to org_members ────────────────────────────────────────────
    const { error: memberErr } = await supabase.from('org_members').upsert({
      org_id: orgId,
      user_id: userId,
      role,
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'org_id,user_id' })

    if (memberErr) {
      console.error('Add to org error:', memberErr)
      return res.status(500).json({ error: 'Account created but failed to add to organisation: ' + memberErr.message })
    }

    // ── Step 4: Mark any pending invitations as accepted ──────────────────────
    await supabase.from('org_invitations')
      .update({ accepted_at: new Date().toISOString(), user_id: userId })
      .eq('org_id', orgId)
      .eq('email', email)
      .is('accepted_at', null)

    // ── Step 5: Send login credentials email ──────────────────────────────────
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping email')
      return res.status(200).json({ success: true, userId, emailSent: false })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const appUrl = process.env.APP_URL || 'https://dnsmonitor.easysecurity.in'
    const fromEmail = process.env.ALERT_FROM_EMAIL || 'DNSMonitor <mathivanan@easysecurity.in>'

    const roleLabels = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
    const roleDescs = {
      owner:  'Full control including billing and deletion.',
      admin:  'Manage domains, members, and settings.',
      member: 'View and manage DNS records.',
      viewer: 'Read-only access to the organisation.',
    }

    const { error: emailErr } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been added to ${orgName} on DNSMonitor`,
      html: [
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
        '<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">',
        '<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">',

        // Header
        '<div style="background:#060d1a;padding:24px 32px;">',
        '<span style="font-size:16px;font-weight:700;color:#fff;">DNS<span style="color:#60a5fa;">Monitor</span></span>',
        '</div>',

        // Body
        '<div style="padding:32px;">',
        '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 10px;">Your account is ready</h1>',
        '<p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.6;">',
        '<strong style="color:#0f172a;">' + (invitedBy || 'An admin') + '</strong>',
        ' has added you to <strong style="color:#0f172a;">' + orgName + '</strong>',
        ' as a <strong style="color:#1a6bff;">' + (roleLabels[role] || role) + '</strong>.',
        ' You can log in right now using the credentials below.',
        '</p>',

        // Credentials box
        '<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">',
        '<div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;">Your login credentials</div>',
        '<div style="margin-bottom:10px;">',
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Email</div>',
        '<div style="font-size:15px;font-weight:600;color:#0f172a;font-family:monospace;">' + email + '</div>',
        '</div>',
        '<div>',
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Password</div>',
        '<div style="font-size:15px;font-weight:600;color:#0f172a;font-family:monospace;letter-spacing:0.08em;">' + password + '</div>',
        '</div>',
        '</div>',

        // Role info
        '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:24px;">',
        '<div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Your role: ' + (roleLabels[role] || role) + '</div>',
        '<div style="font-size:13px;color:#374151;">' + (roleDescs[role] || '') + '</div>',
        '</div>',

        // CTA button
        '<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">',
        '<tr><td style="background:#1a6bff;border-radius:8px;padding:0;">',
        '<a href="' + appUrl + '/login" target="_blank" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">',
        'Log in to DNSMonitor &rarr;',
        '</a>',
        '</td></tr></table>',

        // Plain text fallback
        '<p style="font-size:12px;color:#94a3b8;margin:4px 0 16px;line-height:1.6;">',
        'Or visit: <a href="' + appUrl + '/login" style="color:#1a6bff;">' + appUrl + '/login</a>',
        '</p>',

        '<p style="font-size:13px;color:#94a3b8;margin:0;line-height:1.6;">',
        'You can change your password anytime from Settings after logging in.',
        '</p>',
        '</div>',

        // Footer
        '<div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 32px;">',
        '<p style="font-size:12px;color:#94a3b8;margin:0;">DNSMonitor by EasySecurity &middot; <a href="' + appUrl + '" style="color:#1a6bff;text-decoration:none;">dnsmonitor.easysecurity.in</a></p>',
        '<p style="font-size:11px;color:#cbd5e1;margin:4px 0 0;">Keep these credentials safe. If you didn\'t expect this email, please ignore it.</p>',
        '</div>',
        '</div></body></html>',
      ].join('\n'),
    })

    if (emailErr) {
      console.error('Email error:', emailErr)
      // Account was created successfully — email failure is non-fatal
      return res.status(200).json({ success: true, userId, emailSent: false, emailError: emailErr.message })
    }

    return res.status(200).json({ success: true, userId, emailSent: true })

  } catch (err) {
    console.error('invite-member error:', err)
    return res.status(500).json({ error: err.message || 'Failed to invite member' })
  }
}
