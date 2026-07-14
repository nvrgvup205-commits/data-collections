// Takes an image File, downscales it, stamps the capture date/time onto it,
// and returns a compressed JPEG Blob plus the capture timestamp.

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.72

export interface ProcessedPhoto {
  blob: Blob
  capturedAt: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('تعذّر قراءة الصورة'))
    }
    img.src = url
  })
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const capturedAt = Date.now()
  const img = await loadImage(file)

  let { width, height } = img
  if (width > height && width > MAX_DIMENSION) {
    height = Math.round((height * MAX_DIMENSION) / width)
    width = MAX_DIMENSION
  } else if (height >= width && height > MAX_DIMENSION) {
    width = Math.round((width * MAX_DIMENSION) / height)
    height = MAX_DIMENSION
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر معالجة الصورة')

  ctx.drawImage(img, 0, 0, width, height)

  // Timestamp watermark (date + time) at the bottom of the photo.
  const stamp = new Date(capturedAt).toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const fontSize = Math.max(16, Math.round(width * 0.032))
  const pad = Math.round(fontSize * 0.5)
  const barHeight = fontSize + pad * 2

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(0, height - barHeight, width, barHeight)

  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${fontSize}px system-ui, "Segoe UI", Tahoma, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillText(`🕒 ${stamp}`, width - pad, height - barHeight / 2)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('تعذّر إنشاء الصورة'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })

  return { blob, capturedAt }
}
