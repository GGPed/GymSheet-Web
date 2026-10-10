import {useState} from 'react'
import {saveRegisteredSet} from '../db'
import type {SetLog} from '../types'
import {EditSetButton} from './EditCompletedSet'

export function InlineSetEditor({log}:{log:SetLog}) {
  const [editing,setEditing]=useState(false),[weight,setWeight]=useState(log.weight),[reps,setReps]=useState(log.reps),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const valid=/^\d+(?:[.,]\d+)?$/.test(weight)&&/^\d+$/.test(reps)
  const save=async()=>{if(busy||!valid)return;setBusy(true);setError('');try{await saveRegisteredSet(log,weight,reps);setEditing(false)}catch(e){setError(e instanceof Error?e.message:'Modifiche non salvate.')}finally{setBusy(false)}}
  return <>
    <label className="input-with-previous"><span>Carico</span>{editing?<input aria-label={`Carico serie ${log.setNumber}`} inputMode="decimal" value={weight} disabled={busy} onChange={e=>setWeight(e.target.value)}/>:<output className="saved-set-value">{log.weight?`${log.weight} kg`:'—'}</output>}</label>
    <label className="input-with-previous"><span>Ripetizioni</span>{editing?<input aria-label={`Ripetizioni serie ${log.setNumber}`} inputMode="numeric" value={reps} disabled={busy} onChange={e=>setReps(e.target.value)}/>:<output className="saved-set-value">{log.reps||'—'}</output>}</label>
    {editing?<button className="complete-set inline-save" disabled={!valid||busy} onClick={()=>void save()}>Salva modifiche</button>:<EditSetButton onClick={()=>{setWeight(log.weight);setReps(log.reps);setError('');setEditing(true)}}/>}
    {error&&<p className="error inline-edit-error" role="alert">{error}</p>}
  </>
}
