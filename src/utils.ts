export const uid = (prefix: string) => `${prefix}_${typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')}`

export function parseRecoverySeconds(label: string): number {
  const value = label.trim().replace(/\s+/g, '')
  const seconds = value.match(/^(\d+)''$/)
  if (seconds) return Number(seconds[1])
  const minutes = value.match(/^(\d+)'$/)
  if (minutes) return Number(minutes[1]) * 60
  const minSec = value.match(/^(\d+)[.:](\d+)'$/)
  if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2])
  const range = value.match(/^(?:NOREST\+)?(\d+)[.:](\d{2})(?:\/(\d+))?$/i)
  if (range) return Number(range[1])*60 + Number(range[2])
  const doubleQuote = value.match(/^(\d+)"$/)
  if (doubleQuote) return Number(doubleQuote[1])
  const plain = Number(value)
  return Number.isFinite(plain) ? plain : 0
}

export function setCountForProgram(program: string): number {
  const namedSets=program.trim().match(/^(\d+)\s*set\b/i)
  if(namedSets)return Math.min(12,Math.max(1,Number(namedSets[1])))
  const matches = [...program.matchAll(/(?:\b\d+\s*\/\s*)?(\d+)\s*(?:x|set\b)\s*(?=\d|max|amrap)/gi)]
  if (/\bpoi\b.*\bscala\b/i.test(program) && matches.length>1) return Math.min(12,Math.max(1,Number(matches[0][1])))
  const total = matches.reduce((sum,match)=>sum+Number(match[1]),0)
  return Math.min(12, Math.max(1,total))
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

export function targetForSet(program: string, setNumber: number): string {
  const matches=[...program.matchAll(/(?:\b\d+\s*\/\s*)?(\d+)\s*x\s*(max|amrap|\d+(?:\s*[-/+]\s*\d+)*)/gi)]
  if (/\bpoi\b.*\bscala\b/i.test(program) && matches.length>1) {
    const count=Number(matches[0][1]);return setNumber===count?'MAX · scala il carico come indicato':matches[0][2]+' Ripetizioni'
  }
  let index=setNumber
  for(const match of matches){if(index<=Number(match[1]))return match[2].toUpperCase()+( /max|amrap/i.test(match[2])?'':' Ripetizioni');index-=Number(match[1])}
  return ''
}

export function readableRecovery(seconds:number):string {
  const minutes=Math.floor(seconds/60),rest=seconds%60
  const parts=[]
  if(minutes)parts.push(`${minutes} ${minutes===1?'minuto':'minuti'}`)
  if(rest||!minutes)parts.push(`${rest} ${rest===1?'secondo':'secondi'}`)
  return parts.join(' e ')
}
