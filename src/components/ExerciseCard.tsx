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
  const allDone = logs.filter((log) => log.completed).length >= setCount
  const canTrain = Boolean(activeSession && activeSession.dayId === exercise.dayId) && !sessionElsewhere

  return <article className={`exercise-card ${allDone ? 'is-complete' : ''}`}>
    <div className="exercise-top">
      <img className="exercise-image" src={imageForExercise(exercise.name, prescription?.program ?? '', exercise.trainerNote)} alt="" onError={(e) => { e.currentTarget.src = '/icon.svg' }} />
      <div className="exercise-copy">
        <div className="exercise-eyebrow">{allDone ? '✓ COMPLETATO' : exercise.recoveryLabel ? `REC ${exercise.recoveryLabel}` : 'ESERCIZIO'}</div>
        <h3>{exercise.name}</h3>
        <div className="target">{prescription?.program || 'Nessuna prescrizione'}</div>
      </div>
    </div>

    {exercise.trainerNote && <details className="coach-note"><summary>Note coach</summary><p>{exercise.trainerNote}</p></details>}

    <div className="sets">
      {Array.from({ length: setCount }, (_, index) => {
        const setNumber = index + 1
        const log = logs.find((item) => item.setNumber === setNumber)
        const previousDone = setNumber === 1 || Boolean(logs.find((item) => item.setNumber === setNumber - 1)?.completed)
        const enabled = canTrain && previousDone
        return <div className={`set-row ${log?.completed ? 'done' : ''}`} key={setNumber}>
          <div className="set-number">{setNumber}</div>
          <label><span>KG</span><input inputMode="decimal" value={log?.weight ?? ''} disabled={!enabled && !log?.completed} onChange={(e) => void updateSetLog(exercise.id, week, setNumber, { weight: e.target.value })} /></label>
          <label><span>REPS</span><input inputMode="numeric" value={log?.reps ?? ''} disabled={!enabled && !log?.completed} onChange={(e) => void updateSetLog(exercise.id, week, setNumber, { reps: e.target.value })} /></label>
          <button className={`complete-set ${log?.completed ? 'done' : ''}`} disabled={!enabled && !log?.completed} onClick={async () => {
            const completed = log?.completed ? 0 : 1
            await updateSetLog(exercise.id, week, setNumber, { completed })
            if (completed) onCompletedSet(exercise, setNumber)
          }}>{log?.completed ? '✓' : 'Completa'}</button>
        </div>
      })}
    </div>
  </article>
}
