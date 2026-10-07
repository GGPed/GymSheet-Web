import { db, setSetting } from '../db'
import type { GymSheetBackupV1 } from '../types'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportWebBackup(): Promise<void> {
  const backup: GymSheetBackupV1 = {
    format: 'gymsheet-web-backup', version: 1, exportedAt: Date.now(),
    payload: {
      sheets: await db.sheets.toArray(), days: await db.days.toArray(), exercises: await db.exercises.toArray(),
      prescriptions: await db.prescriptions.toArray(), setLogs: await db.setLogs.toArray(),
      workoutSessions: await db.workoutSessions.toArray(), sessionSets: await db.sessionSets.toArray(),
      settings: await db.settings.toArray()
    }
  }
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `GymSheet-Web-backup-${new Date().toISOString().slice(0, 10)}.gsw`)
  await setSetting('lastBackupAt', Date.now())
  await setSetting('workoutsSinceBackup', 0)
}

export async function restoreWebBackup(file: File): Promise<void> {
  const backup = JSON.parse(await file.text()) as GymSheetBackupV1
  if (backup.format !== 'gymsheet-web-backup' || backup.version !== 1 || !backup.payload) throw new Error('Backup GymSheet Web non valido.')
  await db.transaction('rw', db.sheets, db.days, db.exercises, db.prescriptions, db.setLogs, db.workoutSessions, db.sessionSets, db.settings, async () => {
    await Promise.all([db.sheets.clear(), db.days.clear(), db.exercises.clear(), db.prescriptions.clear(), db.setLogs.clear(), db.workoutSessions.clear(), db.sessionSets.clear(), db.settings.clear()])
    await db.sheets.bulkPut(backup.payload.sheets)
    await db.days.bulkPut(backup.payload.days)
    await db.exercises.bulkPut(backup.payload.exercises)
    await db.prescriptions.bulkPut(backup.payload.prescriptions)
    await db.setLogs.bulkPut(backup.payload.setLogs)
    await db.workoutSessions.bulkPut(backup.payload.workoutSessions)
    await db.sessionSets.bulkPut(backup.payload.sessionSets)
    await db.settings.bulkPut(backup.payload.settings)
  })
}
