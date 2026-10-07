import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, finishWorkout, getSetting, setSetting, startWorkout } from './db'
import type { Exercise, Prescription, ThemePreference, WorkoutDay, WorkoutSession } from './types'
import { ExerciseCard } from './components/ExerciseCard'
import { Onboarding } from './components/Onboarding'
import { PwaPrompts } from './components/PwaPrompts'
import { SettingsSheet } from './components/SettingsSheet'
import { exportWebBackup } from './services/backup'
import { exportHistoryExcel, exportHistoryPdf } from './services/export'
import { imageForExercise } from './services/images'
import { useRecoveryTimer } from './hooks/useRecoveryTimer'
import { formatDuration, setCountForProgram, toNumber } from './utils'

type Tab = 'workout' | 'history' | 'progress'

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0f14' : '#f4f6f9')
}

export default function App() {
  const activeSheet = useLiveQuery(() => db.sheets.where('active').equals(1).first())
  const days = useLiveQuery<WorkoutDay[]>(async () => activeSheet ? await db.days.where('sheetId').equals(activeSheet.id).sortBy('dayIndex') : [], [activeSheet?.id]) ?? []
  const allDays = useLiveQuery<WorkoutDay[]>(() => db.days.toArray()) ?? []
  const [week, setWeek] = useState(1)
  const [selectedDayId, setSelectedDayId] = useState('')
  const [tab, setTab] = useState<Tab>('workout')
  const [menu, setMenu] = useState(false)
  const [mobilityOpen, setMobilityOpen] = useState(false)
  const [theme, setTheme] = useState<ThemePreference>('system')
  const touchX = useRef(0)
  const recovery = useRecoveryTimer()

  const workoutDays = useMemo(() => days.filter((day) => !day.mobility), [days])
  const mobilityDay = days.find((day) => day.mobility)
  const selectedDay = workoutDays.find((day) => day.id === selectedDayId) ?? workoutDays[0]

  useEffect(() => { void getSetting<ThemePreference>('theme', 'system').then((value) => { setTheme(value); applyTheme(value) }) }, [])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') applyTheme(theme) }
    mq.addEventListener('change', handler); return () => mq.removeEventListener('change', handler)
  }, [theme])
  useEffect(() => {
    if (!activeSheet) return
    void getSetting(`week:${activeSheet.id}`, 1).then((saved) => setWeek(Math.min(10, Math.max(1, Number(saved) || 1))))
  }, [activeSheet?.id])
  useEffect(() => { if (workoutDays.length && !workoutDays.some((day) => day.id === selectedDayId)) setSelectedDayId(workoutDays[0].id) }, [workoutDays, selectedDayId])

  const exercises = useLiveQuery<Exercise[]>(async () => selectedDay ? await db.exercises.where('dayId').equals(selectedDay.id).sortBy('order') : [], [selectedDay?.id]) ?? []
  const prescriptions = useLiveQuery(async () => {
    const result = new Map<string, Prescription>()
    for (const exercise of exercises) {
      const item = await db.prescriptions.where('[exerciseId+weekNumber]').equals([exercise.id, week]).first()
      if (item) result.set(exercise.id, item)
    }
    return result
  }, [exercises.map((e) => e.id).join(','), week]) ?? new Map<string, Prescription>()

  const maxWeek = useLiveQuery(async () => activeSheet ? Math.max(1, ...((await db.prescriptions.toArray()).filter((p) => exercises.some((e) => e.id === p.exerciseId)).map((p) => p.weekNumber))) : 1, [activeSheet?.id, exercises.map((e) => e.id).join(',')]) ?? 6
  const activeSession = useLiveQuery<WorkoutSession | undefined>(() => db.workoutSessions.where('active').equals(1).first())
  const allCompletedSessions = useLiveQuery<WorkoutSession[]>(async () => (await db.workoutSessions.filter((s) => !s.active && s.endedAt > 0).toArray()).sort((a, b) => b.endedAt - a.endedAt)) ?? []
  const completedSessions = activeSheet ? allCompletedSessions.filter((session) => session.sheetId === activeSheet.id) : []
  const daySessions = useLiveQuery<WorkoutSession[]>(async () => selectedDay ? await db.workoutSessions.where('[dayId+weekNumber]').equals([selectedDay.id, week]).toArray() : [], [selectedDay?.id, week]) ?? []
  const dayClosed = daySessions.some((session) => !session.active && session.endedAt > 0)
  const sessionElsewhere = Boolean(activeSession && selectedDay && activeSession.dayId !== selectedDay.id)

  const progress = useLiveQuery(async () => {
    let done = 0, total = 0
    for (const exercise of exercises) {
      const program = prescriptions.get(exercise.id)?.program ?? ''
      const count = setCountForProgram(program)
      total += count
      const logs = await db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, week]).toArray()
      done += logs.filter((log) => log.completed).length
    }
    return { done, total }
  }, [exercises.map((e) => e.id).join(','), week, Array.from(prescriptions.values()).map((p) => p.program).join('|')]) ?? { done: 0, total: 0 }

  const workoutsSinceBackup = useLiveQuery(async () => getSetting('workoutsSinceBackup', 0)) ?? 0
  const lastBackupAt = useLiveQuery(async () => getSetting('lastBackupAt', 0)) ?? 0
  const backupBaseline = lastBackupAt || activeSheet.importedAt
  const backupDue = workoutsSinceBackup >= 5 || Date.now() - backupBaseline >= 14 * 86400000
  const backupStrong = workoutsSinceBackup >= 10 || Date.now() - backupBaseline >= 28 * 86400000

  if (activeSheet === undefined) return <div className="splash"><img src="/icon.svg" alt="" /><strong>GymSheet</strong></div>
  if (!activeSheet) return <><Onboarding /><PwaPrompts /></>

  const changeWeek = (delta: number) => {
    const next = Math.max(1, Math.min(Math.max(maxWeek, 1), week + delta))
    setWeek(next); void setSetting(`week:${activeSheet.id}`, next)
  }
  const moveDay = (delta: number) => {
    if (!selectedDay) return
    const index = workoutDays.findIndex((day) => day.id === selectedDay.id)
    const next = workoutDays[index + delta]
    if (next) setSelectedDayId(next.id)
  }

  const onCompletedSet = (exercise: Exercise) => {
    if (exercise.recoverySeconds > 0) void recovery.start(exercise.recoverySeconds, exercise.name)
  }

  const finish = async () => {
    if (!activeSession || !selectedDay || activeSession.dayId !== selectedDay.id) return
    const mode = progress.total > 0 && progress.done >= progress.total ? 'complete' : 'early'
    const message = mode === 'complete' ? 'Concludere l’allenamento?' : 'Mancano ancora alcune serie. Concludere l’allenamento anticipatamente?'
    if (!confirm(message)) return
    await finishWorkout(activeSession, mode)
    await recovery.stop()
  }

  return <div className="app-shell">
    <header className="app-header">
      <div><div className="brand-pill small">GYMSHEET</div><h1>{activeSheet.name}</h1><p>{workoutDays.length} giorni · progressi salvati offline</p></div>
      <button className="icon-button" aria-label="Menu" onClick={() => setMenu(true)}>•••</button>
    </header>

    {tab === 'workout' && <>
      <section className="week-card">
        <button onClick={() => changeWeek(-1)} disabled={week<=1}>‹</button>
        <div><span>SETTIMANA {week}</span><small>{completedSessions.filter((s) => s.weekNumber === week).length}/{workoutDays.length} allenamenti conclusi</small></div>
        <button onClick={() => changeWeek(1)} disabled={week>=maxWeek}>›</button>
      </section>

      <div className="day-strip">
        {workoutDays.map((day) => {
          const completed = completedSessions.some((s) => s.dayId === day.id && s.weekNumber === week)
          const inProgress = activeSession?.dayId === day.id && activeSession.weekNumber === week
          const selected = selectedDay?.id === day.id
          return <button key={day.id} className={`day-chip ${selected?'selected':''} ${completed?'completed':''} ${inProgress&&!completed?'in-progress':''}`} onClick={() => setSelectedDayId(day.id)}>{completed?'✓  ':inProgress?'•  ':''}{day.title}</button>
        })}
        {mobilityDay && <button className="day-chip mobility" onClick={()=>setMobilityOpen(true)}>Mobilità</button>}
      </div>

      {backupDue && <div className={`backup-reminder ${backupStrong?'strong':''}`}><div><strong>È il momento di fare un backup</strong><span>I dati sono solo su questo dispositivo: potresti perderli cambiando telefono o cancellando i dati della PWA.</span></div><button onClick={() => void exportWebBackup()}>Fai backup</button></div>}

      {recovery.active && <div className="recovery-banner"><span>RECUPERO · {recovery.subtitle}</span><strong>{Math.ceil(recovery.remainingMs/1000)}s</strong><button onClick={() => void recovery.stop()}>Salta</button></div>}
      {recovery.expired && !recovery.active && <button className="recovery-done" onClick={() => void recovery.stop()}>✓ Recupero terminato</button>}

      {selectedDay && <main className="exercise-list" onTouchStart={(e)=>{touchX.current=e.changedTouches[0].clientX}} onTouchEnd={(e)=>{const d=e.changedTouches[0].clientX-touchX.current;if(Math.abs(d)>65)moveDay(d<0?1:-1)}}>
        {exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} prescription={prescriptions.get(exercise.id)} week={week} activeSession={activeSession} sessionElsewhere={sessionElsewhere} onCompletedSet={onCompletedSet} />)}
      </main>}

      <div className="workout-dock">
        {activeSession && selectedDay && activeSession.dayId === selectedDay.id ? <>
          <div className="dock-copy"><span>CONTINUA ALLENAMENTO</span><strong>{progress.done}/{progress.total} serie</strong><div className="progress-track"><i style={{width:`${progress.total?Math.min(100,progress.done/progress.total*100):0}%`}} /></div></div>
          <button className="finish-button" onClick={() => void finish()}>{progress.total>0&&progress.done>=progress.total?'Concludi':'Concludi anticipatamente'}</button>
        </> : dayClosed ? <div className="closed-workout"><b>✓ Allenamento completato</b><span>Puoi ancora consultare e modificare i dati registrati.</span></div> : sessionElsewhere ? <div className="closed-workout"><b>Allenamento già in corso</b><span>Concludi prima l’altro giorno.</span></div> : <button className="start-button" onClick={() => selectedDay && void startWorkout(activeSheet.id, selectedDay.id, week)}>Inizia allenamento →</button>}
      </div>
    </>}

    {tab === 'history' && <HistoryView days={allDays} sessions={allCompletedSessions} />}
    {tab === 'progress' && <ProgressView />}

    <nav className="bottom-nav">
      <button className={tab==='workout'?'active':''} onClick={()=>setTab('workout')}><span>▦</span>Scheda</button>
      <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><span>◷</span>Storico</button>
      <button className={tab==='progress'?'active':''} onClick={()=>setTab('progress')}><span>↗</span>Progressi</button>
    </nav>

    {mobilityOpen && mobilityDay && <MobilitySheet day={mobilityDay} week={week} onClose={()=>setMobilityOpen(false)} />}
    <SettingsSheet open={menu} onClose={()=>setMenu(false)} theme={theme} onTheme={(next)=>{setTheme(next);applyTheme(next)}} />
    <PwaPrompts />
  </div>
}

function HistoryView({ days, sessions }: { days: WorkoutDay[]; sessions: Array<{id:string;dayId:string;weekNumber:number;startedAt:number;endedAt:number;completionMode?:string}> }) {
  return <main className="page-view"><div className="page-title"><div><span>STORICO</span><h2>Allenamenti</h2></div><b>{sessions.length}</b></div>
    {!sessions.length ? <div className="empty-card"><strong>Nessun allenamento concluso</strong><span>Quando chiuderai un workout comparirà qui.</span></div> : sessions.map((session) => {
      const day = days.find((item) => item.id === session.dayId)
      return <article className="history-card" key={session.id}><div><span>SETTIMANA {session.weekNumber}</span><h3>{day?.title ?? 'Allenamento'}</h3><small>{new Date(session.endedAt).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})}</small></div><div className="history-side"><div className="history-duration">{formatDuration(session.endedAt-session.startedAt)}<small>{session.completionMode==='early'?'anticipato':'completo'}</small></div><div className="history-actions"><button onClick={()=>void exportHistoryPdf(session.id)}>PDF</button><button onClick={()=>void exportHistoryExcel(session.id)}>XLS</button></div></div></article>
    })}
  </main>
}

function ProgressView() {
  const sessions = useLiveQuery(() => db.workoutSessions.filter((s)=>!s.active&&s.endedAt>0).toArray()) ?? []
  const sets = useLiveQuery(() => db.sessionSets.where('completed').equals(1).toArray()) ?? []
  const stats = useMemo(() => {
    const byExercise = new Map<string,{name:string;pr:number;volume:number;sets:number}>()
    for (const set of sets) {
      const current=byExercise.get(set.exerciseId)??{name:set.exerciseName,pr:0,volume:0,sets:0}
      const kg=toNumber(set.weight), reps=toNumber(set.reps)
      current.pr=Math.max(current.pr,kg); current.volume+=kg*reps; current.sets+=1; byExercise.set(set.exerciseId,current)
    }
    return [...byExercise.values()].sort((a,b)=>b.volume-a.volume)
  },[sets])
  const totalVolume=stats.reduce((sum,item)=>sum+item.volume,0)
  return <main className="page-view"><div className="page-title"><div><span>PROGRESSI</span><h2>Il tuo lavoro</h2></div></div>
    <div className="stat-grid"><div><span>WORKOUT</span><b>{sessions.length}</b></div><div><span>VOLUME</span><b>{Math.round(totalVolume).toLocaleString('it-IT')}</b><small>kg</small></div></div>
    <h3 className="section-title">Personal record</h3>
    {!stats.length?<div className="empty-card"><strong>Ancora nessun dato</strong><span>I PR compariranno dopo i primi allenamenti.</span></div>:stats.map((item)=><article className="pr-card" key={item.name}><div><strong>{item.name}</strong><span>{item.sets} serie registrate</span></div><b>{item.pr||'—'}<small>{item.pr?' kg':''}</small></b></article>)}
  </main>
}

function MobilitySheet({ day, week, onClose }: { day: WorkoutDay; week: number; onClose: () => void }) {
  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.where('dayId').equals(day.id).sortBy('order'), [day.id]) ?? []
  const prescriptions = useLiveQuery<Array<Prescription | undefined>>(async()=>Promise.all(exercises.map(async(e)=>db.prescriptions.where('[exerciseId+weekNumber]').equals([e.id,week]).first())),[exercises.map(e=>e.id).join(','),week]) ?? []
  return <div className="sheet-backdrop" onMouseDown={(e)=>{if(e.currentTarget===e.target)onClose()}}><section className="bottom-sheet mobility-sheet"><div className="sheet-handle"/><div className="mobility-head"><div><span>MOBILITÀ</span><h2>Prima di iniziare</h2></div><button onClick={onClose}>×</button></div>{exercises.map((exercise,index)=><div className="mobility-row" key={exercise.id}><img src={imageForExercise(exercise.name,prescriptions[index]?.program??'',exercise.trainerNote)} alt="" onError={(e)=>{e.currentTarget.src='/icon.svg'}}/><div><strong>{exercise.name}</strong><span>{prescriptions[index]?.program??''}</span></div></div>)}</section></div>
}
