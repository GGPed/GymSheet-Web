import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { Sheet, WorkoutDay, Exercise, Prescription, SessionSet, SetLog, WorkoutSession, Setting } from '../types'
import { db } from '../db'
import { parseRecoverySeconds, setCountForProgram, uid } from '../utils'
type Row = Record<string, string | number | Uint8Array | null>
function rows(database: Database, table: string): Row[] {
  if (!database.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).length) return []
  const result = database.exec(`SELECT * FROM ${table}`)[0]
  return result ? result.values.map(values => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])) as Row) : []
}
export function convertAndroidDatabase(database: Database) {
  const sourceSheets = rows(database, 'sheets')
  if (!sourceSheets.length) throw new Error('Il backup Android non contiene schede GymSheet.')
  const activeId = Number((sourceSheets.find(s => Number(s.active) === 1) ?? sourceSheets[0]).id)
  const sheetMap = new Map<number,string>(), dayMap = new Map<number,string>(), exerciseMap = new Map<number,string>()
  const sheets: Sheet[] = sourceSheets.map(s => { const id=uid('sheet'); sheetMap.set(Number(s.id),id); return {id,name:String(s.name??'GymSheet Android'),importedAt:Number(s.imported_at??Date.now()),active:Number(s.id)===activeId?1:0,source:'android'} })
  const days: WorkoutDay[] = rows(database,'days').filter(d=>sheetMap.has(Number(d.sheet_id))).map(d=>{const id=uid('day');dayMap.set(Number(d.id),id);return {id,sheetId:sheetMap.get(Number(d.sheet_id))!,dayIndex:Number(d.day_index),title:String(d.title??''),mobility:/mobilit/i.test(String(d.title))?1:0}})
  const exercises: Exercise[] = rows(database,'exercises').filter(e=>dayMap.has(Number(e.day_id))).map(e=>{const id=uid('exercise');exerciseMap.set(Number(e.id),id);return {id,dayId:dayMap.get(Number(e.day_id))!,order:Number(e.exercise_order),name:String(e.name??''),recoveryLabel:String(e.recovery??''),recoverySeconds:parseRecoverySeconds(String(e.recovery??'')),trainerNote:String(e.trainer_note??'')}})
  const prescriptions: Prescription[] = rows(database,'prescriptions').filter(p=>exerciseMap.has(Number(p.exercise_id))).map(p=>{const exerciseId=exerciseMap.get(Number(p.exercise_id))!,weekNumber=Number(p.week_number);return {id:`${exerciseId}:${weekNumber}`,exerciseId,weekNumber,program:String(p.program??'')}})
  const setLogs: SetLog[] = rows(database,'set_logs').filter(l=>exerciseMap.has(Number(l.exercise_id))).map(l=>{const exerciseId=exerciseMap.get(Number(l.exercise_id))!,weekNumber=Number(l.week_number),setNumber=Number(l.set_number);return {id:`${exerciseId}:${weekNumber}:${setNumber}`,exerciseId,weekNumber,setNumber,weight:String(l.weight??''),reps:String(l.reps??''),completed:Number(l.completed)?1:0,updatedAt:Number(l.updated_at??0)}})
  const settings: Setting[] = rows(database,'logs').filter(l=>exerciseMap.has(Number(l.exercise_id))).map(l=>({key:`exerciseNote:${exerciseMap.get(Number(l.exercise_id))}:${Number(l.week_number)}`,value:{weight:String(l.weight??''),note:String(l.note??''),updatedAt:Number(l.updated_at??0)}}))
  const workoutSessions: WorkoutSession[] = rows(database,'workout_sessions').filter(s=>sheetMap.has(Number(s.sheet_id))&&dayMap.has(Number(s.day_id))).map(s=>({id:uid('session'),sheetId:sheetMap.get(Number(s.sheet_id))!,dayId:dayMap.get(Number(s.day_id))!,weekNumber:Number(s.week_number),startedAt:Number(s.started_at),endedAt:Number(s.ended_at),active:Number(s.active)?1:0,completionMode:Number(s.active)?undefined:'complete',migratedFromAndroid:1}))
  const sessionSets: SessionSet[] = []
  for(const session of workoutSessions.filter(s=>!s.active)) for(const exercise of exercises.filter(e=>e.dayId===session.dayId)) {
    const program=prescriptions.find(p=>p.exerciseId===exercise.id&&p.weekNumber===session.weekNumber)?.program??''
    for(let setNumber=1;setNumber<=setCountForProgram(program);setNumber++) {
      const log=setLogs.find(l=>l.exerciseId===exercise.id&&l.weekNumber===session.weekNumber&&l.setNumber===setNumber)
      sessionSets.push({id:`${session.id}:${exercise.id}:${setNumber}`,sessionId:session.id,exerciseId:exercise.id,exerciseName:exercise.name,setNumber,prescribed:program,weight:log?.weight??'',reps:log?.reps??'',completed:log?.completed??0,completedAt:log?.updatedAt??0})
    }
  }
  return {sheets,days,exercises,prescriptions,setLogs,settings,workoutSessions,sessionSets}
}
export async function migrateAndroidBackup(file: File): Promise<void> {
  if(await db.workoutSessions.where('active').equals(1).count()) throw new Error('Concludi l’allenamento in corso prima di importare un backup.')
  const SQL=await initSqlJs({locateFile:()=>wasmUrl})
  const database=new SQL.Database(new Uint8Array(await file.arrayBuffer()))
  try {
    const data=convertAndroidDatabase(database)
    if(data.workoutSessions.filter(s=>s.active).length>1) throw new Error('Il backup contiene più allenamenti attivi: verifica i dati nell’app Android prima di migrarli.')
    await db.transaction('rw',[db.sheets,db.days,db.exercises,db.prescriptions,db.setLogs,db.settings,db.workoutSessions,db.sessionSets],async()=>{
      await db.sheets.toCollection().modify({active:0})
      await db.sheets.bulkAdd(data.sheets);await db.days.bulkAdd(data.days);await db.exercises.bulkAdd(data.exercises);await db.prescriptions.bulkAdd(data.prescriptions)
      await db.setLogs.bulkAdd(data.setLogs);await db.settings.bulkPut(data.settings);await db.workoutSessions.bulkAdd(data.workoutSessions);await db.sessionSets.bulkAdd(data.sessionSets)
    })
  } finally { database.close() }
}
