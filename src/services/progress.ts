import { db } from '../db'
import { buildProgress, filterProgress, type Period } from '../progressEngine'

export async function progressData(sheetId:string,period:Period='all') {
  const days=(await db.days.where('sheetId').equals(sheetId).sortBy('dayIndex')).filter(day=>!day.mobility)
  const exercises=(await Promise.all(days.map(day=>db.exercises.where('dayId').equals(day.id).sortBy('order')))).flat()
  const ids=new Set(exercises.map(e=>e.id))
  const [prescriptions,logs,sessions,snapshots]=await Promise.all([db.prescriptions.toArray(),db.setLogs.toArray(),db.workoutSessions.where('sheetId').equals(sheetId).toArray(),db.sessionSets.toArray()])
  const items=buildProgress(exercises,prescriptions.filter(p=>ids.has(p.exerciseId)),logs.filter(l=>ids.has(l.exerciseId)),sessions,snapshots)
  // Bodyweight abdominal exercises have no meaningful load curve. Keep loaded
  // abdominal exercises only when a real positive kg value was recorded.
  const visible=items.filter(item=>!/\b(addome|addominali|plank|planch|crunch|pulsazioni)\b/i.test(item.exercise.name)||item.executions.some(e=>e.maxKg!==null&&e.maxKg>0))
  return filterProgress(visible,'all'===period?'all':period)
}
