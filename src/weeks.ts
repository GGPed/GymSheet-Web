import { db, getSetting } from './db'
import { effectivePrescription } from './training'

export async function availableWeeks(sheetId:string):Promise<number> {
  const sheet=await db.sheets.get(sheetId),dayIds=new Set((await db.days.where('sheetId').equals(sheetId).toArray()).map(d=>d.id))
  const ids=new Set((await db.exercises.toArray()).filter(e=>dayIds.has(e.dayId)).map(e=>e.id))
  const [prescriptions,logs,sessions,created]=await Promise.all([db.prescriptions.toArray(),db.setLogs.toArray(),db.workoutSessions.where('sheetId').equals(sheetId).toArray(),getSetting(`availableWeeks:${sheetId}`,0)])
  return Math.max(1,sheet?.initialWeeks??0,Number(created)||0,...prescriptions.filter(p=>ids.has(p.exerciseId)).map(p=>p.weekNumber),...logs.filter(l=>ids.has(l.exerciseId)).map(l=>l.weekNumber),...sessions.map(s=>s.weekNumber))
}
export async function addWeek(sheetId:string):Promise<number>{
  const dayIds=new Set((await db.days.where('sheetId').equals(sheetId).toArray()).map(d=>d.id)),exercises=(await db.exercises.toArray()).filter(e=>dayIds.has(e.dayId))
  return db.transaction('rw',[db.sheets,db.days,db.exercises,db.prescriptions,db.setLogs,db.workoutSessions,db.settings],async()=>{
    const next=(await availableWeeks(sheetId))+1
    for(const exercise of exercises){const previous=effectivePrescription(await db.prescriptions.where('exerciseId').equals(exercise.id).toArray(),next-1);if(previous)await db.prescriptions.put({id:`${exercise.id}:${next}`,exerciseId:exercise.id,weekNumber:next,program:previous.program})}
    await db.settings.put({key:`availableWeeks:${sheetId}`,value:next});await db.settings.put({key:`week:${sheetId}`,value:next});return next
  })
}
