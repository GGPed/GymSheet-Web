import {InlineSetEditor} from './InlineSetEditor'
import {CoachNote} from './CoachNote'
import {InlineExerciseNote} from './InlineExerciseNote'
import {supersetParts} from '../superset'
import {SupersetSet} from './SupersetSet'
import {WorkoutControls} from './RecoveryWorkoutLock'
import { ExerciseDetails, ExerciseImagePopup, ExerciseNotePopup } from './ParityFeatures'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateSetLog } from '../db'
import type { Exercise, Prescription, WorkoutSession } from '../types'
import { imageForExercise } from '../services/images'
import { displayProgram, trainingSetCount } from '../training'
import { toNumber, targetForSet, readableRecovery, coachNoteForWeek } from '../utils'
interface Props {
  exercise: Exercise
  prescription?: Prescription
  week: number
  activeSession?: WorkoutSession
  dayClosed: boolean
  sessionElsewhere: boolean
  onCompletedSet: (exercise: Exercise, setNumber: number, count: number) => Promise<boolean>
}
export function ExerciseCard({ exercise, prescription, week, dayClosed, activeSession, sessionElsewhere, onCompletedSet }: Props) {
  const completing = useRef(new Set<number>())
  const [operationError,setOperationError] = useState('')
  const changeSet = async (setNumber:number,patch:{weight?:string;reps?:string}) => {
    try { await updateSetLog(exercise.id,week,setNumber,patch);setOperationError('') }
    catch(e) { setOperationError(e instanceof Error?e.message:'Serie non modificata.') }
  }
  const logs = useLiveQuery(() => db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, week]).sortBy('setNumber'), [exercise.id, week]) ?? []
  const previousLogs = useLiveQuery(async () => week > 1 ? await db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, week - 1]).sortBy('setNumber') : [], [exercise.id, week]) ?? []
  const setCount = trainingSetCount(prescription?.program ?? '', logs)
  const components=exercise.components??supersetParts(prescription?.program??'',exercise.name)
  const allDone = Array.from({length:setCount},(_,i)=>i+1).every(n=>logs.some(log=>log.setNumber===n&&log.completed))
  const canTrain = Boolean(activeSession && activeSession.dayId === exercise.dayId && activeSession.weekNumber === week) && !sessionElsewhere
  const canPrepareLoad=!dayClosed&&!activeSession&&!sessionElsewhere
  const hasPrevious = previousLogs.some((log) => log.weight || log.reps)
  const [imageOpen,setImageOpen] = useState(false)
  const [noteOpen,setNoteOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const noteKey = `exerciseNote:${exercise.id}:${week}`
  const savedNote = useLiveQuery(() => db.settings.get(noteKey), [noteKey])
  const legacy = savedNote?.value as {weight?:string;note?:string;updatedAt?:number}|undefined

  const [expanded, setExpanded] = useState(true)
  useEffect(() => {
    if (allDone) setExpanded(false)
  }, [allDone])
  const copyPrevious = async () => {
    if (dayClosed || sessionElsewhere || !hasPrevious) return
    if (logs.some(log=>log.weight.trim()||log.reps.trim()) && !confirm('Sovrascrivere kg e ripetizioni con quelli della settimana precedente? Le serie resteranno da completare.')) return
    for (let setNumber = 1; setNumber <= setCount; setNumber++) {
      const previous = previousLogs.find((item) => item.setNumber === setNumber)
      if (!previous) continue
      await updateSetLog(exercise.id, week, setNumber, {
        weight: previous.weight,
        reps: previous.reps,
        completed: 0
      })
    }
    setExpanded(true)
  }
  const completeSet=async(setNumber:number)=>{
    if(completing.current.has(setNumber))return
    completing.current.add(setNumber)
    try{if((await db.setLogs.get(`${exercise.id}:${week}:${setNumber}`))?.completed)return
      await onCompletedSet(exercise,setNumber,setCount)
    }catch(e){setOperationError(e instanceof Error?e.message:'Serie non completata.')}finally{completing.current.delete(setNumber)}
  }
  return <article className={`exercise-card ${allDone ? 'is-complete' : ''} ${!expanded ? 'is-collapsed' : ''}`}>
    <div className="exercise-hero">
      <button className="exercise-image-button" aria-label={`Immagine ${exercise.name}`} onClick={()=>setImageOpen(true)}><img className="exercise-image" src={imageForExercise(exercise.name,prescription?.program??'',exercise.trainerNote)} alt=""/></button>
      <div className="exercise-copy"><button className="exercise-name-button" onClick={()=>setDetailsOpen(true)}>{exercise.name}</button><span className="target">{displayProgram(prescription?.program??'')||'Programma non indicato'}</span>
      <div className="exercise-badges">{exercise.recoveryLabel&&<span>Recupero {readableRecovery(exercise.recoverySeconds)}</span>}{allDone&&<span className="done-badge">✓ COMPLETATO</span>}</div></div>
    </div>
    {imageOpen&&<ExerciseImagePopup exercise={exercise} program={prescription?.program??''} onClose={()=>setImageOpen(false)}/>}
    {noteOpen&&!dayClosed&&<ExerciseNotePopup exercise={exercise} week={week} onClose={()=>setNoteOpen(false)}/>}
    {detailsOpen&&<ExerciseDetails exercise={exercise} week={week} program={prescription?.program??''} onClose={()=>setDetailsOpen(false)}/>}
    {!expanded&&<div className="completed-compact"><span>{setCount} serie completate · dettagli nascosti</span><button onClick={()=>setExpanded(true)}>Mostra</button></div>}
    {expanded && <>
      {legacy?.weight && <p className="legacy-weight">Carico annotato: {legacy.weight}</p>}
      {coachNoteForWeek(exercise.trainerNote,week)&&<CoachNote note={coachNoteForWeek(exercise.trainerNote,week)}/>}
      <div className="series-heading"><span>SERIE</span><WorkoutControls>{week>1&&hasPrevious&&<button disabled={dayClosed||sessionElsewhere} onClick={()=>void copyPrevious().catch(e=>setOperationError(e instanceof Error?e.message:"Serie non modificate."))}>Copia precedente</button>}</WorkoutControls></div>
      <WorkoutControls className="sets">
        {Array.from({ length: setCount }, (_, index) => {
          const setNumber = index + 1
          const log = logs.find((item) => item.setNumber === setNumber)
          const previous = previousLogs.find((item) => item.setNumber === setNumber)
          const previousDone = setNumber === 1 || Boolean(logs.find((item) => item.setNumber === setNumber - 1)?.completed)
          const enabled = canTrain && previousDone
          if(components.length)return <SupersetSet canPrepareLoad={canPrepareLoad} completionLabel={exercise.components?.length===1?'Completa serie':undefined} key={setNumber} exerciseId={exercise.id} week={week} setNumber={setNumber} parts={components} log={log} enabled={enabled} dayClosed={dayClosed} editable={Boolean(log&&(log.completed||dayClosed))} onComplete={()=>completeSet(setNumber)}/>
          return <div className={`set-row ${log?.completed ? 'done' : ''}`} key={setNumber}>
            {dayClosed&&<span className={`set-status-label ${log?.completed?"completed":"incomplete"}`}>{log?.completed?"✓ Serie completata":"Serie non completata"}</span>}
            <div className="set-number">Serie {setNumber}{targetForSet(prescription?.program??'',setNumber)&&<small className="series-target"> · {targetForSet(prescription?.program??'',setNumber)}</small>}</div>
            {log&&(log.completed||dayClosed)?<InlineSetEditor log={log}/>:<>
            <label className="input-with-previous"><span>CARICO</span>{log?.completed||dayClosed?<output className="saved-set-value">{log?.weight?`${log.weight} kg`:"—"}</output>:<input inputMode="decimal" value={log?.weight ?? ''} disabled={(!enabled&&!canPrepareLoad) || dayClosed} onChange={(e) => void changeSet(setNumber, { weight: e.target.value })} />}<small>{week > 1 ? `prec ${previous?.weight || '—'}${previous?.weight ? ' kg' : ''}` : ' '}</small></label>
            <label className="input-with-previous"><span>Ripetizioni</span>{log?.completed||dayClosed?<output className="saved-set-value">{log?.reps||"—"}</output>:<input inputMode="numeric" value={log?.reps ?? ''} disabled={!enabled || dayClosed} onChange={(e) => void changeSet(setNumber, { reps: e.target.value })} />}<small>{week > 1 ? `prec ${previous?.reps || '—'}` : ' '}</small></label>
            <button className={`complete-set ${log?.completed ? 'done' : ''}`} disabled={Boolean(log?.completed) || (!enabled && !log?.completed) || (!log?.completed && (!log?.weight.trim() || !log?.reps.trim()))} onClick={async () => {
              if (log?.completed || completing.current.has(setNumber)) return
              completing.current.add(setNumber)
              try {
              if((await db.setLogs.get(`${exercise.id}:${week}:${setNumber}`))?.completed)return
              await onCompletedSet(exercise, setNumber, setCount)
              } catch(e){setOperationError(e instanceof Error?e.message:'Serie non completata.')} finally {completing.current.delete(setNumber)}
            }}>{log?.completed ? '✓ Fatta' : 'Completa serie'}</button>
            </>}
            {/\+\s*[\d.,]*\s*kg\b/i.test(prescription?.program??'') && previous?.weight && <small className="load-goal">{log?.completed && toNumber(log.weight)>toNumber(previous.weight)?'✓ Carico aumentato':'Aumenta il carico rispetto alla settimana precedente'}</small>}
            <div className="set-previous">Precedente {previous?.weight||'—'}{previous?.weight?' kg':''} × {previous?.reps||'—'}</div>
          </div>
        })}
      </WorkoutControls>
      {operationError&&<p className="error" role="alert">{operationError}</p>}
      {legacy?.note&&<p className="weekly-note-preview">“{legacy.note}”</p>}
      {noteOpen&&dayClosed&&<InlineExerciseNote exerciseId={exercise.id} week={week} onSaved={()=>setNoteOpen(false)}/>}
      <div className="exercise-actions"><button onClick={()=>setNoteOpen(true)}>{legacy?.note?'Nota · modifica':'+ Nota'}</button><button onClick={()=>setDetailsOpen(true)}>Storico</button></div>
      {allDone&&<button className="collapse-exercise" onClick={()=>setExpanded(false)}>Riduci esercizio</button>}
    </>}
  </article>
}
