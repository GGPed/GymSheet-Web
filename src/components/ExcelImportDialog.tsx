import { SwipeDialog } from './SwipeDialog'
import { useEffect, useState } from 'react'
import { excelWorksheetNames, parseExcelFile } from '../services/excel'
import { installParsedSheet } from '../db'
import type { ParsedSheet } from '../types'

export function ExcelImportDialog({file,onClose,onImported}:{file:File;onClose:()=>void;onImported:()=>void}) {
  const [names,setNames]=useState<string[]>([]),[selected,setSelected]=useState('')
  const [preview,setPreview]=useState<ParsedSheet|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{let cancelled=false;void excelWorksheetNames(file).then(items=>{if(!cancelled){setNames(items);setSelected(items[0]??'')}}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'File non leggibile.')});return()=>{cancelled=true}},[file])
  useEffect(()=>{if(!selected)return;let cancelled=false;setPreview(null);setError('');void parseExcelFile(file,selected).then(data=>{if(!cancelled)setPreview(data)}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Formato non riconosciuto.')});return()=>{cancelled=true}},[file,selected])
  const install=async()=>{if(!preview||busy)return;setBusy(true);try{await installParsedSheet(preview);onImported()}catch(e){setError(e instanceof Error?e.message:'Importazione non riuscita.');setBusy(false)}}
  return <SwipeDialog title="Importa scheda Excel" className="excel-import-dialog" onClose={()=>{if(!busy)onClose()}}>
    <p>{file.name}</p>
    {names.length>1&&<><label htmlFor="excel-worksheet">Quale scheda vuoi usare?</label><select id="excel-worksheet" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>{names.map(name=><option key={name}>{name}</option>)}</select><p className="muted">Ogni foglio viene importato come una scheda distinta. Potrai importare gli altri in seguito.</p></>}
    {preview&&<div className="excel-import-preview"><strong>{selected}</strong><p>{preview.days.filter(d=>!d.mobility).length} giorni · {preview.exercises.length} esercizi</p>{preview.days.map(day=><p key={day.id}><b>{day.mobility?day.title:String.fromCharCode(65+preview.days.filter(d=>!d.mobility).indexOf(day))}</b> · {preview.exercises.filter(ex=>ex.dayId===day.id).length} esercizi</p>)}</div>}
    {error&&<p className="error" role="alert">{error}</p>}
    {!preview&&!error&&<p role="status">Lettura della scheda…</p>}
    <button className="primary" disabled={!preview||busy} onClick={()=>void install()}>{busy?'Importazione…':'Importa questa scheda'}</button>
  </SwipeDialog>
}
