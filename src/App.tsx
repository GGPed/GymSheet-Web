import { ExerciseImagePopup } from './components/ParityFeatures'
import { streakMessage } from './streakMessage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeWorkoutSet, findLastCompletedSet, finishWorkout, getSetting, setSetting, startWorkout, undoLastCompletedSet } from './db'
import type { Exercise, Prescription, ThemePreference, WorkoutDay, WorkoutSession } from './types'
import { ExerciseCard } from './components/ExerciseCard'
import { Onboarding } from './components/Onboarding'
import { PwaPrompts } from './components/PwaPrompts'
import { SettingsSheet } from './components/SettingsSheet'
import { exportWebBackup } from './services/backup'
import { exportHistoryExcel, exportHistoryPdf } from './services/export'
import { imageForExercise } from './services/images'
import { useRecoveryTimer } from './hooks/useRecoveryTimer'
import { RecoveryPanel } from './components/RecoveryPanel'
import { RecoveryWorkoutLock, WorkoutControls } from './components/RecoveryWorkoutLock'
import { effectivePrescription, trainingSetCount, recoveryAfterSet } from './training'
import { formatDuration } from './utils'
import { ProgressPage } from './components/ProgressPage'
import { SwipeDialog } from './components/SwipeDialog'
import { availableWeeks, addWeek } from './weeks'
import { progressData } from './services/progress'
import { improvements, workoutStreak } from './progressEngine'
import { haptic } from './haptics'

type Tab = 'workout' | 'history' | 'progress'

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0f14' : '#f4f6f9')
}

export default function App() {
  const activeSheet = useLiveQuery(async () => (await db.sheets.where('active').equals(1).first()) ?? null)
  const days = useLiveQuery<WorkoutDay[]>(async () => activeSheet ? await db.days.where('sheetId').equals(activeSheet.id).sortBy('dayIndex') : [], [activeSheet?.id]) ?? []
  const allDays = useLiveQuery<WorkoutDay[]>(() => db.days.toArray()) ?? []
  const [week, setWeek] = useState(1)
  const [selectedDayId, setSelectedDayId] = useState('')
  const [tab, setTab] = useState<Tab>('workout')
  const [menu, setMenu] = useState(false)
  const [mobilityOpen, setMobilityOpen] = useState(false)
  const [theme, setTheme] = useState<ThemePreference>('dark')
  const [workoutNow, setWorkoutNow] = useState(Date.now())
  const eventBusy = useRef(false)
  const touchStart = useRef<{x:number;y:number}|null>(null)
  const [summary, setSummary] = useState<{duration:string;days:number;early:boolean;streak:number;day:string;done:number;total:number;changes:ReturnType<typeof improvements>}|null>(null)
  const [weekBusy,setWeekBusy]=useState(false),[pendingWeek,setPendingWeek]=useState<number|null>(null)
  const [actionError,setActionError]=useState('')
  const recovery = useRecoveryTimer()

  const workoutDays = useMemo(() => days.filter((day) => !day.mobility), [days])
  const mobilityDay = days.find((day) => day.mobility)
  const selectedDay = workoutDays.find((day) => day.id === selectedDayId) ?? workoutDays[0]

  useEffect(() => { void getSetting<ThemePreference>('theme', 'dark').then((value) => { const next=value==='system'?'dark':value; setTheme(next); applyTheme(next) }) }, [])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') applyTheme(theme) }
    mq.addEventListener('change', handler); return () => mq.removeEventListener('change', handler)
  }, [theme])
  useEffect(() => {
    if (!activeSheet) return
    void Promise.all([getSetting(`week:${activeSheet.id}`,1),availableWeeks(activeSheet.id)]).then(([saved,max])=>setWeek(Math.min(max,Math.max(1,Number(saved)||1))))
  }, [activeSheet?.id])
  useEffect(() => { if (workoutDays.length && !workoutDays.some((day) => day.id === selectedDayId)) setSelectedDayId(workoutDays[0].id) }, [workoutDays, selectedDayId])

  const exercises = useLiveQuery<Exercise[]>(async () => selectedDay ? await db.exercises.where('dayId').equals(selectedDay.id).sortBy('order') : [], [selectedDay?.id]) ?? []
  const prescriptions = useLiveQuery(async () => {
    const result = new Map<string, Prescription>()
    for (const exercise of exercises) {
      const item = effectivePrescription(await db.prescriptions.where('exerciseId').equals(exercise.id).toArray(), week)
      if (item) result.set(exercise.id, item)
    }
    return result
  }, [exercises.map((e) => e.id).join(','), week]) ?? new Map<string, Prescription>()

  const maxWeek = useLiveQuery(()=>activeSheet?availableWeeks(activeSheet.id):Promise.resolve(1),[activeSheet?.id])??1
  const activeSession = useLiveQuery<WorkoutSession | undefined>(() => db.workoutSessions.where('active').equals(1).first())
  const allCompletedSessions = useLiveQuery<WorkoutSession[]>(async () => (await db.workoutSessions.filter((s) => !s.active && s.endedAt > 0).toArray()).sort((a, b) => b.endedAt - a.endedAt)) ?? []
  const completedSessions = activeSheet ? allCompletedSessions.filter((session) => session.sheetId === activeSheet.id) : []
  const completedWeekDays = new Set(completedSessions.filter((session) => session.weekNumber === week).map((session) => session.dayId)).size
  const daySessions = useLiveQuery<WorkoutSession[]>(async () => selectedDay ? await db.workoutSessions.where('[dayId+weekNumber]').equals([selectedDay.id, week]).toArray() : [], [selectedDay?.id, week]) ?? []
  const dayClosed = daySessions.some((session) => !session.active && session.endedAt > 0)
  const sessionElsewhere = Boolean(activeSession && selectedDay && (activeSession.dayId !== selectedDay.id || activeSession.weekNumber !== week))
  const lastCompletedSet = useLiveQuery(async () => selectedDay ? await findLastCompletedSet(selectedDay.id, week) : undefined, [selectedDay?.id, week])

  useEffect(() => {
    setWorkoutNow(Date.now())
    if (!activeSession) return
    const timer = window.setInterval(() => setWorkoutNow(Date.now()), 1000)
    const refresh = () => setWorkoutNow(Date.now())
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [activeSession?.id])

  const progress = useLiveQuery(async () => {
    let done = 0, total = 0
    let next = 'Tutte le serie completate'
    for (const exercise of exercises) {
      const program = prescriptions.get(exercise.id)?.program ?? ''
      const logs = await db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, week]).toArray()
      const count = trainingSetCount(program, logs)
      total += count
      done += logs.filter(log => log.completed && log.setNumber <= count && log.setNumber > 0).length
      if(next==='Tutte le serie completate') { const pending=Array.from({length:count},(_,i)=>i+1).find(number=>!logs.some(log=>log.setNumber===number&&log.completed));if(pending)next=`${exercise.name} · Serie ${pending}` }
    }
    return { done, total, next }
  }, [exercises.map((e) => e.id).join(','), week, Array.from(prescriptions.values()).map((p) => p.program).join('|')]) ?? { done: 0, total: 0, next: '' }

  const workoutsSinceBackup = useLiveQuery(async () => getSetting('workoutsSinceBackup', 0)) ?? 0
  const lastBackupAt = useLiveQuery(async () => getSetting('lastBackupAt', 0)) ?? 0
  const backupBaseline = lastBackupAt || activeSheet?.importedAt || Date.now()
  const backupDue = workoutsSinceBackup >= 5 || Date.now() - backupBaseline >= 14 * 86400000
  const backupStrong = workoutsSinceBackup >= 10 || Date.now() - backupBaseline >= 28 * 86400000

  if (activeSheet === undefined) return <div className="splash"><img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" /><strong>GymSheet</strong></div>
  if (!activeSheet) return <><Onboarding /><PwaPrompts /></>

  const changeWeek = (delta: number) => {
    const next = Math.max(1, Math.min(Math.max(maxWeek, 1), week + delta))
    setWeek(next); if(next!==week&&workoutDays[0])setSelectedDayId(workoutDays[0].id); void setSetting(`week:${activeSheet.id}`, next)
  }
  const moveDay = (delta: number) => {
    if (!selectedDay) return
    const index = workoutDays.findIndex((day) => day.id === selectedDay.id)
    const next = workoutDays[index + delta]
    if (next) setSelectedDayId(next.id)
    else if (delta > 0 && week < maxWeek) { changeWeek(1); setSelectedDayId(workoutDays[0].id) }
    else if (delta < 0 && week > 1) { changeWeek(-1); setSelectedDayId(workoutDays[0].id) }
  }

  const onCompletedSet = async (exercise: Exercise, setNumber: number, count: number) => {
    const seconds = recoveryAfterSet(setNumber, count, exercises.at(-1)?.id === exercise.id, exercise.recoverySeconds)
    const completed = await completeWorkoutSet(exercise.id, week, setNumber, seconds, setNumber === count ? 'Tra esercizi · '+exercise.name : exercise.name)
    if (completed) { haptic('set'); if (seconds > 0) recovery.setExpanded(true) }
    return completed
  }

  const undoLast = async () => {
    if (recovery.active || !selectedDay) return
    const undone = await undoLastCompletedSet(selectedDay.id, week)
    if (undone) await recovery.stop()
  }

  const beginWorkout = async () => {
    if(recovery.active || eventBusy.current || !selectedDay)return
    eventBusy.current=true
    try { if(!await db.workoutSessions.filter(s=>Boolean(s.active)).first()){await startWorkout(activeSheet.id,selectedDay.id,week);haptic('start')} } finally {eventBusy.current=false}
  }
  const finish = async () => {
    if(recovery.active || eventBusy.current)return
    if (!activeSession || !selectedDay || (activeSession.dayId !== selectedDay.id || activeSession.weekNumber !== week)) return
    const mode = progress.total > 0 && progress.done >= progress.total ? 'complete' : 'early'
    const message = mode === 'complete' ? 'Concludere l’allenamento?' : 'Mancano ancora alcune serie. Concludere l’allenamento anticipatamente?'
    if (mode === 'early' && !confirm(message)) return
    eventBusy.current=true
    try {
    if(!(await db.workoutSessions.get(activeSession.id))?.active)return
    await finishWorkout(activeSession, mode)
    await recovery.stop()
    const data=await progressData(activeSheet.id)
    const sessions=await db.workoutSessions.toArray()
    haptic('finish')
    setSummary({day:String.fromCharCode(65+workoutDays.indexOf(selectedDay)),done:progress.done,total:progress.total,duration:formatDuration(Date.now()-activeSession.startedAt),days:completedWeekDays+(dayClosed?0:1),early:mode==='early',streak:workoutStreak(sessions,allDays),changes:improvements(data,activeSession.id)})
    } finally {eventBusy.current=false}
  }

  return <RecoveryWorkoutLock.Provider value={recovery.active || !recovery.ready}><div className={`app-shell ${activeSession?"has-active-workout":""}`}>
    <header className="app-header">
      <div className="header-title"><h1>{activeSheet.name}</h1></div>
      <div className="header-actions"><button className="icon-button" aria-label="Home" onClick={()=>setTab('workout')}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 11l9-8 9 8M5 9v12h5v-7h4v7h5V9"/></svg></button><button className="icon-button" aria-label={theme==='dark'?'Tema scuro · passa a Chiaro':'Tema chiaro · passa a Scuro'} title={theme==='dark'?'Passa al tema chiaro':'Passa al tema scuro'} onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);applyTheme(next);void setSetting('theme',next)}}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{theme==='dark'?<path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/>:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>}</svg></button><button className="icon-button" aria-label="Progressi" onClick={()=>setTab('progress')}><svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="M4 4v16h16M7 15l4-5 4 2 5-6" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button><button className="icon-button" aria-label="Menu" onClick={() => setMenu(true)}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></div>
      
    </header>

    {tab === 'workout' && <>
      <section className="week-card">
        <button onClick={() => changeWeek(-1)} disabled={week<=1}>‹</button>
        <div><span>SETTIMANA {week}</span><small>{completedWeekDays}/{workoutDays.length} giorni · {workoutDays.length ? Math.round(completedWeekDays / workoutDays.length * 100) : 0}%</small></div>
        <button disabled={weekBusy} aria-label={week>=maxWeek?'Aggiungi settimana':'Settimana successiva'} onClick={()=>{if(week<maxWeek){changeWeek(1);return}setActionError('');setPendingWeek(maxWeek+1)}}>{week>=maxWeek?'+':'›'}</button>
      </section>
      {!activeSession&&<StreakBox value={workoutStreak(allCompletedSessions,allDays)}/>}

      {actionError&&<p className="error" role="alert">{actionError}</p>}
      <div className="day-strip">
        {workoutDays.map((day) => {
          const completed = completedSessions.some((s) => s.dayId === day.id && s.weekNumber === week)
          const selected = selectedDay?.id === day.id
          return <button key={day.id} aria-pressed={selected} className={`day-chip ${selected?'selected':''} ${completed?'completed':''}`} onClick={() => setSelectedDayId(day.id)}><span className="day-chip-title">{completed&&<span className="day-completion-check" aria-label="Completato">✓</span>}{String.fromCharCode(65+workoutDays.indexOf(day))}</span><small className="day-session-status" aria-hidden="true"> </small></button>
        })}
      </div>

      {backupDue && !activeSession && <div className={`backup-reminder ${backupStrong?'strong':''}`}><div><strong>È il momento di fare un backup</strong><span>I dati sono solo su questo dispositivo: potresti perderli cambiando telefono o cancellando i dati della PWA.</span></div><button onClick={() => void exportWebBackup()}>Fai backup</button></div>}

      <RecoveryPanel timer={recovery} />
      {recovery.active&&!activeSession && <p className="recovery-workout-status" role="status">Recupero in corso · {formatDuration(recovery.remainingMs)}</p>}
      {recovery.expired && !recovery.active && !activeSession && <button className="recovery-done" onClick={() => void recovery.stop()}>✓ Recupero terminato</button>}

      <div className="workout-dock">
        {activeSession && selectedDay && activeSession.dayId === selectedDay.id && activeSession.weekNumber === week ? <>
          <div className="dock-copy"><span>ALLENAMENTO IN CORSO · SCHEDA {String.fromCharCode(65+workoutDays.findIndex(day=>day.id===activeSession.dayId))}</span><strong className="next-pending">{progress.next}</strong><div className="dock-meta"><strong>{progress.done}/{progress.total} · {progress.total?Math.min(100,Math.round(progress.done/progress.total*100)):0}%</strong><span className="dock-timer">{formatDuration(workoutNow-activeSession.startedAt)}</span></div>{recovery.active&&<button className="dock-recovery" onClick={()=>recovery.setExpanded(true)} aria-label="Apri timer recupero">Recupero <strong>{formatDuration(recovery.remainingMs)}</strong></button>}<div className="progress-track"><i style={{width:`${progress.total?Math.min(100,progress.done/progress.total*100):0}%`}} /></div></div>
          <WorkoutControls className="dock-actions">{lastCompletedSet && <button className="undo-set" onClick={() => void undoLast().catch(e=>setActionError(e instanceof Error?e.message:"Serie non annullata."))}>↶ Annulla serie</button>}<button className={`finish-button ${progress.total>0&&progress.done>=progress.total?'success':'danger'}`} onClick={() => void finish().catch(e=>setActionError(e instanceof Error?e.message:"Allenamento non concluso."))}>{progress.total>0&&progress.done>=progress.total?'Concludi allenamento':'Concludi anticipatamente'}</button></WorkoutControls>
        </> : dayClosed ? <div className="closed-workout"><b>✓ Allenamento completato</b><span>Puoi ancora consultare e modificare i dati registrati.</span></div> : sessionElsewhere ? <div className="closed-workout"><b>ALLENAMENTO IN CORSO · SCHEDA {String.fromCharCode(65+workoutDays.findIndex(day=>day.id===activeSession?.dayId))}</b><span>Torna al giorno e alla settimana dell’allenamento in corso.</span><button className="secondary" onClick={()=>{if(activeSession){setWeek(activeSession.weekNumber);setSelectedDayId(activeSession.dayId);void setSetting(`week:${activeSheet.id}`,activeSession.weekNumber)}}}>Torna all’allenamento</button></div> : <button className="start-button" disabled={recovery.active || !recovery.ready} onClick={() => void beginWorkout().catch(e=>setActionError(e instanceof Error?e.message:"Allenamento non avviato."))}>Inizia allenamento</button>}
        {activeSession&&sessionElsewhere&&recovery.active&&<button className="dock-recovery" onClick={()=>recovery.setExpanded(true)}>Recupero <strong>{formatDuration(recovery.remainingMs)}</strong></button>}
      </div>
      {selectedDay && <main className="exercise-list" onTouchStart={e=>{touchStart.current=(e.target as HTMLElement).closest('input,textarea,button,select')?null:{x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{if(!touchStart.current)return;const dx=e.changedTouches[0].clientX-touchStart.current.x,dy=e.changedTouches[0].clientY-touchStart.current.y;touchStart.current=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)moveDay(dx<0?1:-1)}}>
        <div className="workout-day-heading"><div><span>SETTIMANA {week}</span></div>{mobilityDay && <button className="mobility-trigger" aria-haspopup="dialog" aria-expanded={mobilityOpen} onClick={()=>setMobilityOpen(true)}>Mobilità ⓘ</button>}</div>
        {exercises.map((exercise) => <ExerciseCard key={`${exercise.id}:${week}`} exercise={exercise} prescription={prescriptions.get(exercise.id)} week={week} dayClosed={dayClosed} activeSession={activeSession} sessionElsewhere={sessionElsewhere} onCompletedSet={onCompletedSet} />)}
      </main>}


    </>}

    {tab === 'history' && <HistoryView days={allDays} sessions={allCompletedSessions} />}
    {tab === 'progress' && <ProgressPage sheetId={activeSheet.id} />}

    {tab === 'history' && <button className="return-workout" onClick={()=>setTab('workout')}>Torna alla scheda</button>}

    {mobilityOpen && mobilityDay && <MobilitySheet day={mobilityDay} week={week} onClose={()=>setMobilityOpen(false)} />}
    <SettingsSheet onHistory={()=>{setTab('history');setMenu(false)}} open={menu} onClose={()=>setMenu(false)} />
    {summary&&<SwipeDialog onClose={()=>setSummary(null)} title={summary.early?'Allenamento concluso anticipatamente':'Allenamento completato'} className="workout-summary"><p>{summary.early?'CONCLUSIONE ANTICIPATA':'SESSIONE COMPLETATA'} · {summary.day}</p><p>{summary.done}/{summary.total} serie completate</p><div className="summary-duration"><span>Durata</span><strong>{summary.duration}</strong></div><p>{summary.days}/{workoutDays.length} allenamenti completati questa settimana</p><p>Streak: {summary.streak} allenamenti completati</p>{summary.changes.map(change=><div className="summary-change" key={change.name}><b>{change.name}</b>{change.load&&<p>Carico: {change.load}</p>}{change.reps&&<p>Ripetizioni: {change.reps}</p>}{change.coach&&<p>✓ Obiettivo coach +KG raggiunto</p>}</div>)}</SwipeDialog>}

    {pendingWeek!==null&&<SwipeDialog title={`Aggiungere Settimana ${pendingWeek}?`} onClose={()=>{if(!weekBusy)setPendingWeek(null)}}><p>La nuova settimana sarà disponibile nella scheda.</p>{actionError&&<p className="error" role="alert">{actionError}</p>}<button className="secondary" disabled={weekBusy} onClick={()=>setPendingWeek(null)}>Annulla</button><button className="primary" disabled={weekBusy} onClick={async()=>{if(weekBusy)return;setWeekBusy(true);setActionError('');try{setWeek(await addWeek(activeSheet.id));if(workoutDays[0])setSelectedDayId(workoutDays[0].id);setPendingWeek(null)}catch(e){setActionError(e instanceof Error?e.message:'Settimana non aggiunta.')}finally{setWeekBusy(false)}}}>Aggiungi settimana</button></SwipeDialog>}
    <PwaPrompts />
  </div></RecoveryWorkoutLock.Provider>
}

function SessionDetails({id}:{id:string}) {
  const sets=useLiveQuery(()=>db.sessionSets.where('sessionId').equals(id).toArray(),[id])??[]
  return <details className="session-details"><summary>Dettaglio serie</summary>{sets.map(set=><p key={set.id}><strong>{set.exerciseName}</strong> · S{set.setNumber}: {set.weight||'—'} kg × {set.reps||'—'} {set.completed?'✓':''}</p>)}</details>
}

function HistoryView({ days, sessions }: { days: WorkoutDay[]; sessions: Array<{id:string;sheetId:string;dayId:string;weekNumber:number;startedAt:number;endedAt:number;completionMode?:string}> }) {
  const sheets=useLiveQuery(()=>db.sheets.toArray())??[]
  return <main className="page-view"><div className="page-title"><div><span>STORICO</span><h2>Allenamenti · {sessions.length} completati</h2></div></div>
    {!sessions.length ? <div className="empty-card"><strong>Nessun allenamento concluso</strong><span>Quando chiuderai un workout comparirà qui.</span></div> : sessions.map((session) => {
      const day = days.find((item) => item.id === session.dayId)
      return <article className="history-card" key={session.id}><div><span>{sheets.find(sheet=>sheet.id===session.sheetId)?.name??'Scheda'} · Settimana {session.weekNumber}</span><h3>{day?.title ?? 'Allenamento'}</h3><small>{new Date(session.endedAt).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})}</small></div><div className="history-side"><div className="history-duration">{formatDuration(session.endedAt-session.startedAt)}<small>{session.completionMode==='early'?'anticipato':'completo'}</small></div><div className="history-actions"><button onClick={()=>void exportHistoryPdf(session.id)}>PDF</button><button onClick={()=>void exportHistoryExcel(session.id)}>XLS</button></div></div><SessionDetails id={session.id}/></article>
    })}
  </main>
}

function MobilitySheet({ day, week, onClose }: { day: WorkoutDay; week: number; onClose: () => void }) {
  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.where('dayId').equals(day.id).sortBy('order'), [day.id]) ?? []
  const prescriptions = useLiveQuery<Array<Prescription | undefined>>(async()=>Promise.all(exercises.map(async(e)=>effectivePrescription(await db.prescriptions.where('exerciseId').equals(e.id).toArray(),week))),[exercises.map(e=>e.id).join(','),week]) ?? []
  const [image,setImage]=useState<{exercise:Exercise;program:string}|null>(null)
  return <><SwipeDialog title="Mobilità · Prima di iniziare" onClose={onClose}>
    <div className="mobility-tooltip-list">{exercises.map((exercise,index)=><div className="mobility-row" key={exercise.id}><button className="exercise-image-button" aria-label={`Apri immagine ${exercise.name}`} onClick={()=>setImage({exercise,program:prescriptions[index]?.program??''})}><img src={imageForExercise(exercise.name,prescriptions[index]?.program??'',exercise.trainerNote)} alt={exercise.name} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=`${import.meta.env.BASE_URL}icon-192.png`}}/></button><div><strong>{exercise.name}</strong><span>{prescriptions[index]?.program??''}</span></div></div>)}</div>
  </SwipeDialog>{image&&<ExerciseImagePopup exercise={image.exercise} program={image.program} onClose={()=>setImage(null)}/>}</>
}

function StreakBox({value}:{value:number}){const message=streakMessage(value);return <section className="streak-box" aria-label="Streak allenamenti"><strong>{value} allenamenti di streak</strong>{message&&<p>{message}</p>}</section>}

