const potrace = require('potrace')
const jimp = require('jimp')
const Jimp = jimp.Jimp
const JimpMime = jimp.JimpMime

// ── Colour complexity detection ───────────────────────────────────────────────
async function analyzeImage(buf) {
  const img = await Jimp.read(buf)

  if (img.width > 512 || img.height > 512) {
    img.resize({ w: 512, h: 512 })
  }

  const colorMap = new Map()
  const step = 3
  for (let x = 0; x < img.width; x += step) {
    for (let y = 0; y < img.height; y += step) {
      const c = img.getPixelColor(x, y)
      const a = c & 0xFF
      if (a < 128) continue
      const r = Math.round(((c >>> 24) & 0xFF) / 32) * 32
      const g = Math.round(((c >>> 16) & 0xFF) / 32) * 32
      const b = Math.round(((c >>> 8)  & 0xFF) / 32) * 32
      const key = `${r},${g},${b}`
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }
  }

  return { img, colorMap, uniqueColors: colorMap.size }
}

// ── Colour-aware tracing ──────────────────────────────────────────────────────
async function traceWithColours(buf, maxColours = 8) {
  const { img, colorMap, uniqueColors } = await analyzeImage(buf)

  if (uniqueColors > 60) {
    return { complex: true, uniqueColors }
  }

  const dominantColors = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColours)
    .map(([key]) => {
      const [r, g, b] = key.split(',').map(Number)
      return {
        r, g, b,
        hex: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
      }
    })
    .filter(c => !(c.r > 210 && c.g > 210 && c.b > 210))

  const layers = []
  for (const color of dominantColors) {
    const mask = img.clone()
    for (let x = 0; x < mask.width; x++) {
      for (let y = 0; y < mask.height; y++) {
        const c = mask.getPixelColor(x, y)
        const r = Math.round(((c >>> 24) & 0xFF) / 32) * 32
        const g = Math.round(((c >>> 16) & 0xFF) / 32) * 32
        const b = Math.round(((c >>> 8)  & 0xFF) / 32) * 32
        const match = Math.abs(r - color.r) < 33 && Math.abs(g - color.g) < 33 && Math.abs(b - color.b) < 33
        mask.setPixelColor(match ? 0x000000FF : 0xFFFFFFFF, x, y)
      }
    }

    const maskBuf = await mask.getBuffer(JimpMime.png)
    try {
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
    } catch { /* skip failed layers */ }
  }

  return { complex: false, layers, dominantColors }
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

// ── Handler ───────────────────────────────────────────────────────────────────
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
