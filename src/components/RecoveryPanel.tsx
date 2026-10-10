import type { useRecoveryTimer } from '../hooks/useRecoveryTimer'
import { formatDuration } from '../utils'
import { SwipePanel } from './SwipePanel'
export function RecoveryPanel({timer}:{timer:ReturnType<typeof useRecoveryTimer>}) {
  if(!timer.active)return null
  return <SwipePanel expanded={timer.expanded} onExpand={()=>timer.setExpanded(true)} onMinimize={()=>timer.setExpanded(false)} title="Recupero" compact={<span>{formatDuration(timer.remainingMs)} · {timer.subtitle}</span>} className="recovery-sheet">
    <p>{timer.subtitle}</p><strong className="recovery-clock" role="timer">{formatDuration(timer.remainingMs)}</strong>
    <div className="recovery-controls"><button onClick={()=>void timer.extend(15)}>+15 s</button><button onClick={()=>void timer.extend(30)}>+30 s</button><button onClick={()=>void timer.stop()}>Salta recupero</button></div>
    <button className="secondary" onClick={()=>timer.setExpanded(false)}>Torna alla scheda</button><p className="muted">Scorri verso il basso: il timer continua.</p>
  </SwipePanel>
}
