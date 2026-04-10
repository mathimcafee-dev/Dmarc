const potrace = require('potrace')
const sharp = require('sharp')

// ── Analyse image colours using sharp ────────────────────────────────────────
async function analyzeImage(buf) {
  const { data, info } = await sharp(buf)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const colorMap = new Map()
  const step = channels * 3 // sample every 3rd pixel

  for (let i = 0; i < data.length; i += step) {
    const a = channels === 4 ? data[i + 3] : 255
    if (a < 128) continue
    const r = Math.round(data[i]     / 32) * 32
    const g = Math.round(data[i + 1] / 32) * 32
    const b = Math.round(data[i + 2] / 32) * 32
    const key = `${r},${g},${b}`
    colorMap.set(key, (colorMap.get(key) || 0) + 1)
  }

  return { data, info, colorMap, uniqueColors: colorMap.size }
}

// ── Create a colour mask PNG using sharp ─────────────────────────────────────
async function createColorMask(buf, targetR, targetG, targetB) {
  const { data, info } = await sharp(buf)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const maskData = Buffer.alloc(width * height * 3)

  for (let i = 0, j = 0; i < data.length; i += channels, j += 3) {
    const a = channels === 4 ? data[i + 3] : 255
    if (a < 128) { maskData[j] = maskData[j+1] = maskData[j+2] = 255; continue }
    const r = Math.round(data[i]     / 32) * 32
    const g = Math.round(data[i + 1] / 32) * 32
    const b = Math.round(data[i + 2] / 32) * 32
    const match = Math.abs(r - targetR) < 33 && Math.abs(g - targetG) < 33 && Math.abs(b - targetB) < 33
    maskData[j] = maskData[j+1] = maskData[j+2] = match ? 0 : 255
  }

  return sharp(maskData, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

// ── Colour-aware tracing ──────────────────────────────────────────────────────
async function traceWithColours(buf, maxColours = 8) {
  const { colorMap, uniqueColors } = await analyzeImage(buf)

  if (uniqueColors > 60) {
    return { complex: true, uniqueColors }
  }

  // Get dominant colours, skip near-white background
  const dominantColors = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColours)
    .map(([key]) => {
      const [r, g, b] = key.split(',').map(Number)
      return { r, g, b, hex: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` }
    })
    .filter(c => !(c.r > 210 && c.g > 210 && c.b > 210))

  const layers = []
  for (const color of dominantColors) {
    try {
      const maskBuf = await createColorMask(buf, color.r, color.g, color.b)
      const svg = await new Promise((res, rej) => {
        potrace.trace(maskBuf, {
          color: color.hex,
          background: 'transparent',
          threshold: 128,
          turdSize: 3,
          optTolerance: 0.4,
        }, (err, s) => err ? rej(err) : res(s))
      })

      const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
      if (innerMatch) {
        const inner = innerMatch[1]
          .replace(/fill="[^"]*"/g, `fill="${color.hex}"`)
          .trim()
        if (inner) layers.push(inner)
      }
    } catch { /* skip failed colour layers */ }
  }

  return { complex: false, layers, dominantColors }
}

// ── Single colour trace fallback ──────────────────────────────────────────────
function traceSingleColor(buffer, color) {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, {
      color: color || '#000000',
      background: 'transparent',
      threshold: 128,
      turdSize: 2,
      optTolerance: 0.4,
    }, (err, svg) => err ? reject(err) : resolve(svg))
  })
}

// ── VMC SVG cleanup ───────────────────────────────────────────────────────────
function makeVMCCompliant(svgText, companyName) {
  const vbMatch = svgText.match(/viewBox=["']([^"']+)["']/)
  let viewBox = vbMatch ? vbMatch[1] : '0 0 500 500'
  const parts = viewBox.trim().split(/[\s,]+/).map(Number)

  if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
    const size = Math.max(parts[2], parts[3])
    viewBox = `0 0 ${size} ${size}`
  }

  const innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
  let inner = innerMatch ? innerMatch[1] : ''

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

  const name = (companyName || 'Brand Logo').replace(/[<>&"]/g, '')

  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="${viewBox}">
<title>${name}</title>
${inner.trim()}
</svg>`
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { data, mimeType, companyName, color } = req.body

    if (!data || !mimeType) {
      return res.status(400).json({ error: 'data and mimeType are required' })
    }

    const buffer = Buffer.from(data, 'base64')
    let svgText

    if (mimeType === 'image/svg+xml') {
      svgText = buffer.toString('utf8')

    } else if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      const result = await traceWithColours(buffer)

      if (result.complex) {
        return res.status(422).json({
          error: 'complex_image',
          message: `This image has too many colour variations (${result.uniqueColors} detected) to convert automatically. VMC logos must be simple flat-colour designs with 2–8 solid colours. Please use a flat version of your brand logo.`,
          uniqueColors: result.uniqueColors,
        })
      }

      if (result.layers && result.layers.length > 0) {
        svgText = `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 500 500">
<title>${(companyName || 'Brand Logo').replace(/[<>&"]/g, '')}</title>
${result.layers.join('\n')}
</svg>`
      } else {
        const traced = await traceSingleColor(buffer, color || '#000000')
        svgText = traced
      }

    } else {
      return res.status(400).json({ error: `Unsupported format: ${mimeType}` })
    }

    const vmcSvg = makeVMCCompliant(svgText, companyName)
    const sizeBytes = Buffer.byteLength(vmcSvg, 'utf8')

    return res.status(200).json({
      svg: vmcSvg,
      sizeBytes,
      sizeKB: (sizeBytes / 1024).toFixed(1),
      compliant: sizeBytes <= 32768,
      over32KB: sizeBytes > 32768,
      warning: sizeBytes > 32768 ? 'File exceeds 32KB. Simplify your logo for full VMC compliance.' : null,
    })

  } catch (err) {
    console.error('SVG conversion error:', err)
    return res.status(500).json({ error: err.message || 'Conversion failed' })
  }
}
