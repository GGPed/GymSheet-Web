import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { ParsedSheet, SessionSet, SetLog, WorkoutSession } from '../types'
import { db } from '../db'
import { parseRecoverySeconds, setCountForProgram, uid } from '../utils'

type Row = Record<string, string | number | Uint8Array | null>

function rows(database: Database, sql: string): Row[] {
  const result = database.exec(sql)[0]
  if (!result) return []
  return result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index] as string | number | Uint8Array | null])))
}

export async function migrateAndroidBackup(file: File): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const database = new SQL.Database(new Uint8Array(await file.arrayBuffer()))
  const sourceSheets = rows(database, 'SELECT * FROM sheets ORDER BY id')
  if (!sourceSheets.length) throw new Error('Il backup Android non contiene schede GymSheet.')

  const sourceSheet = sourceSheets.find((sheet) => Number(sheet.active) === 1) ?? sourceSheets[0]
  const oldSheetId = Number(sourceSheet.id)
  const sheetId = uid('sheet')
  const dayMap = new Map<number, string>()
  const exerciseMap = new Map<number, string>()
  const parsed: ParsedSheet = {
    sheet: { id: sheetId, name: String(sourceSheet.name ?? 'GymSheet Android'), importedAt: Number(sourceSheet.imported_at ?? Date.now()), active: 1, source: 'android' },
    days: [], exercises: [], prescriptions: []
  }

  for (const day of rows(database, `SELECT * FROM days WHERE sheet_id=${oldSheetId} ORDER BY day_index`)) {
    const id = uid('day')
    dayMap.set(Number(day.id), id)
    const title = String(day.title ?? '')
    parsed.days.push({ id, sheetId, dayIndex: Number(day.day_index), title, mobility: /mobilit/i.test(title) ? 1 : 0 })
  }

  for (const exercise of rows(database, `SELECT e.* FROM exercises e JOIN days d ON d.id=e.day_id WHERE d.sheet_id=${oldSheetId} ORDER BY d.day_index,e.exercise_order`)) {
    const id = uid('exercise')
    exerciseMap.set(Number(exercise.id), id)
    parsed.exercises.push({
      id, dayId: dayMap.get(Number(exercise.day_id))!, order: Number(exercise.exercise_order),
      name: String(exercise.name ?? ''), recoveryLabel: String(exercise.recovery ?? ''),
      recoverySeconds: parseRecoverySeconds(String(exercise.recovery ?? '')), trainerNote: String(exercise.trainer_note ?? '')
    })
  }

  for (const prescription of rows(database, 'SELECT * FROM prescriptions ORDER BY exercise_id,week_number')) {
    const exerciseId = exerciseMap.get(Number(prescription.exercise_id))
    if (!exerciseId) continue
    const weekNumber = Number(prescription.week_number)
    parsed.prescriptions.push({ id: `${exerciseId}:${weekNumber}`, exerciseId, weekNumber, program: String(prescription.program ?? '') })
  }

  await db.transaction('rw', [db.sheets, db.days, db.exercises, db.prescriptions, db.setLogs, db.workoutSessions, db.sessionSets], async () => {
    await db.sheets.toCollection().modify({ active: 0 })
    await db.sheets.add(parsed.sheet)
    await db.days.bulkAdd(parsed.days)
    await db.exercises.bulkAdd(parsed.exercises)
    await db.prescriptions.bulkAdd(parsed.prescriptions)

    const migratedLogs: SetLog[] = []
    for (const log of rows(database, 'SELECT * FROM set_logs ORDER BY exercise_id,week_number,set_number')) {
      const exerciseId = exerciseMap.get(Number(log.exercise_id))
      if (!exerciseId) continue
      const weekNumber = Number(log.week_number), setNumber = Number(log.set_number)
      migratedLogs.push({
        id: `${exerciseId}:${weekNumber}:${setNumber}`, exerciseId, weekNumber, setNumber,
        weight: String(log.weight ?? ''), reps: String(log.reps ?? ''), completed: Number(log.completed) ? 1 : 0,
        updatedAt: Number(log.updated_at ?? Date.now())
      })
    }
    if (migratedLogs.length) await db.setLogs.bulkPut(migratedLogs)

    for (const sourceSession of rows(database, `SELECT * FROM workout_sessions WHERE sheet_id=${oldSheetId} ORDER BY started_at`)) {
      const dayId = dayMap.get(Number(sourceSession.day_id))
      if (!dayId) continue
      const sessionId = uid('session')
      const session: WorkoutSession = {
        id: sessionId, sheetId, dayId, weekNumber: Number(sourceSession.week_number), startedAt: Number(sourceSession.started_at),
        endedAt: Number(sourceSession.ended_at), active: Number(sourceSession.active) ? 1 : 0,
        completionMode: Number(sourceSession.active) ? undefined : 'complete', migratedFromAndroid: 1
      }
      await db.workoutSessions.add(session)
      if (!session.active) {
        const dayExercises = parsed.exercises.filter((exercise) => exercise.dayId === dayId)
        const snapshots: SessionSet[] = []
        for (const exercise of dayExercises) {
          const prescription = parsed.prescriptions.find((item) => item.exerciseId === exercise.id && item.weekNumber === session.weekNumber)
          const setCount = setCountForProgram(prescription?.program ?? '')
          for (let setNumber = 1; setNumber <= setCount; setNumber++) {
            const log = migratedLogs.find((item) => item.exerciseId === exercise.id && item.weekNumber === session.weekNumber && item.setNumber === setNumber)
            snapshots.push({
              id: `${sessionId}:${exercise.id}:${setNumber}`, sessionId, exerciseId: exercise.id, exerciseName: exercise.name,
              setNumber, prescribed: prescription?.program ?? '', weight: log?.weight ?? '', reps: log?.reps ?? '',
              completed: log?.completed ?? 0, completedAt: log?.updatedAt ?? 0
            })
          }
        }
        if (snapshots.length) await db.sessionSets.bulkPut(snapshots)
      }
    }
  })
  database.close()
}
