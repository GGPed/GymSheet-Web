import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, ParsedSheet, Prescription, SessionSet, SetLog, Setting, Sheet, WorkoutDay, WorkoutSession } from './types'
import { setCountForProgram, uid } from './utils'

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
  await db.transaction('rw', db.sheets, db.days, db.exercises, db.prescriptions, async () => {
    await db.sheets.toCollection().modify({ active: 0 })
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
  await db.settings.put({ key, value })
}

export async function startWorkout(sheetId: string, dayId: string, weekNumber: number): Promise<WorkoutSession> {
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
  const exercises = await db.exercises.where('dayId').equals(session.dayId).sortBy('order')
  const snapshots: SessionSet[] = []
  for (const exercise of exercises) {
    const prescription = await db.prescriptions.where('[exerciseId+weekNumber]').equals([exercise.id, session.weekNumber]).first()
    const setCount = setCountForProgram(prescription?.program ?? '')
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
    await db.sessionSets.bulkPut(snapshots)
    await db.workoutSessions.update(session.id, { active: 0, endedAt: Date.now(), completionMode: mode })
    const previous = await getSetting<number>('workoutsSinceBackup', 0)
    await db.settings.put({ key: 'workoutsSinceBackup', value: previous + 1 })
  })
}

export async function updateSetLog(exerciseId: string, weekNumber: number, setNumber: number, patch: Partial<SetLog>): Promise<SetLog> {
  const id = `${exerciseId}:${weekNumber}:${setNumber}`
  const current = await db.setLogs.get(id)
  const next: SetLog = {
    id, exerciseId, weekNumber, setNumber,
    weight: current?.weight ?? '', reps: current?.reps ?? '', completed: current?.completed ?? 0,
    updatedAt: Date.now(), ...patch
  }
  await db.setLogs.put(next)
  return next
}

export async function resetAllData(): Promise<void> {
  await db.delete()
  await db.open()
}
