import type { SupersetPart } from './superset'
export type ThemePreference = 'system' | 'light' | 'dark'
export type SheetSource = 'excel' | 'word' | 'android' | 'web-backup'
export type CompletionMode = 'complete' | 'early'

export interface Sheet {
  coachNotes?: string
  id: string
  name: string
  importedAt: number
  archivedAt?: number
  active: 0 | 1
  source: SheetSource
  initialWeeks?: number
}

export interface WorkoutDay {
  id: string
  sheetId: string
  dayIndex: number
  title: string
  mobility: 0 | 1
  label?: string
}

export interface Exercise {
  id: string
  dayId: string
  order: number
  name: string
  recoveryLabel: string
  recoverySeconds: number
  trainerNote: string
  components?: SupersetPart[]
}

export interface Prescription {
  id: string
  exerciseId: string
  weekNumber: number
  program: string
}

export interface SetLog {
  weightEdited?: boolean
  loadPrepared?: boolean
  id: string
  exerciseId: string
  weekNumber: number
  setNumber: number
  weight: string
  reps: string
  completed: 0 | 1
  updatedAt: number
}

export interface WorkoutSession {
  id: string
  sheetId: string
  dayId: string
  weekNumber: number
  startedAt: number
  endedAt: number
  active: 0 | 1
  completionMode?: CompletionMode
  migratedFromAndroid?: 0 | 1
}

export interface SessionSet {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  prescribed: string
  weight: string
  reps: string
  completed: 0 | 1
  completedAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export interface ParsedSheet {
  sheet: Sheet
  days: WorkoutDay[]
  exercises: Exercise[]
  prescriptions: Prescription[]
  warnings?: string[]
}

export interface GymSheetBackupV1 {
  format: 'gymsheet-web-backup'
  version: 1
  exportedAt: number
  payload: {
    sheets: Sheet[]
    days: WorkoutDay[]
    exercises: Exercise[]
    prescriptions: Prescription[]
    setLogs: SetLog[]
    workoutSessions: WorkoutSession[]
    sessionSets: SessionSet[]
    settings: Setting[]
  }
}
