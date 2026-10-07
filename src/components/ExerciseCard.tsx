import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateSetLog } from '../db'
import type { Exercise, Prescription, WorkoutSession } from '../types'
import { imageForExercise } from '../services/images'
import { setCountForProgram } from '../utils'

interface Props {
  exercise: Exercise
  prescription?: Prescription
  week: number
  activeSession?: WorkoutSession
  sessionElsewhere: boolean
  onCompletedSet: (exercise: Exercise, setNumber: number) => void
}

export function ExerciseCard({ exercise, prescription, week, activeSession, sessionElsewhere, onCompletedSet }: Props) {
  const setCount = setCountForProgram(prescription?.program ?? '')
  const logs = useLiveQuery(() => db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, week]).sortBy('setNumber'), [exercise.id, week]) ?? []
  const previousLogs = useLiveQuery(async () => week > 1 ? await db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, week - 1]).sortBy('setNumber') : [], [exercise.id, week]) ?? []
  const allDone = logs.filter((log) => log.completed).length >= setCount
  const canTrain = Boolean(activeSession && activeSession.dayId === exercise.dayId) && !sessionElsewhere
  const hasPrevious = previousLogs.some((log) => log.weight || log.reps)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (allDone) setExpanded(false)
  }, [allDone])

  const copyPrevious = async () => {
    if (!canTrain || !hasPrevious) return
    if (!confirm('Copiare kg e ripetizioni dalla settimana precedente? Le serie resteranno da completare.')) return
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

  return <article className={`exercise-card ${allDone ? 'is-complete' : ''} ${!expanded ? 'is-collapsed' : ''}`}>
    <button className="exercise-summary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
      <img className="exercise-image" src={imageForExercise(exercise.name, prescription?.program ?? '', exercise.trainerNote)} alt="" onError={(e) => { e.currentTarget.src = '/icon-192.png' }} />
      <span className="exercise-copy">
        <span className="exercise-eyebrow">{allDone ? '✓ COMPLETATO' : exercise.recoveryLabel ? `REC ${exercise.recoveryLabel}` : 'ESERCIZIO'}</span>
        <strong>{exercise.name}</strong>
        <span className="target">{prescription?.program || 'Nessuna prescrizione'}</span>
      </span>
      <span className="collapse-chevron">{expanded ? '⌃' : '⌄'}</span>
    </button>

    {expanded && <>
      {exercise.trainerNote && <details className="coach-note"><summary>Note coach</summary><p>{exercise.trainerNote}</p></details>}

      {week > 1 && hasPrevious && <button className="copy-previous" disabled={!canTrain} onClick={() => void copyPrevious()}>Copia valori settimana precedente</button>}

      <div className="sets">
        {Array.from({ length: setCount }, (_, index) => {
          const setNumber = index + 1
          const log = logs.find((item) => item.setNumber === setNumber)
          const previous = previousLogs.find((item) => item.setNumber === setNumber)
          const previousDone = setNumber === 1 || Boolean(logs.find((item) => item.setNumber === setNumber - 1)?.completed)
          const enabled = canTrain && previousDone
          return <div className={`set-row ${log?.completed ? 'done' : ''}`} key={setNumber}>
            <div className="set-number">{setNumber}</div>
            <label className="input-with-previous"><span>KG</span><input inputMode="decimal" value={log?.weight ?? ''} disabled={!enabled && !log?.completed} onChange={(e) => void updateSetLog(exercise.id, week, setNumber, { weight: e.target.value })} /><small>{week > 1 ? `prec ${previous?.weight || '—'}${previous?.weight ? ' kg' : ''}` : ' '}</small></label>
            <label className="input-with-previous"><span>REPS</span><input inputMode="numeric" value={log?.reps ?? ''} disabled={!enabled && !log?.completed} onChange={(e) => void updateSetLog(exercise.id, week, setNumber, { reps: e.target.value })} /><small>{week > 1 ? `prec ${previous?.reps || '—'}` : ' '}</small></label>
            <button className={`complete-set ${log?.completed ? 'done' : ''}`} disabled={!enabled && !log?.completed} onClick={async () => {
              const completed = log?.completed ? 0 : 1
              await updateSetLog(exercise.id, week, setNumber, { completed })
              if (completed) onCompletedSet(exercise, setNumber)
            }}>{log?.completed ? '✓' : 'Completa'}</button>
          </div>
        })}
      </div>
    </>}
  </article>
}
