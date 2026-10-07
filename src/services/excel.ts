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

export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
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
  if (!headers.length) throw new Error('Formato non riconosciuto: manca un blocco FULL BODY.')

  const sheetId = uid('sheet')
  const sheetName = file.name.replace(/\.(xlsx|xls)$/i, '') || 'Scheda GymSheet'
  const parsed: ParsedSheet = {
    sheet: { id: sheetId, name: sheetName, importedAt: Date.now(), active: 1, source: 'excel' },
    days: [], exercises: [], prescriptions: []
  }

  headers.forEach((headerRowIndex, blockIndex) => {
    const header = rows[headerRowIndex] ?? []
    const nextHeader = headers[blockIndex + 1] ?? rows.length
    const mobilityHeader = rows.findIndex((row, index) => index > headerRowIndex && index < nextHeader && upper(row[0]).startsWith('ESERCIZI DI MOBILIT'))
    const end = mobilityHeader >= 0 ? mobilityHeader : nextHeader
    const dayId = uid('day')
    parsed.days.push({ id: dayId, sheetId, dayIndex: blockIndex + 1, title: `Giorno ${blockIndex + 1}`, mobility: 0 })

    // Normalize duplicated/misaligned WEEK headers conservatively: the first column for a
    // given week wins. Real-world sheets can contain a duplicated WEEK 6 header.
    const weekColumns = Array.from(
      header
        .map((cell, column) => ({ column, week: Number(upper(cell).match(/^WEEK\s*(\d+)/)?.[1] ?? 0) }))
        .filter((item) => item.week > 0)
        .reduce((map, item) => {
          if (!map.has(item.week)) map.set(item.week, item)
          return map
        }, new Map<number, { column: number; week: number }>())
        .values()
    ).sort((a, b) => a.week - b.week)
    const noteColumn = header.findIndex((cell) => upper(cell) === 'NOTE')
    let exerciseOrder = 0

    for (let rowIndex = headerRowIndex + 1; rowIndex < end; rowIndex++) {
      const row = rows[rowIndex] ?? []
      const name = clean(row[0])
      if (!name || upper(name).startsWith('FULL BODY')) continue
      exerciseOrder += 1
      const exerciseId = uid('exercise')
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
