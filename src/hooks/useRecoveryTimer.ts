import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../db'

export function useRecoveryTimer() {
  const [endAt, setEndAt] = useState(0)
  const [subtitle, setSubtitle] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    void Promise.all([getSetting('recoveryEndAt', 0), getSetting('recoverySubtitle', '')]).then(([end, sub]) => {
      setEndAt(end); setSubtitle(sub)
    })
  }, [])

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [])

  useEffect(() => {
    if (!endAt || now < endAt || now - endAt > 1500) return
    if ('vibrate' in navigator) navigator.vibrate([120, 80, 120])
  }, [endAt, now])

  const start = async (seconds: number, label: string) => {
    if (seconds <= 0) return
    const next = Date.now() + seconds * 1000
    setEndAt(next); setSubtitle(label); setNow(Date.now())
    await Promise.all([setSetting('recoveryEndAt', next), setSetting('recoverySubtitle', label)])
  }
  const stop = async () => {
    setEndAt(0); setSubtitle('')
    await Promise.all([setSetting('recoveryEndAt', 0), setSetting('recoverySubtitle', '')])
  }
  return { endAt, subtitle, remainingMs: Math.max(0, endAt - now), active: endAt > now, expired: Boolean(endAt && endAt <= now), start, stop }
}
