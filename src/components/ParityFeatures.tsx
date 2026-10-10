import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { activateSheet, db, setSetting } from '../db'
import type { Exercise } from '../types'
import { imagesForExercise } from '../services/images'
import { SwipeDialog } from './SwipeDialog'
import { WorkoutControls } from './RecoveryWorkoutLock'
import { toNumber } from '../utils'

export function SheetArchive({ onClose, onError }: {onClose:()=>void;onError:(error:unknown)=>void}) {
  const sheets=useLiveQuery(()=>db.sheets.orderBy('importedAt').reverse().toArray())??[]
  const date=(value:number)=>new Date(value).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'})
  return <div className="archive-list">{sheets.map(sheet=><button className="menu-row" key={sheet.id} onClick={()=>{if(sheet.active)return;if(confirm(`Aprire la scheda “${sheet.name}”? I dati di tutte le schede restano salvati.`))void activateSheet(sheet.id).then(onClose).catch(onError)}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={sheet.active?'M5 12l4 4L19 6':'M4 3h11l5 5v13H4zM15 3v6h5'}/></svg><span>{sheet.name}<small>{date(sheet.importedAt)} - {sheet.active?'In corso':sheet.archivedAt?date(sheet.archivedAt):'Data fine non registrata'}</small></span></button>)}</div>
}

export function ExerciseDetails({exercise,week,program,onClose}:{exercise:Exercise;week:number;program:string;onClose:()=>void}) {
  const [view,setView]=useState<'history'|'chart'>('history')
  const logs=useLiveQuery(()=>db.setLogs.where('exerciseId').equals(exercise.id).toArray(),[exercise.id])??[]
  const notes=useLiveQuery(()=>db.settings.filter(s=>s.key.startsWith(`exerciseNote:${exercise.id}:`)).toArray(),[exercise.id])??[]
  const prescriptions=useLiveQuery(()=>db.prescriptions.where('exerciseId').equals(exercise.id).toArray(),[exercise.id])??[]
  const weeks=[...new Set([...prescriptions.map(p=>p.weekNumber),...logs.map(l=>l.weekNumber),...notes.map(n=>Number(n.key.split(':').at(-1)))])].sort((a,b)=>a-b)
  const points=Array.from({length:10},(_,i)=>{const w=i+1,values=logs.filter(l=>l.weekNumber===w&&l.weight.trim()).map(l=>toNumber(l.weight));return {week:w,kg:values.length?Math.max(...values):null}})
  const max=Math.max(1,...points.map(p=>p.kg??0))
  return <SwipeDialog title={exercise.name} onClose={onClose} className="exercise-details">
    <div className="history-tabs"><button className={view==='history'?'selected':''} onClick={()=>setView('history')}>Storico</button><button className={view==='chart'?'selected':''} onClick={()=>setView('chart')}>Grafico</button></div>
    <p><strong>Settimana {week} · {program||'Nessuna prescrizione'}</strong></p>


    <h3>{view==='history'?'Storico per settimana':'Miglior carico per settimana'}</h3>
    {!weeks.length?<p>Nessun dato registrato.</p>:<>
      {view==='chart'&&points.some(p=>p.kg!==null)&&<svg viewBox="0 0 320 130" role="img" aria-label="Carico massimo sulle dieci settimane; nessuna linea nelle settimane senza dati"><path d="M25 10V105H305" fill="none" stroke="currentColor" opacity=".3"/>{points.map((p,i)=><g key={p.week}>{p.kg!==null&&<>{i>0&&points[i-1].kg!==null&&<line x1={30+(i-1)*30} y1={100-(points[i-1].kg??0)/max*80} x2={30+i*30} y2={100-p.kg/max*80} stroke="var(--accent)" strokeWidth="3"/>}<circle cx={30+i*30} cy={100-p.kg/max*80} r="4" fill="var(--accent)"/><title>Settimana {p.week}: {p.kg} kg</title></>}<text x={30+i*30} y="123" textAnchor="middle" fontSize="10" fill="currentColor">{p.week}</text></g>)}</svg>}
      {view==='chart'&&<p className="muted">Settimane 1–10 · i vuoti indicano settimane senza carichi registrati.</p>}
      {view==='history'&&weeks.map(w=>{const legacy=notes.find(n=>n.key===`exerciseNote:${exercise.id}:${w}`)?.value as {weight?:string;note?:string}|undefined;return <section className="exercise-week" key={w}><h4>Settimana {w}</h4><p>{prescriptions.find(p=>p.weekNumber===w)?.program}</p>{logs.filter(l=>l.weekNumber===w).sort((a,b)=>a.setNumber-b.setNumber).map(l=><p key={l.id}>Serie {l.setNumber}: {l.weight||'—'} kg · {l.reps||'—'} Ripetizioni {l.completed?'✓':''}</p>)}{legacy?.weight&&<p>Carico annotato: {legacy.weight}</p>}{legacy?.note&&<p>Nota: {legacy.note}</p>}</section>})}
    </>}
  </SwipeDialog>
}

export function ExerciseImagePopup({exercise,program,onClose}:{exercise:Exercise;program:string;onClose:()=>void}) {
  const images=imagesForExercise(exercise.name,program,exercise.trainerNote)
  const [selected,setSelected]=useState(0)
  return <SwipeDialog title={exercise.name} onClose={onClose}><img className="detail-image" src={images[selected]??images[0]} alt={exercise.name}/>{images.length>1&&<div className="exercise-photo-options">{images.map((image,index)=><button key={image} aria-label={`Foto ${index+1} di ${exercise.name}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}><img src={image} alt=""/></button>)}</div>}<p className="image-prescription">{program}</p><p>Immagine di riferimento dell’esercizio</p></SwipeDialog>
}
export function ExerciseNotePopup({exercise,week,onClose}:{exercise:Exercise;week:number;onClose:()=>void}) {
  const key=`exerciseNote:${exercise.id}:${week}`
  const [note,setNote]=useState(''),[error,setError]=useState('')
  useEffect(()=>{void db.settings.get(key).then(value=>setNote((value?.value as {note?:string})?.note??''))},[key])
  const save=async()=>{try{const existing=(await db.settings.get(key))?.value as object|undefined;await setSetting(key,{...existing,note,updatedAt:Date.now()});onClose()}catch{setError('Nota non salvata. Riprova.')}}
  return <SwipeDialog title={`Nota · ${exercise.name}`} onClose={onClose}><WorkoutControls><label className="exercise-note">Settimana {week}<textarea autoFocus value={note} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="primary" onClick={()=>void save()}>Salva</button></WorkoutControls></SwipeDialog>
}
