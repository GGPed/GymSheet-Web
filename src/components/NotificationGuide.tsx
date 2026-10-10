import {SwipeDialog} from './SwipeDialog'

export function NotificationGuide({onClose}:{onClose:()=>void}) {
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
  const android=/Android/i.test(navigator.userAgent)
  const guides={
    iphone:<section key="iphone"><h3>iPhone</h3><ol><li>Aggiungi GymSheet alla schermata Home dal menu Condividi di Safari.</li><li>Apri GymSheet dalla sua icona.</li><li>Attiva Notifiche recupero e premi Consenti.</li></ol><p>Se sono bloccate, apri Impostazioni → Notifiche → GymSheet e abilita le notifiche.</p></section>,
    android:<section key="android"><h3>Android</h3><ol><li>Attiva Notifiche recupero.</li><li>Premi Consenti quando il browser lo chiede.</li></ol><p>Se sono bloccate, apri le impostazioni del browser → Impostazioni sito → Notifiche e abilita GymSheet. Se usi l’app installata, controlla anche Impostazioni Android → App → GymSheet → Notifiche.</p></section>
  }
  const order=android&&!ios?(['android','iphone'] as const):(['iphone','android'] as const)
  return <SwipeDialog title="Notifiche recupero" className="notification-guide" onClose={onClose}>{order.map(device=>guides[device])}<button className="primary" onClick={onClose}>Ho capito</button></SwipeDialog>
}
