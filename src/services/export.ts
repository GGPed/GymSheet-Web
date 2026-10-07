import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { db } from '../db'
import type { SessionSet, Sheet, WorkoutDay, WorkoutSession } from '../types'
import { formatDuration, toNumber } from '../utils'

type HistoryRow = {
  session: WorkoutSession
  day?: WorkoutDay
  sheet?: Sheet
  sets: SessionSet[]
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'GymSheet'
}

async function historyRows(sessionId?: string): Promise<HistoryRow[]> {
  const [sessions, days, sheets] = await Promise.all([
    sessionId ? db.workoutSessions.where('id').equals(sessionId).toArray() : db.workoutSessions.filter((s) => !s.active && s.endedAt > 0).toArray(),
    db.days.toArray(),
    db.sheets.toArray()
  ])
  const rows: HistoryRow[] = []
  for (const session of sessions.filter((s) => !s.active && s.endedAt > 0).sort((a, b) => b.endedAt - a.endedAt)) {
    rows.push({
      session,
      day: days.find((d) => d.id === session.dayId),
      sheet: sheets.find((s) => s.id === session.sheetId),
      sets: await db.sessionSets.where('sessionId').equals(session.id).sortBy('setNumber')
    })
  }
  return rows
}

function sessionSummary(row: HistoryRow) {
  const completed = row.sets.filter((set) => set.completed)
  const volume = completed.reduce((sum, set) => sum + toNumber(set.weight) * toNumber(set.reps), 0)
  return {
    data: new Date(row.session.endedAt).toLocaleDateString('it-IT'),
    scheda: row.sheet?.name ?? 'GymSheet',
    giorno: row.day?.title ?? 'Allenamento',
    settimana: row.session.weekNumber,
    durata: formatDuration(Math.max(0, row.session.endedAt - row.session.startedAt)),
    chiusura: row.session.completionMode === 'early' ? 'Anticipata' : 'Completa',
    serie: completed.length,
    volume: Math.round(volume)
  }
}

export async function exportHistoryExcel(sessionId?: string): Promise<void> {
  const rows = await historyRows(sessionId)
  if (!rows.length) throw new Error('Non ci sono allenamenti da esportare.')
  const summary = rows.map(sessionSummary)
  const setRows = rows.flatMap((row) => row.sets.map((set) => ({
    data: new Date(row.session.endedAt).toLocaleDateString('it-IT'),
    scheda: row.sheet?.name ?? 'GymSheet',
    giorno: row.day?.title ?? 'Allenamento',
    settimana: row.session.weekNumber,
    esercizio: set.exerciseName,
    serie: set.setNumber,
    target: set.prescribed,
    kg: set.weight,
    reps: set.reps,
    completata: set.completed ? 'Sì' : 'No'
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Allenamenti')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(setRows), 'Serie')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const title = sessionId ? `${summary[0].giorno}-${summary[0].data}` : 'Storico-completo'
  downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `GymSheet-${safeName(title)}.xlsx`)
}

export async function exportHistoryPdf(sessionId?: string): Promise<void> {
  const rows = await historyRows(sessionId)
  if (!rows.length) throw new Error('Non ci sono allenamenti da esportare.')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18
  const lineHeight = 5
  const pageBottom = 282
  const ensure = (height = lineHeight) => {
    if (y + height > pageBottom) { pdf.addPage(); y = 18 }
  }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('GymSheet', margin, y); y += 8
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(sessionId ? 'Riepilogo allenamento' : 'Storico allenamenti', margin, y); y += 8

  rows.forEach((row) => {
    const summary = sessionSummary(row)
    ensure(28)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text(`${summary.giorno} · Settimana ${summary.settimana}`, margin, y); y += 5
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5)
    pdf.text(`${summary.data}  ·  ${summary.durata}  ·  ${summary.serie} serie  ·  ${summary.volume.toLocaleString('it-IT')} kg volume`, margin, y); y += 6
    for (const set of row.sets) {
      ensure(8)
      const status = set.completed ? '✓' : '–'
      const line = `${status} ${set.exerciseName} · serie ${set.setNumber} · ${set.weight || '—'} kg · ${set.reps || '—'} reps`
      const wrapped = pdf.splitTextToSize(line, 178) as string[]
      pdf.text(wrapped, margin + 2, y)
      y += wrapped.length * 4.2
    }
    y += 5
  })
  const first = sessionSummary(rows[0])
  pdf.save(sessionId ? `GymSheet-${safeName(`${first.giorno}-${first.data}`)}.pdf` : 'GymSheet-Storico-completo.pdf')
}
