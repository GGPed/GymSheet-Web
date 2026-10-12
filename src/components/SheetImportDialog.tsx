import { useEffect, useState } from 'react'
import { ExcelImportDialog } from './ExcelImportDialog'
import { SwipeDialog } from './SwipeDialog'
import { parseWordFile } from '../services/word'
import { installParsedSheet } from '../db'
import type { ParsedSheet } from '../types'

type Props = {file: File; onClose:()=>void; onImported:()=>void}
export function SheetImportDialog(props: Props) {
  return /\.docx?$/i.test(props.file.name)?<WordImportDialog {...props}/>:<ExcelImportDialog {...props}/>
}
function WordImportDialog({file,onClose,onImported}: Props) {
  const [preview,setPreview]=useState<ParsedSheet|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{let cancelled=false;setPreview(null);setError('');void parseWordFile(file).then(data=>{if(!cancelled)setPreview(data)}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Documento non leggibile.')});return()=>{cancelled=true}},[file])
  const install=async()=>{if(!preview||busy)return;setBusy(true);try{await installParsedSheet(preview);onImported()}catch(e){setError(e instanceof Error?e.message:'Importazione non riuscita.');setBusy(false)}}
  return <SwipeDialog title="Importa scheda Word" onClose={()=>{if(!busy)onClose()}}>
    <p>{file.name}</p>
    {preview&&<div className="excel-import-preview"><strong>{preview.sheet.name}</strong><p>{preview.days.length} workout · {preview.exercises.length} esercizi</p>{preview.days.map(day=><p key={day.id}><b>{day.label}</b> · {preview.exercises.filter(e=>e.dayId===day.id).length} esercizi</p>)}<p className="muted">Recupero 2:00 per tutte le serie. Una settimana iniziale, estendibile con +.</p>{Boolean(preview.warnings?.length)&&<div role="status"><strong>Righe da verificare</strong>{preview.warnings!.map((warning,i)=><p key={i}>{warning}</p>)}</div>}</div>}
    {!preview&&!error&&<p role="status">Lettura della scheda…</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    <button className="primary" disabled={!preview||busy} onClick={()=>void install()}>{busy?'Importazione…':'Importa questa scheda'}</button>
  </SwipeDialog>
}
