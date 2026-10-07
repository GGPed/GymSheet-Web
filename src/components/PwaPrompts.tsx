import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { isIos, isStandalone } from '../utils'

export function PwaPrompts() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [deferred, setDeferred] = useState<Event & { prompt?: () => Promise<void> } | null>(null)

  const updateSW = registerSW({ onNeedRefresh: () => setNeedRefresh(true) })
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setDeferred(event as Event & { prompt?: () => Promise<void> }); setShowInstall(true) }
    window.addEventListener('beforeinstallprompt', handler)
    const visits = Number(localStorage.getItem('gymsheet_visits') ?? 0) + 1
    localStorage.setItem('gymsheet_visits', String(visits))
    if (visits >= 2 && isIos() && !isStandalone()) setShowInstall(true)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return <>
    {needRefresh && <div className="floating-banner"><div><strong>Nuova versione disponibile</strong><span>La app non si ricarica da sola durante l’allenamento.</span></div><button onClick={() => void updateSW(true)}>Aggiorna</button></div>}
    {showInstall && !isStandalone() && <div className="install-banner"><button className="close" onClick={()=>setShowInstall(false)}>×</button><strong>Installa GymSheet</strong><span>{isIos() ? 'Su iPhone: Condividi → Aggiungi alla schermata Home.' : 'Aggiungila alla schermata Home per usarla come app.'}</span>{deferred?.prompt && <button onClick={() => void deferred.prompt?.()}>Installa</button>}</div>}
  </>
}
