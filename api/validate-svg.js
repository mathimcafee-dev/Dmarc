module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url required' })
  if (!url.startsWith('https://')) return res.status(200).json({ valid: false, error: 'Logo must be hosted on HTTPS' })

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'DNSMonitor-BIMI-Validator/1.0' } })
    if (!response.ok) return res.status(200).json({ valid: false, error: `HTTP ${response.status} — could not fetch SVG` })

    const ct = response.headers.get('content-type') || ''
    if (!ct.includes('svg') && !ct.includes('xml') && !ct.includes('text')) {
      return res.status(200).json({ valid: false, error: `Wrong content type: ${ct} — must be image/svg+xml` })
    }

    const svg  = await response.text()
    const size = Buffer.byteLength(svg, 'utf8')

    // DigiCert VMC checks
    const errors = []

    if (!svg.trim().startsWith('<svg') && !svg.includes('<svg')) errors.push('Not a valid SVG file')
    if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) errors.push('Missing SVG namespace declaration')

    // Tiny 1.2 profile
    const hasTiny = svg.includes('baseProfile="tiny"') || svg.includes("baseProfile='tiny'")
    if (!hasTiny) errors.push('Missing SVG Tiny 1.2 profile (baseProfile="tiny")')

    // Square viewBox
    const vbMatch = svg.match(/viewBox=["\']([^"\']+)["\']/i)
    if (!vbMatch) {
      errors.push('Missing viewBox attribute — required for VMC')
    } else {
      const [,x,y,w,h] = vbMatch[1].trim().split(/\s+/).map(Number)
      if (Math.abs(w - h) > 1) errors.push(`Non-square viewBox: ${vbMatch[1]} — width and height must be equal`)
    }

    // No raster images
    if (svg.includes('<image') || svg.includes('data:image/png') || svg.includes('data:image/jpg')) {
      errors.push('Contains raster image elements — VMC requires pure vector SVG')
    }

    // No scripts
    if (svg.includes('<script') || svg.includes('javascript:')) {
      errors.push('Contains scripts — not allowed in VMC SVG')
    }

    // No external references
    if (svg.match(/href="http/i) || svg.match(/xlink:href="http/i)) {
      errors.push('Contains external URL references — SVG must be self-contained')
    }

    // No animations
    if (svg.includes('<animate') || svg.includes('<animateTransform')) {
      errors.push('Contains animations — VMC requires static SVG')
    }

    // File size
    const sizeKB = Math.round(size / 1024)
    if (size > 32768) errors.push(`File size ${sizeKB}KB exceeds 32KB DigiCert limit`)

    return res.status(200).json({
      valid: errors.length === 0,
      error: errors[0] || null,
      errors,
      sizeKB,
      checks: {
        https: true,
        isSVG: svg.includes('<svg'),
        tinyProfile: hasTiny,
        squareViewBox: vbMatch ? true : false,
        noRaster: !svg.includes('<image'),
        noScripts: !svg.includes('<script'),
        sizeOK: size <= 32768,
      }
    })
  } catch (err) {
    return res.status(200).json({ valid: false, error: `Could not fetch: ${err.message}` })
  }
}
