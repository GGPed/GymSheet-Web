import * as XLSX from 'xlsx'
import type { ParsedSheet, Prescription } from '../types'
import { parseRecoverySeconds, uid } from '../utils'

const clean = (value: unknown) => String(value ?? '').trim()
const upper = (value: unknown) => clean(value).toUpperCase()

function mobilityParts(value: string): { name: string; program: string } {
  const match = value.trim().match(/^(.*?)\s+(\d+\s*x\s*\d+(?:\s*\/\s*\d+)?)\s*$/i)
  if (!match) return { name: value.trim(), program: '' }
  return { name: match[1].trim(), program: match[2].replace(/\s+/g, ' ') }
}

export async function excelWorksheetNames(file: File): Promise<string[]> {
  return XLSX.read(await file.arrayBuffer(), { type: 'array' }).SheetNames
}

export async function parseExcelFile(file: File, worksheetName?: string): Promise<ParsedSheet> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const selectedName = worksheetName ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[selectedName]
  if (!worksheet) throw new Error('Il file Excel non contiene fogli leggibili.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: false })

  const abdominalVariants = rows
    .map((row) => ({ key: upper(row[12]), value: clean(row[13]) }))
    .filter((item) => /^ADDOME\s*\d+/.test(item.key) && item.value)
    .sort((a, b) => Number(a.key.match(/\d+/)?.[0] ?? 0) - Number(b.key.match(/\d+/)?.[0] ?? 0))

  const headers = rows
    .map((row, index) => ({ index, first: upper(row[0]) }))
    .filter((row) => row.first.startsWith('FULL BODY'))
    .map((row) => row.index)
  if (!headers.length) return parseTabular(rows, file.name)

  const sheetId = uid('sheet')
  const sheetName = file.name.replace(/\.(xlsx|xls)$/i, '') || 'Scheda GymSheet'
  const parsed: ParsedSheet = {
    sheet: { id: sheetId, name: sheetName, importedAt: Date.now(), active: 1, source: 'excel' },
    days: [], exercises: [], prescriptions: []
  }

  if(headers.length>7)throw new Error('La scheda può contenere al massimo 7 workout (A–G).')
  headers.forEach((headerRowIndex, blockIndex) => {
    const header = rows[headerRowIndex] ?? []
    const nextHeader = headers[blockIndex + 1] ?? rows.length
    const mobilityHeader = rows.findIndex((row, index) => index > headerRowIndex && index < nextHeader && upper(row[0]).startsWith('ESERCIZI DI MOBILIT'))
    const end = mobilityHeader >= 0 ? mobilityHeader : nextHeader
    const dayId = uid('day')
    parsed.days.push({ id: dayId, sheetId, dayIndex: blockIndex + 1, title: `Giorno ${blockIndex + 1}`, mobility: 0 })

    // Android normalizes malformed/duplicate WEEK labels by physical column order.
    const rawWeeks = header.map((cell, column) => ({ column, week: Number(upper(cell).match(/^WEEK\s*(\d+)/)?.[1] ?? 0) })).filter((item) => item.week > 0)
    const malformed = rawWeeks.some((item, index) => index > 0 && item.week <= rawWeeks[index - 1].week)
    const weekColumns = malformed ? rawWeeks.map((item, index) => ({ column: item.column, week: index + 1 })) : rawWeeks
    parsed.sheet.initialWeeks = Math.max(parsed.sheet.initialWeeks ?? 1, ...weekColumns.map(w=>w.week))
    const noteColumn = header.findIndex((cell) => upper(cell) === 'NOTE')
    let exerciseOrder = 0
    let previousExerciseId = ''

    for (let rowIndex = headerRowIndex + 1; rowIndex < end; rowIndex++) {
      const row = rows[rowIndex] ?? []
      const name = clean(row[0])
      if (!name) {
        if(previousExerciseId)for(const {column,week} of weekColumns){if(!/^\+\s*kg$/i.test(clean(row[column])))continue;const item=parsed.prescriptions.find(p=>p.exerciseId===previousExerciseId&&p.weekNumber===week);if(item&&!/\+\s*kg/i.test(item.program))item.program+=' +KG'}
        continue
      }
      if (upper(name).startsWith('FULL BODY')) continue
      exerciseOrder += 1
      const exerciseId = uid('exercise')
      previousExerciseId = exerciseId
      const isAbs = /^ADDOME$/i.test(name)
      const absProgram = isAbs ? (abdominalVariants[blockIndex]?.value ?? '') : ''
      parsed.exercises.push({
        id: exerciseId, dayId, order: exerciseOrder, name: name.trim(),
        recoveryLabel: clean(row[1]), recoverySeconds: parseRecoverySeconds(clean(row[1])),
        trainerNote: absProgram || clean(row[noteColumn >= 0 ? noteColumn : 9])
      })
      for (const { column, week } of weekColumns) {
        const program = absProgram || clean(row[column])
        if (!program) continue
        parsed.prescriptions.push({ id: `${exerciseId}:${week}`, exerciseId, weekNumber: week, program })
      }
      if (isAbs && !weekColumns.length) {
        for (let week = 1; week <= 6; week++) parsed.prescriptions.push({ id: `${exerciseId}:${week}`, exerciseId, weekNumber: week, program: absProgram })
      }
    }
  })

  const mobilityStart = rows.findIndex((row) => upper(row[0]).startsWith('ESERCIZI DI MOBILIT'))
  if (mobilityStart >= 0) {
    const maxWeek = Math.max(1, ...parsed.prescriptions.map((p) => p.weekNumber))
    const dayId = uid('day')
    parsed.days.push({ id: dayId, sheetId, dayIndex: parsed.days.length + 1, title: 'Mobilità', mobility: 1 })
    let order = 0
    for (let rowIndex = mobilityStart + 1; rowIndex < rows.length; rowIndex++) {
      const value = clean(rows[rowIndex]?.[0])
      if (!value) continue
      const { name, program } = mobilityParts(value)
      if (!name) continue
      order += 1
      const exerciseId = uid('exercise')
      parsed.exercises.push({ id: exerciseId, dayId, order, name, recoveryLabel: '', recoverySeconds: 0, trainerNote: '' })
      if (program) {
        for (let week = 1; week <= maxWeek; week++) {
          parsed.prescriptions.push({ id: `${exerciseId}:${week}`, exerciseId, weekNumber: week, program } satisfies Prescription)
        }
      }
    }
  }

  if (!parsed.exercises.length) throw new Error('Nessun esercizio trovato nel file.')
  return parsed
}

function parseTabular(rows: unknown[][], filename: string): ParsedSheet {
  const headerIndex=rows.findIndex(row=>row.some(cell=>/^(ESERCIZIO|EXERCISE)$/i.test(clean(cell))))
  if(headerIndex<0) throw new Error('Formato non riconosciuto: usa blocchi FULL BODY oppure una tabella con Giorno ed Esercizio.')
  const header=rows[headerIndex].map(upper)
  const column=(aliases:string[])=>header.findIndex(value=>aliases.includes(value))
  const exerciseColumn=column(['ESERCIZIO','EXERCISE']),dayColumn=column(['GIORNO','DAY','N'])
  const recoveryColumn=column(['REC','RECUPERO','RECOVERY']),noteColumn=column(['NOTE','NOTA','NOTE COACH'])
  const weekColumn=column(['SETTIMANA','WEEK']),programColumn=column(['PROGRAMMA','PROGRAMMAZIONE','SERIE X RIPETIZIONI','TARGET','SVOLGIMENTO'])
  const setsColumn=column(['SERIE','SETS']),repsColumn=column(['RIPETIZIONI','REPS'])
  const sheetId=uid('sheet'),parsed:ParsedSheet={sheet:{id:sheetId,name:filename.replace(/\.(xlsx|xls)$/i,''),importedAt:Date.now(),active:1,source:'excel',initialWeeks:10},days:[],exercises:[],prescriptions:[]}
  const weekColumns=header.map((cell,column)=>({column,week:Number(cell.match(/^WEEK\s*(\d+)/)?.[1]??0)})).filter(w=>w.week>0)
  let currentDay = 'Giorno 1'
  for(const row of rows.slice(headerIndex+1)) {
    if (dayColumn >= 0 && clean(row[dayColumn])) currentDay = clean(row[dayColumn])
    const name=clean(row[exerciseColumn]);if(!name)continue
    const title=currentDay
    let day=parsed.days.find(d=>d.title===title)
    if(!day){if(!/mobilit/i.test(title)&&parsed.days.filter(d=>!d.mobility).length>=7)throw new Error('La scheda può contenere al massimo 7 workout (A–G).');day={id:uid('day'),sheetId,dayIndex:parsed.days.length+1,title,mobility:/mobilit/i.test(title)?1:0};parsed.days.push(day)}
    let exercise=parsed.exercises.find(e=>e.dayId===day!.id&&e.name===name)
    if(!exercise){
      const trainerNote=clean(row[noteColumn])
      exercise={id:uid('exercise'),dayId:day.id,order:parsed.exercises.filter(e=>e.dayId===day!.id).length+1,name,recoveryLabel:clean(row[recoveryColumn]),recoverySeconds:parseRecoverySeconds(clean(row[recoveryColumn])),trainerNote};parsed.exercises.push(exercise)
    }
    const add=(week:number,program:string)=>{const id=`${exercise!.id}:${week}`;const existing=parsed.prescriptions.find(p=>p.id===id);if(existing&&existing.program!==program)throw new Error(`Due programmi diversi per ${name}, settimana ${week}.`);if(program&&!existing)parsed.prescriptions.push({id,exerciseId:exercise!.id,weekNumber:week,program})}
    if(weekColumns.length)for(const w of weekColumns)add(w.week,clean(row[w.column]))
    else {
      const program=clean(row[programColumn])||(clean(row[setsColumn])&&clean(row[repsColumn])?`${clean(row[setsColumn])} x ${clean(row[repsColumn])}`:'')
      const inlineWeeks=[...program.matchAll(/\bw(?:eek)?\s*(\d+)\s*[:=-]?\s*/gi)]
      if(inlineWeeks.length>1) for(let i=0;i<inlineWeeks.length;i++) {
        const match=inlineWeeks[i], start=match.index!+match[0].length, end=inlineWeeks[i+1]?.index??program.length
        add(Number(match[1]),program.slice(start,end).replace(/[\s;)]+$/g,'').trim())
      }
      else add(Math.max(1,Number(row[weekColumn])||1),program)
    }
  }
  if(!parsed.exercises.length)throw new Error('Nessun esercizio trovato nella tabella.')
  return parsed
}
