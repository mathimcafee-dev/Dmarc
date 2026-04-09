// api/ingest-report.js
// Parses DMARC aggregate XML reports (RUA) and stores them in Supabase
// POST with { xml, domainId, orgId } + x-api-secret header

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getTag(str, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = str.match(re)
  return m ? m[1].trim() : null
}

function getAllTags(str, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const results = []
  let m
  while ((m = re.exec(str)) !== null) results.push(m[1].trim())
  return results
}

function parseXML(xml) {
  const metadata      = getTag(xml, 'report_metadata')
  const policyPublished = getTag(xml, 'policy_published')
  const records       = getAllTags(xml, 'record')

  return {
    report_id:     metadata ? getTag(metadata, 'report_id') : null,
    org_name:      metadata ? getTag(metadata, 'org_name')  : null,
    email:         metadata ? getTag(metadata, 'email')     : null,
    report_begin:  metadata ? getTag(metadata, 'begin')     : null,
    report_end:    metadata ? getTag(metadata, 'end')       : null,
    policy_domain: policyPublished ? getTag(policyPublished, 'domain') : null,
    policy_adkim:  policyPublished ? getTag(policyPublished, 'adkim')  : null,
    policy_aspf:   policyPublished ? getTag(policyPublished, 'aspf')   : null,
    policy_p:      policyPublished ? getTag(policyPublished, 'p')      : null,
    policy_sp:     policyPublished ? getTag(policyPublished, 'sp')     : null,
    policy_pct:    policyPublished ? parseInt(getTag(policyPublished, 'pct')) || 100 : 100,
    records: records.map(rec => {
      const row         = getTag(rec, 'row')
      const identifiers = getTag(rec, 'identifiers')
      const authResults = getTag(rec, 'auth_results')
      const policyEval  = getTag(rec, 'policy_evaluated')
      const dkimAuth    = authResults ? getTag(authResults, 'dkim') : null
      const spfAuth     = authResults ? getTag(authResults, 'spf')  : null
      return {
        source_ip:        row        ? getTag(row, 'source_ip')           : null,
        count:            row        ? parseInt(getTag(row, 'count')) || 0 : 0,
        disposition:      policyEval ? getTag(policyEval, 'disposition')  : null,
        dkim_result:      policyEval ? getTag(policyEval, 'dkim')         : null,
        spf_result:       policyEval ? getTag(policyEval, 'spf')          : null,
        header_from:      identifiers ? getTag(identifiers, 'header_from')  : null,
        envelope_from:    identifiers ? getTag(identifiers, 'envelope_from'): null,
        dkim_domain:      dkimAuth   ? getTag(dkimAuth, 'domain')         : null,
        dkim_selector:    dkimAuth   ? getTag(dkimAuth, 'selector')       : null,
        dkim_human_result:dkimAuth   ? getTag(dkimAuth, 'human_result')   : null,
        spf_domain:       spfAuth    ? getTag(spfAuth,  'domain')         : null,
        spf_scope:        spfAuth    ? getTag(spfAuth,  'scope')          : null,
        spf_human_result: spfAuth    ? getTag(spfAuth,  'human_result')   : null,
      }
    }),
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' })

  const secret = req.headers['x-api-secret']
  if (secret !== process.env.INGEST_API_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const { xml, domainId, orgId } = req.body
  if (!xml || !domainId || !orgId)
    return res.status(400).json({ error: 'xml, domainId, orgId required' })

  try {
    const parsed = parseXML(xml)

    const { data: report, error: reportErr } = await supabase
      .from('dmarc_aggregate_reports')
      .insert({
        domain_id:    domainId,
        org_id:       orgId,
        report_id:    parsed.report_id,
        org_name:     parsed.org_name,
        email:        parsed.email,
        report_begin: parsed.report_begin
          ? new Date(parseInt(parsed.report_begin) * 1000).toISOString() : null,
        report_end:   parsed.report_end
          ? new Date(parseInt(parsed.report_end) * 1000).toISOString()   : null,
        policy_domain: parsed.policy_domain,
        policy_adkim:  parsed.policy_adkim,
        policy_aspf:   parsed.policy_aspf,
        policy_p:      parsed.policy_p,
        policy_sp:     parsed.policy_sp,
        policy_pct:    parsed.policy_pct,
        raw_xml:       xml,
      })
      .select()
      .single()

    if (reportErr) throw reportErr

    if (parsed.records.length > 0) {
      const rows = parsed.records.map(r => ({ ...r, report_id: report.id }))
      const { error: rowsErr } = await supabase.from('dmarc_report_records').insert(rows)
      if (rowsErr) console.error('Failed to insert report records:', rowsErr)
    }

    return res.status(200).json({
      success:     true,
      reportId:    report.id,
      recordCount: parsed.records.length,
      domain:      parsed.policy_domain,
    })
  } catch (err) {
    console.error('ingest-report error:', err)
    return res.status(500).json({ error: 'Ingest failed', details: err.message })
  }
}
