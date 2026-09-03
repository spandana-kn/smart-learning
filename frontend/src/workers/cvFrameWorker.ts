// Runs off the main thread so JPEG encoding never drops UI frames.
// Receives a transferred ImageBitmap, re-encodes it as a small/lossy JPEG,
// and posts the raw bytes back (also transferred, so it's a zero-copy handoff).

const CAPTURE_W = 320
const CAPTURE_H = 240
const JPEG_QUALITY = 0.5 // aggressive compression: keeps enough structure for Haar cascades, shrinks payload

const canvas = new OffscreenCanvas(CAPTURE_W, CAPTURE_H)
const ctx = canvas.getContext('2d')!

self.onmessage = async (event: MessageEvent<{ bitmap: ImageBitmap }>) => {
  const { bitmap } = event.data
  try {
    ctx.drawImage(bitmap, 0, 0, CAPTURE_W, CAPTURE_H)
    bitmap.close()

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
    const buffer = await blob.arrayBuffer()

    ;(self as unknown as Worker).postMessage({ buffer }, [buffer])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ error: String(err) })
  }
}
