export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

export function parseRecoverySeconds(label: string): number {
  const value = label.trim().replace(/\s+/g, '')
  const seconds = value.match(/^(\d+)''$/)
  if (seconds) return Number(seconds[1])
  const minutes = value.match(/^(\d+)'$/)
  if (minutes) return Number(minutes[1]) * 60
  const minSec = value.match(/^(\d+)[.:](\d+)'$/)
  if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2])
  const plain = Number(value)
  return Number.isFinite(plain) ? plain : 0
}

export function setCountForProgram(program: string): number {
  const match = program.trim().match(/^(\d+)\s*(?:x|set\b)/i)
  return match ? Math.max(1, Number(match[1])) : 1
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function toNumber(value: string): number {
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
