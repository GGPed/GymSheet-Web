import { CFB } from 'xlsx'
import type { ParsedSheet, Exercise } from '../types'
import type { SupersetPart } from '../superset'
import { uid } from '../utils'

const clean = (s: string) => s.replace(/[\u00a0\t\v]/g, ' ').replace(/\s+/g, ' ').trim()
const decodeXml = (s: string) => s.replace(/&(?:#x([\da-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, hex, dec, name) => hex || dec ? String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)) : ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[name.toLowerCase()])

export function docxParagraphs(bytes: Uint8Array): string[] {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Il file non è un documento DOCX valido.')
  const archive = CFB.read(bytes, {type:'array'})
  const entry = CFB.find(archive, '/word/document.xml')
  if (!entry?.content) throw new Error('Il documento DOCX non contiene testo leggibile.')
  const xml = new TextDecoder().decode(Uint8Array.from(entry.content))
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Struttura XML del documento non supportata.')
  return [...xml.matchAll(/<(?:\w+:)?p\b[^>]*>([\s\S]*?)<\/(?:\w+:)?p>/g)].map(p => clean([...p[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?(?:br|tab)\b[^>]*\/?>/g)].map(t => t[1] === undefined ? ' ' : decodeXml(t[1])).join(''))).filter(Boolean)
}

// Word 97–2003 binary text: FIB → CLX → PlcPcd pieces, per Microsoft MS-DOC.
// https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-doc/
export function legacyDocParagraphs(bytes: Uint8Array): string[] {
  const magic = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]
  if (!magic.every((b,i) => bytes[i] === b)) throw new Error('Questo .doc non è un documento Word binario 97–2003. Salvalo come .docx.')
  const archive = CFB.read(bytes, {type:'array'})
  const rawStream = CFB.find(archive, '/WordDocument')?.content
  const stream = rawStream ? Uint8Array.from(rawStream as ArrayLike<number>) : undefined
  if (!stream || stream.length < 154) throw new Error('Documento .doc non leggibile.')
  const fib = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)
  if (fib.getUint16(0,true) !== 0xa5ec || fib.getUint16(2,true) < 0xc1) throw new Error('Questa versione .doc è precedente a Word 97. Salvala come .docx.')
  const flags = fib.getUint16(10,true)
  if (flags & (0x100 | 0x8000)) throw new Error('Documento .doc protetto: rimuovi la password prima di importarlo.')
  const rawTable = CFB.find(archive, flags & 0x200 ? '/1Table' : '/0Table')?.content
  const table = rawTable ? Uint8Array.from(rawTable as ArrayLike<number>) : undefined
  if (!table) throw new Error('Tabella del documento .doc mancante.')
  const csw = fib.getUint16(32,true), lw = 34 + csw*2, cslw = fib.getUint16(lw,true), pairs = lw+2+cslw*4
  if (cslw < 4 || pairs+2+34*8 > stream.length || fib.getUint16(pairs,true) < 34) throw new Error('Struttura .doc non supportata: usa .docx.')
  const textLength = fib.getUint32(lw+2+3*4,true), clx = fib.getUint32(pairs+2+33*8,true), size = fib.getUint32(pairs+6+33*8,true)
  if (!size || clx+size > table.length) throw new Error('Tabella del testo .doc non valida.')
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength)
  let offset = clx
  while (offset < clx+size && table[offset] === 1) {if(offset+3>clx+size)throw new Error('Documento .doc incompleto.');offset += 3 + view.getUint16(offset+1,true)}
  if (table[offset] !== 2 || offset+5 > clx+size) throw new Error('Tabella dei frammenti .doc non supportata.')
  const length = view.getUint32(offset+1,true), start = offset+5, count = (length-4)/12
  if (!Number.isInteger(count) || count < 1 || start+length > clx+size) throw new Error('Frammenti del documento .doc non validi.')
  const deleted: Array<[number,number]> = []
  const formatting = fib.getUint32(pairs+2+12*8,true), formattingSize = fib.getUint32(pairs+6+12*8,true)
  if (formattingSize) {
    const pages = (formattingSize-4)/8
    if (!Number.isInteger(pages) || formatting+formattingSize>table.length) throw new Error('Formattazione .doc non valida.')
    for (let i=0;i<pages;i++) {
      const page = view.getUint32(formatting+(pages+1)*4+i*4,true)*512
      if (page+512>stream.length) throw new Error('Formattazione .doc incompleta.')
      const runs = stream[page+511]
      for (let run=0;run<runs;run++) {
        const propertyOffset=stream[page+(runs+1)*4+run]*2
        if (!propertyOffset) continue
        const end=page+propertyOffset+1+stream[page+propertyOffset]
        if (end>page+511) throw new Error('Proprietà del testo .doc non valide.')
        let property=page+propertyOffset+1
        while (property+2<=end) {
          const opcode=fib.getUint16(property,true), kind=opcode>>>13
          property+=2
          let operand=[1,1,2,4,2,2,0,3][kind]
          if (kind===6) {operand=stream[property]+1;if(stream[property]===255&&property+3<=end)operand=fib.getUint16(property+1,true)+3}
          if (property+operand>end) throw new Error('Proprietà del testo .doc non supportate.')
          if (opcode===0x0800 && stream[property]&1) deleted.push([fib.getUint32(page+run*4,true),fib.getUint32(page+(run+1)*4,true)])
          property+=operand
        }
      }
    }
  }
  let text = ''
  for (let i=0;i<count;i++) {
    const cp = view.getUint32(start+i*4,true), end = Math.min(textLength,view.getUint32(start+(i+1)*4,true))
    if (end <= cp) continue
    const fc = view.getUint32(start+(count+1)*4+i*8+2,true), compressed = Boolean(fc & 0x40000000)
    const position = (fc & 0x3fffffff)/(compressed?2:1), last = position+(end-cp)*(compressed?1:2)
    if (last > stream.length) throw new Error('Testo .doc incompleto.')
    const piece=new TextDecoder(compressed?'windows-1252':'utf-16le').decode(stream.subarray(position,last))
    for (let char=0;char<piece.length;char++) {const fc=position+char*(compressed?1:2);if(!deleted.some(([a,b])=>fc>=a&&fc<b))text+=piece[char]}
  }
  return text.replace(/\x13[^\x14\x15]*(?:\x14|\x15)/g,'').replace(/[\x13\x14\x15]/g,'').split(/[\r\n\x07]/).map(clean).filter(Boolean)
}

export function parseWordParagraphs(paragraphs: string[], filename: string): ParsedSheet {
  const sheetId = uid('sheet')
  const result: ParsedSheet = {sheet:{id:sheetId,name:filename.replace(/\.docx?$/i,''),importedAt:Date.now(),active:1,source:'word',initialWeeks:1},days:[],exercises:[],prescriptions:[],warnings:[]}
  let day: ParsedSheet['days'][number] | undefined, previous: Exercise | undefined, global = false
  const globalLines: string[] = []
  for (const raw of paragraphs) {
    const line = clean(raw), heading = line.match(/^GIORNO\s*(\d+)\b/i)
    if (heading) {
      const number = Number(heading[1])
      if (number < 1 || number > 7) throw new Error('Word: sono supportati i giorni da 1 a 7 (A–G).')
      day = result.days.find(d=>d.dayIndex===number)
      if (!day) {day={id:uid('day'),sheetId,dayIndex:number,title:`Giorno ${number}`,label:String.fromCharCode(64+number),mobility:0};result.days.push(day)}
      previous=undefined;continue
    }
    if (/^RECUPERI\b/i.test(line)) {global=true;const rest=clean(line.replace(/^RECUPERI\s*:?/i,''));if(rest)globalLines.push(rest);continue}
    if (global) {if(!globalLines.includes(line))globalLines.push(line);continue}
    if (!day) {result.warnings!.push(`Testo prima dei giorni: ${line}`);continue}
    const normal = line.match(/^(.*?)\s*:?\s*(\d+)\s*[x×]\s*(\d+)(?:\s*([–—\-/])\s*(\d+))?\s*(sec(?:ondi)?\.?|s\b|''|″)?\s*(.*)$/i)
    const technique = line.match(/^(.*?)\s+serie\s*21\s*[x×]\s*(\d+)\s*$/i)
    if (!normal && !technique) {
      if (previous && !/[:]|\d\s*[x×]\s*\d/i.test(line)) previous.trainerNote=clean(`${previous.trainerNote} ${line}`)
      else result.warnings!.push(`Prescrizione non interpretata: ${line}`)
      continue
    }
    // The serie-21 technique explicitly gives three sets of 21; do not invent its phases.
    const name=clean((technique?.[1]??normal![1]).replace(/:$/,'')), sets=Number(technique?.[2]??normal![2]), low=technique?21:Number(normal![3]), high=technique?21:Number(normal![5]??normal![3]), timed=Boolean(normal?.[6]), note=technique?'Tecnica: serie 21.':clean(normal![7].replace(/^\s*[-–—]\s*/,''))
    if (!name || sets<1 || sets>12 || low<1 || high<low) {result.warnings!.push(`Prescrizione non interpretata: ${line}`);continue}
    const range=low===high?String(low):`${low}–${high}`, parts=name.split(/\s*\+\s*/).map(clean)
    if (parts.some(p=>!p)) {result.warnings!.push(`Superset non interpretato: ${line}`);continue}
    const components: SupersetPart[] = parts.map(part=>({name:part,...(timed?{seconds:high,targetLabel:`${range} secondi`}:{reps:low,repsMax:high,targetLabel:`${range}`,load:true})}))
    const exercise: Exercise = {id:uid('exercise'),dayId:day.id,order:result.exercises.filter(e=>e.dayId===day!.id).length+1,name:parts.length>1?`Superset ${parts.join(' / ')}`:name,recoverySeconds:120,recoveryLabel:'2:00',trainerNote:note,...(timed||parts.length>1?{components}:{})}
    result.exercises.push(exercise)
    result.prescriptions.push({id:uid('prescription'),exerciseId:exercise.id,weekNumber:1,program:parts.length>1?`${sets} set di ${parts.map(part=>`${part} x ${range.replace('–','/')}${timed?' secondi':''}`).join(' + ')}`:`${sets} x ${timed?range+' secondi':range.replace('–','/')}`})
    previous=exercise
  }
  const globalNote=globalLines.join('\n\n').trim().replace(/(\d)\s*([–—\-/])\s*(\d)/g,'$1$2$3')
  if(globalNote)result.sheet.coachNotes=globalNote
  result.days.sort((a,b)=>a.dayIndex-b.dayIndex)
  if (!result.days.length || !result.exercises.length) throw new Error('Nessun workout riconosciuto. Usa intestazioni GIORNO 1…7 e prescrizioni serie x ripetizioni.')
  return result
}

export async function parseWordFile(file: File): Promise<ParsedSheet> {
  const bytes=new Uint8Array(await file.arrayBuffer())
  return parseWordParagraphs(/\.docx$/i.test(file.name)?docxParagraphs(bytes):legacyDocParagraphs(bytes),file.name)
}
