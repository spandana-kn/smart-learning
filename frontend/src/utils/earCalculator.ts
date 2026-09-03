// Eye Aspect Ratio: (||p2-p6|| + ||p3-p5||) / (2·||p1-p4||)
// Used for client-side blink detection preview

interface Point { x: number; y: number }

function dist(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function computeEAR(eye: Point[]): number {
  if (eye.length < 6) return 1
  const A = dist(eye[1], eye[5])
  const B = dist(eye[2], eye[4])
  const C = dist(eye[0], eye[3])
  return (A + B) / (2 * C)
}

export function isBlink(ear: number): boolean {
  return ear < 0.21
}

// XP level threshold: floor(100 * n^1.6)
export function levelThreshold(n: number): number {
  return Math.floor(100 * Math.pow(n, 1.6))
}

// Map focus score 0-100 to color string
export function focusColor(score: number): string {
  if (score >= 75) return '#00F5A0'
  if (score >= 50) return '#6C63FF'
  if (score >= 30) return '#FF9F43'
  return '#FF4757'
}

// Clamp number between min/max
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}
