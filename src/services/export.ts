import {downloadBlob} from './download'
import { appendProgressReport } from './progressReport'
import type { Period } from '../progressEngine'
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

export async function exportHistoryExcel(sessionId?: string, share = false): Promise<void> {
  const rows = await historyRows(sessionId)
  if (!rows.length && sessionId) throw new Error('Non ci sono allenamenti da esportare.')
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
    Ripetizioni: set.reps,
    completata: set.completed ? 'Sì' : 'No'
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Allenamenti')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(setRows), 'Serie')
  if (!sessionId) {
    const [exercises, prescriptions, logs, notes, days, sheets] = await Promise.all([db.exercises.toArray(),db.prescriptions.toArray(),db.setLogs.toArray(),db.settings.toArray(),db.days.toArray(),db.sheets.toArray()])
    const context = (exerciseId:string) => { const exercise=exercises.find(e=>e.id===exerciseId);const day=days.find(d=>d.id===exercise?.dayId);return {scheda:sheets.find(s=>s.id===day?.sheetId)?.name??'',giorno:day?.title??'',esercizio:exercise?.name??''} }
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(prescriptions.map(p=>({...context(p.exerciseId),settimana:p.weekNumber,programma:p.program}))),'Programmazione')
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(logs.map(l=>({...context(l.exerciseId),settimana:l.weekNumber,serie:l.setNumber,kg:l.weight,Ripetizioni:l.reps,completata:l.completed?'Sì':'No'}))),'Registrazioni')
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(notes.filter(n=>n.key.startsWith('exerciseNote:')).map(n=>{const [,id,week]=n.key.split(':');const value=n.value as {weight?:string;note?:string};return {...context(id),settimana:Number(week),carico:value.weight??'',nota:value.note??''}})),'Note')
  }
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const title = sessionId ? `${summary[0].giorno}-${summary[0].data}` : 'Storico-completo'
  const blob=new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const filename=`GymSheet-${safeName(title)}.xlsx`
  if (share) {
    const file=new File([blob],filename,{type:blob.type})
    if(navigator.canShare?.({files:[file]})) {try {await navigator.share({files:[file],title:'GymSheet'})} catch(error){if(!(error instanceof DOMException && error.name==='AbortError')) throw error} return}
  }
  downloadBlob(blob,filename)
}

export async function exportHistoryPdf(sessionId?: string,period:Period='all'): Promise<void> {
  const rows = await historyRows(sessionId)
  if (!rows.length && sessionId) throw new Error('Non ci sono allenamenti da esportare.')
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
      const line = `${status} ${set.exerciseName} · serie ${set.setNumber} · ${set.weight || '—'} kg · ${set.reps || '—'} Ripetizioni`
      const wrapped = pdf.splitTextToSize(line, 178) as string[]
      pdf.text(wrapped, margin + 2, y)
      y += wrapped.length * 4.2
    }
    y += 5
  })
  if(!sessionId) {
    const [exercises,days,sheets,prescriptions,logs,settings]=await Promise.all([db.exercises.toArray(),db.days.toArray(),db.sheets.toArray(),db.prescriptions.toArray(),db.setLogs.toArray(),db.settings.toArray()])
    ensure(10);pdf.setFontSize(12);pdf.text('Schede e settimane complete',margin,y);y+=8
    for(const exercise of exercises) {
      const day=days.find(d=>d.id===exercise.dayId),sheet=sheets.find(s=>s.id===day?.sheetId)
      const text=[`${sheet?.name??''} / ${day?.title??''} / ${exercise.name}`]
      for(const p of prescriptions.filter(p=>p.exerciseId===exercise.id).sort((a,b)=>a.weekNumber-b.weekNumber)) {
        text.push(`Settimana ${p.weekNumber}: ${p.program}`)
        for(const log of logs.filter(l=>l.exerciseId===exercise.id&&l.weekNumber===p.weekNumber)) text.push(`Serie ${log.setNumber}: ${log.weight||'-'} kg x ${log.reps||'-'} ${log.completed?'completata':''}`)
        const note=settings.find(n=>n.key===`exerciseNote:${exercise.id}:${p.weekNumber}`)?.value as {weight?:string;note?:string}|undefined
        if(note?.weight)text.push(`Carico annotato: ${note.weight}`)
        if(note?.note)text.push(`Nota: ${note.note}`)
      }
      pdf.setFontSize(9)
      for(const line of text) for(const wrapped of pdf.splitTextToSize(line,178) as string[]){ensure(5);pdf.text(wrapped,margin,y);y+=5}
      y+=5
    }
  }
  const first = rows[0] ? sessionSummary(rows[0]) : {giorno:'GymSheet',data:''}
  if(!sessionId){const sheet=await db.sheets.filter(s=>s.active===1).first();if(sheet)await appendProgressReport(pdf,sheet.id,period)}
  pdf.save(sessionId ? `GymSheet-${safeName(`${first.giorno}-${first.data}`)}.pdf` : 'GymSheet-Storico-completo.pdf')
}
