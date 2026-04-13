// api/email-webhook.js
// Receives DMARC aggregate report emails via Resend inbound webhook
// Resend docs: https://resend.com/docs/dashboard/receiving/introduction

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')
const zlib = require('zlib')
const { promisify } = require('util')
const gunzip = promisify(zlib.gunzip)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── XML parser ────────────────────────────────────────────────────────────────
function getTag(str, tag) {
  const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : null
}
function getAllTags(str, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const out = []; let m
  while ((m = re.exec(str)) !== null) out.push(m[1].trim())
  return out
}
function parseXML(xml) {
  const meta = getTag(xml, 'report_metadata')
  const pol  = getTag(xml, 'policy_published')
  return {
    report_id:    meta ? getTag(meta, 'report_id') : null,
    org_name:     meta ? getTag(meta, 'org_name')  : null,
    email:        meta ? getTag(meta, 'email')     : null,
    report_begin: meta ? getTag(meta, 'begin')     : null,
    report_end:   meta ? getTag(meta, 'end')       : null,
    policy_domain: pol ? getTag(pol, 'domain') : null,
    policy_p:     pol ? getTag(pol, 'p')      : null,
    policy_sp:    pol ? getTag(pol, 'sp')     : null,
    policy_pct:   pol ? parseInt(getTag(pol, 'pct')) || 100 : 100,
    policy_adkim: pol ? getTag(pol, 'adkim')  : null,
    policy_aspf:  pol ? getTag(pol, 'aspf')   : null,
    records: getAllTags(xml, 'record').map(rec => {
      const row = getTag(rec, 'row')
      const ids = getTag(rec, 'identifiers')
      const pe  = getTag(rec, 'policy_evaluated')
      const ar  = getTag(rec, 'auth_results')
      const dk  = ar ? getTag(ar, 'dkim') : null
      const spf = ar ? getTag(ar, 'spf')  : null
      return {
        source_ip:     row ? getTag(row, 'source_ip') : null,
        count:         row ? parseInt(getTag(row, 'count')) || 0 : 0,
        disposition:   pe  ? getTag(pe, 'disposition') : null,
        dkim_result:   pe  ? getTag(pe, 'dkim')        : null,
        spf_result:    pe  ? getTag(pe, 'spf')         : null,
        header_from:   ids ? getTag(ids, 'header_from')   : null,
        envelope_from: ids ? getTag(ids, 'envelope_from') : null,
        dkim_domain:   dk  ? getTag(dk, 'domain')   : null,
        dkim_selector: dk  ? getTag(dk, 'selector') : null,
        spf_domain:    spf ? getTag(spf, 'domain')  : null,
      }
    }),
  }
}

// ── Decompress ────────────────────────────────────────────────────────────────
function unzip(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Not a ZIP')
  const fnLen    = buf.readUInt16LE(26)
  const extraLen = buf.readUInt16LE(28)
  const start    = 30 + fnLen + extraLen
  const method   = buf.readUInt16LE(8)
  const size     = buf.readUInt32LE(18)
  const data     = buf.slice(start, start + size)
  return method === 0 ? data : zlib.inflateRawSync(data)
}

async function decodeAttachment(base64, filename) {
  const buf  = Buffer.from(base64, 'base64')
  const name = (filename || '').toLowerCase()
  if (name.endsWith('.gz'))  return (await gunzip(buf)).toString('utf8')
  if (name.endsWith('.zip')) return unzip(buf).toString('utf8')
  try { return (await gunzip(buf)).toString('utf8') } catch {}
  return buf.toString('utf8')
}

// ── Ingest one report XML ─────────────────────────────────────────────────────
async function ingestXML(xml) {
  const parsed = parseXML(xml)
  if (!parsed.policy_domain) return { status: 'parse_failed' }

  const { data: dom } = await supabase.from('domains')
    .select('id, org_id').ilike('domain', parsed.policy_domain.trim()).single()
  if (!dom) return { status: 'domain_not_found', domain: parsed.policy_domain }

  // Deduplicate
  if (parsed.report_id) {
    const { data: ex } = await supabase.from('dmarc_aggregate_reports')
      .select('id').eq('report_id', parsed.report_id).single()
    if (ex) return { status: 'duplicate', domain: parsed.policy_domain }
  }

  const { data: report, error } = await supabase.from('dmarc_aggregate_reports').insert({
    domain_id:    dom.id,
    org_id:       dom.org_id,
    report_id:    parsed.report_id,
    org_name:     parsed.org_name,
    email:        parsed.email,
    report_begin: parsed.report_begin ? new Date(parseInt(parsed.report_begin) * 1000).toISOString() : null,
    report_end:   parsed.report_end   ? new Date(parseInt(parsed.report_end)   * 1000).toISOString() : null,
    policy_domain: parsed.policy_domain,
    policy_adkim: parsed.policy_adkim,
    policy_aspf:  parsed.policy_aspf,
    policy_p:     parsed.policy_p,
    policy_sp:    parsed.policy_sp,
    policy_pct:   parsed.policy_pct,
    raw_xml:      xml,
  }).select().single()

  if (error) return { status: 'db_error', error: error.message }

  if (parsed.records.length > 0) {
    await supabase.from('dmarc_report_records')
      .insert(parsed.records.map(r => ({ ...r, report_id: report.id })))
  }

  return { status: 'ingested', domain: parsed.policy_domain, records: parsed.records.length }
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, svix-id, svix-timestamp, svix-signature')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    // Direct XML ingest (replaces ingest-report.js)
    // Called from ReportsPage manual upload with { xml, domainId, orgId }
    const body = req.body
    if (body?.xml && body?.domainId) {
      const secret = req.headers['x-api-secret']
      if (secret !== process.env.INGEST_API_SECRET) return res.status(401).json({ error: 'Unauthorized' })
      const parsed = parseXML(body.xml)
      const { data: report, error: reportErr } = await supabase
        .from('dmarc_aggregate_reports')
        .insert({
          domain_id: body.domainId, org_id: body.orgId,
          report_id: parsed.report_id, org_name: parsed.org_name, email: parsed.email,
          report_begin: parsed.report_begin ? new Date(parseInt(parsed.report_begin)*1000).toISOString() : null,
          report_end:   parsed.report_end   ? new Date(parseInt(parsed.report_end)*1000).toISOString()   : null,
          policy_domain: parsed.policy_domain, policy_adkim: parsed.policy_adkim,
          policy_aspf: parsed.policy_aspf, policy_p: parsed.policy_p,
          policy_sp: parsed.policy_sp, policy_pct: parsed.policy_pct, raw_xml: body.xml,
        }).select().single()
      if (reportErr) return res.status(500).json({ error: reportErr.message })
      if (parsed.records.length > 0)
        await supabase.from('dmarc_report_records').insert(parsed.records.map(r => ({ ...r, report_id: report.id })))
      return res.status(200).json({ success: true, reportId: report.id, recordCount: parsed.records.length, domain: parsed.policy_domain })
    }

    const event = req.body
    console.log('Webhook event type:', event?.type)

    if (event?.type !== 'email.received') {
      return res.status(200).json({ message: 'Not an email.received event — ignored' })
    }

    const emailData = event.data
    const emailId   = emailData?.email_id
    const subject   = emailData?.subject || ''
    const attachments = emailData?.attachments || []

    console.log('Received email:', subject, '| attachments:', attachments.length)

    if (!attachments.length) {
      return res.status(200).json({ message: 'No attachments' })
    }

    const resend  = new Resend(process.env.RESEND_API_KEY)
    const results = []

    for (const att of attachments) {
      const filename = att.filename || ''
      const isReport = /\.(xml|gz|zip)$/i.test(filename) ||
        (att.content_type || '').match(/xml|gzip|zip/)

      if (!isReport) { console.log('Skipping non-report attachment:', filename); continue }

      // Use attachment content from webhook payload (Resend includes base64 content inline)
      const base64content = att.content
      if (!base64content) {
        console.error('No content in attachment:', filename)
        continue
      }

      let xml
      try { xml = await decodeAttachment(base64content, filename) }
      catch (e) { console.error('Decode error:', e.message); continue }

      if (!xml.includes('feedback') && !xml.includes('DMARC')) {
        console.log('Not a DMARC report, skipping')
        continue
      }

      const result = await ingestXML(xml)
      console.log('Ingest result:', result)
      results.push(result)
    }

    return res.status(200).json({ success: true, results })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ error: err.message })
  }
}
