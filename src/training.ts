import type { Prescription, SetLog, WorkoutSession } from './types'
import { setCountForProgram } from './utils'

export function effectivePrescription(items: Prescription[], week: number): Prescription | undefined {
  return items.filter(p => p.weekNumber <= week && p.program.trim()).sort((a,b) => b.weekNumber-a.weekNumber)[0]
}
export function trainingSetCount(program: string, logs: SetLog[] = []): number {
  if (/\b\d+\s*x\s*(?:\d|max|amrap)|^\s*\d+\s*set\b/i.test(program)) return setCountForProgram(program)
  return Math.min(12, Math.max(1, ...logs.map(l => l.setNumber)))
}
export function recoveryAfterSet(setNumber: number, count: number, lastExercise: boolean, seconds: number): number {
  return setNumber < count ? seconds : lastExercise ? 0 : 120
}
export function weeklyStreak(sessions: WorkoutSession[], dayIds: string[], week: number): number {
  if (!dayIds.length) return 0
  const full = (w: number) => dayIds.every(id => sessions.some(s => s.dayId === id && s.weekNumber === w && !s.active && s.endedAt > 0))
  let current = full(week) ? week : week - 1, streak = 0
  while (current > 0 && full(current)) { streak++; current-- }
  return streak
}
export function displayProgram(program: string): string {
  return program.replace(/\s*\+\s*[\d.,]*\s*kg\b/gi, '').trim()
}
