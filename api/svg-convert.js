// api/svg-convert.js
// Converts PNG/JPG/SVG to VMC-compliant SVG Tiny 1.2 P/S format
// Uses potrace for bitmap tracing and custom VMC cleanup

const potrace = require('potrace')

// ── VMC SVG cleanup ───────────────────────────────────────────────────────────
function makeVMCCompliant(svgText, companyName, color) {
  // Parse viewBox
  const vbMatch = svgText.match(/viewBox=["']([^"']+)["']/)
  let viewBox = vbMatch ? vbMatch[1] : '0 0 100 100'
  const parts = viewBox.trim().split(/[\s,]+/).map(Number)

  // Make viewBox square
  if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
    const size = Math.max(parts[2], parts[3])
    viewBox = `0 0 ${size} ${size}`
  }

  // Extract all path/shape content — strip outer svg wrapper
  const innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
  let inner = innerMatch ? innerMatch[1] : ''

  // Remove forbidden elements
  inner = inner
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<image[\s\S]*?\/>/gi, '')
    .replace(/<image[\s\S]*?<\/image>/gi, '')
    .replace(/<animate[\s\S]*?\/>/gi, '')
    .replace(/<animateTransform[\s\S]*?\/>/gi, '')
    .replace(/<animateMotion[\s\S]*?\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/on\w+="[^"]*"/g, '')

  // Apply colour if specified (replace fill on traced paths)
  if (color && color !== '#000000') {
    inner = inner.replace(/fill="[^"]*"/g, `fill="${color}"`)
    if (!inner.includes('fill=')) {
      inner = inner.replace(/<path /g, `<path fill="${color}" `)
    }
  }

  const name = companyName || 'Brand Logo'

  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="${viewBox}">
<title>${name}</title>
${inner.trim()}
</svg>`
}

// ── Trace bitmap to SVG ───────────────────────────────────────────────────────
function traceBitmap(buffer, color) {
  return new Promise((resolve, reject) => {
    const opts = {
      color: color || '#000000',
      background: 'transparent',
      threshold: 128,
      turdSize: 2,
      optTolerance: 0.4,
    }
    potrace.trace(buffer, opts, (err, svg) => {
      if (err) reject(err)
      else resolve(svg)
    })
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { data, mimeType, companyName, color } = req.body

    if (!data || !mimeType) {
      return res.status(400).json({ error: 'data and mimeType are required' })
    }

    const buffer = Buffer.from(data, 'base64')
    let svgText

    if (mimeType === 'image/svg+xml') {
      // SVG — just clean it up
      svgText = buffer.toString('utf8')
    } else if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      // Bitmap — trace to SVG
      svgText = await traceBitmap(buffer, color || '#000000')
    } else {
      return res.status(400).json({ error: `Unsupported format: ${mimeType}. Use PNG, JPG, or SVG.` })
    }

    // Apply VMC compliance
    const vmcSvg = makeVMCCompliant(svgText, companyName, color)
    const sizeBytes = Buffer.byteLength(vmcSvg, 'utf8')

    return res.status(200).json({
      svg: vmcSvg,
      sizeBytes,
      sizeKB: (sizeBytes / 1024).toFixed(1),
      compliant: sizeBytes <= 32768,
    })
  } catch (err) {
    console.error('SVG conversion error:', err)
    return res.status(500).json({ error: err.message || 'Conversion failed' })
  }
}
