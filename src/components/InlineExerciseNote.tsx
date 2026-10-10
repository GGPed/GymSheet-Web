import {useEffect,useState} from 'react'
import {db,setSetting} from '../db'
import {WorkoutControls} from './RecoveryWorkoutLock'

export function InlineExerciseNote({exerciseId,week,onSaved}:{exerciseId:string;week:number;onSaved:()=>void}){
  const key=`exerciseNote:${exerciseId}:${week}`
  const [note,setNote]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{let live=true;void db.settings.get(key).then(value=>{if(live){setNote((value?.value as {note?:string})?.note??'');setReady(true)}}).catch(()=>{if(live)setError('Nota non caricata.')});return()=>{live=false}},[key])
  const save=async()=>{if(!ready||busy)return;setBusy(true);setError('');try{const current=(await db.settings.get(key))?.value as object|undefined;await setSetting(key,{...current,note,updatedAt:Date.now()});onSaved()}catch{setError('Nota non salvata. Riprova.')}finally{setBusy(false)}}
  return <WorkoutControls className="inline-note"><label>Nota allenamento<textarea aria-label="Nota allenamento" value={note} disabled={!ready||busy} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="secondary" disabled={!ready||busy} onClick={()=>void save()}>Salva nota</button></WorkoutControls>
}
