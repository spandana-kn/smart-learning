let sharedStream: MediaStream | null = null
let pending: Promise<MediaStream> | null = null

export async function getSharedCameraStream() {
  if (sharedStream && sharedStream.active) return sharedStream
  if (pending) return pending

  pending = navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    },
    audio: false,
  }).then((stream) => {
    sharedStream = stream
    pending = null
    return stream
  }).catch((err) => {
    pending = null
    throw err
  })

  return pending
}

export function stopSharedCameraStream() {
  sharedStream?.getTracks().forEach((track) => track.stop())
  sharedStream = null
  pending = null
}
