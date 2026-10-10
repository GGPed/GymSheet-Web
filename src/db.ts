import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, ParsedSheet, Prescription, SessionSet, SetLog, Setting, Sheet, WorkoutDay, WorkoutSession } from './types'
import { uid } from './utils'
import { effectivePrescription, trainingSetCount } from './training'

class GymSheetDB extends Dexie {
  sheets!: EntityTable<Sheet, 'id'>
  days!: EntityTable<WorkoutDay, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  prescriptions!: EntityTable<Prescription, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  sessionSets!: EntityTable<SessionSet, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor() {
    super('GymSheetWeb')
    this.version(1).stores({
      sheets: 'id, active, importedAt',
      days: 'id, sheetId, [sheetId+dayIndex], mobility',
      exercises: 'id, dayId, [dayId+order]',
      prescriptions: 'id, exerciseId, [exerciseId+weekNumber]',
      setLogs: 'id, exerciseId, [exerciseId+weekNumber], updatedAt, completed',
      workoutSessions: 'id, active, sheetId, dayId, [dayId+weekNumber], startedAt, endedAt',
      sessionSets: 'id, sessionId, exerciseId, completedAt',
      settings: 'key'
    })
  }
}

export const db = new GymSheetDB()

export async function installParsedSheet(parsed: ParsedSheet): Promise<void> {
  if (await db.workoutSessions.where('active').equals(1).count()) throw new Error('Concludi l’allenamento in corso prima di cambiare scheda.')
  await db.transaction('rw', db.sheets, db.days, db.exercises, db.prescriptions, async () => {
    await db.sheets.where('active').equals(1).modify(sheet=>{sheet.active=0;sheet.archivedAt=parsed.sheet.importedAt})
    await db.sheets.add(parsed.sheet)
    await db.days.bulkAdd(parsed.days)
    await db.exercises.bulkAdd(parsed.exercises)
    await db.prescriptions.bulkAdd(parsed.prescriptions)
  })
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await db.settings.get(key)
  return (value?.value as T | undefined) ?? fallback
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  if (key.startsWith('superset:') || key.startsWith('exerciseNote:')) {
    await db.transaction('rw', db.settings, async () => { await assertWorkoutUnlocked(); await db.settings.put({ key, value }) })
    return
  }
  await db.settings.put({ key, value })
}

export async function assertWorkoutUnlocked(): Promise<void> {
  if (await getSetting<number>('recoveryEndAt', 0) > Date.now()) throw new Error('Recupero in corso. Attendi la fine oppure usa Salta recupero.')
}

export async function startWorkout(sheetId: string, dayId: string, weekNumber: number): Promise<WorkoutSession> {
  await assertWorkoutUnlocked()
  const existing = await db.workoutSessions.where('active').equals(1).first()
  if (existing) return existing
  const session: WorkoutSession = {
    id: uid('session'), sheetId, dayId, weekNumber,
    startedAt: Date.now(), endedAt: 0, active: 1
  }
  await db.workoutSessions.add(session)
  return session
}

export async function finishWorkout(session: WorkoutSession, mode: 'complete' | 'early'): Promise<void> {
  await assertWorkoutUnlocked()
  const exercises = await db.exercises.where('dayId').equals(session.dayId).sortBy('order')
  const snapshots: SessionSet[] = []
  for (const exercise of exercises) {
    const prescription = effectivePrescription(await db.prescriptions.where('exerciseId').equals(exercise.id).toArray(), session.weekNumber)
    const setCount = trainingSetCount(prescription?.program ?? '', await db.setLogs.where('[exerciseId+weekNumber]').equals([exercise.id, session.weekNumber]).toArray())
    for (let setNumber = 1; setNumber <= setCount; setNumber++) {
      const log = await db.setLogs.get(`${exercise.id}:${session.weekNumber}:${setNumber}`)
      snapshots.push({
        id: `${session.id}:${exercise.id}:${setNumber}`,
        sessionId: session.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber,
        prescribed: prescription?.program ?? '',
        weight: log?.weight ?? '',
        reps: log?.reps ?? '',
        completed: log?.completed ?? 0,
        completedAt: log?.updatedAt ?? 0
      })
    }
  }
  await db.transaction('rw', db.workoutSessions, db.sessionSets, db.settings, async () => {
    const currentSession = await db.workoutSessions.get(session.id)
    await assertWorkoutUnlocked()
    if (!currentSession?.active) return
    await db.sessionSets.bulkPut(snapshots)
    await db.workoutSessions.update(session.id, { active: 0, endedAt: Date.now(), completionMode: mode })
    const previous = await getSetting<number>('workoutsSinceBackup', 0)
    await db.settings.put({ key: 'workoutsSinceBackup', value: previous + 1 })
  })
}

// Editing a recorded set updates the same logs and snapshots consumed by reports.
// Saving valid values after the workout confirms the edited set, without
// reopening the session or starting recovery.
export async function saveRegisteredSet(log: SetLog, weight: string, reps: string): Promise<SetLog> {
  return db.transaction('rw', db.setLogs, db.sessionSets, db.workoutSessions, db.exercises, db.settings, async () => {
    await assertWorkoutUnlocked()
    const current = await db.setLogs.get(log.id)
    if (!current) throw new Error('La serie non risulta registrata.')
    if (!/^\d+(?:[.,]\d+)?$/.test(weight) || !/^\d+$/.test(reps)) throw new Error('Inserisci Kg e Ripetizioni validi.')
    const exercise = await db.exercises.get(current.exerciseId)
    const sessions = exercise ? await db.workoutSessions.where('[dayId+weekNumber]').equals([exercise.dayId, current.weekNumber]).toArray() : []
    const closed = sessions.some(session => !session.active && session.endedAt > 0)
    return updateSetLog(current.exerciseId, current.weekNumber, current.setNumber, {weight:weight.replace(',', '.'), reps, completed:closed ? 1 : current.completed})
  })
}

export async function updateSetLog(exerciseId: string, weekNumber: number, setNumber: number, patch: Partial<SetLog>): Promise<SetLog> {
  const id = `${exerciseId}:${weekNumber}:${setNumber}`
  return db.transaction('rw', db.setLogs, db.sessionSets, db.workoutSessions, db.exercises, db.settings, async () => {
    await assertWorkoutUnlocked()
    const current = await db.setLogs.get(id)
    const next: SetLog = { id, exerciseId, weekNumber, setNumber, weight: current?.weight ?? '', reps: current?.reps ?? '', completed: current?.completed ?? 0, updatedAt: Date.now(), ...patch }
    if (!next.weight.trim() || !next.reps.trim()) next.completed = 0
    await db.setLogs.put(next)
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) return next
    const sessions = await db.workoutSessions.where('[dayId+weekNumber]').equals([exercise.dayId, weekNumber]).toArray()
    for (const session of sessions.filter((s) => !s.active)) {
      const snapshotId = `${session.id}:${exerciseId}:${setNumber}`
      if (await db.sessionSets.get(snapshotId)) await db.sessionSets.update(snapshotId, { weight: next.weight, reps: next.reps, completed: next.completed, completedAt: next.updatedAt })
    }
    return next
  })
}

// Commit the completed set and its recovery together. Competing operations use
// the same settings transaction, so no subsequent set can slip through.
export async function completeWorkoutSet(exerciseId: string, week: number, setNumber: number, seconds: number, label: string): Promise<boolean> {
  return db.transaction('rw', db.setLogs, db.sessionSets, db.workoutSessions, db.exercises, db.settings, async () => {
    await assertWorkoutUnlocked()
    if ((await db.setLogs.get(`${exerciseId}:${week}:${setNumber}`))?.completed) return false
    const log = await updateSetLog(exerciseId, week, setNumber, { completed: 1 })
    if (!log.completed) return false
    if (seconds > 0) await db.settings.bulkPut([{key:'recoveryEndAt',value:Date.now()+seconds*1000},{key:'recoverySubtitle',value:label}])
    return true
  })
}

export async function findLastCompletedSet(dayId: string, weekNumber: number): Promise<SetLog | undefined> {
  const exercises = await db.exercises.where('dayId').equals(dayId).toArray()
  if (!exercises.length) return undefined
  const ids = new Set(exercises.map((exercise) => exercise.id))
  const logs = await db.setLogs.where('completed').equals(1).toArray()
  return logs
    .filter((log) => log.weekNumber === weekNumber && ids.has(log.exerciseId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

export async function undoLastCompletedSet(dayId: string, weekNumber: number): Promise<SetLog | undefined> {
  const latest = await findLastCompletedSet(dayId, weekNumber)
  if (!latest) return undefined
  return updateSetLog(latest.exerciseId, latest.weekNumber, latest.setNumber, { completed: 0 })
}

export async function resetAllData(): Promise<void> {
  await db.delete()
  await db.open()
}

export async function activateSheet(sheetId: string): Promise<void> {
  if (await db.workoutSessions.where('active').equals(1).count()) throw new Error('Concludi l’allenamento in corso prima di cambiare scheda.')
  await db.transaction('rw', db.sheets, async () => {
    if (!await db.sheets.get(sheetId)) throw new Error('Scheda non trovata.')
    await db.sheets.toCollection().modify({ active: 0 })
    await db.sheets.update(sheetId, { active: 1 })
  })
}
