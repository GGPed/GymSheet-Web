import {useState} from 'react'
import {saveRegisteredSet} from '../db'
import type {SetLog} from '../types'
import {SwipeDialog} from './SwipeDialog'
import {WorkoutControls} from './RecoveryWorkoutLock'
export function EditCompletedSet({log,onClose}:{log:SetLog;onClose:()=>void}){
  const [weight,setWeight]=useState(log.weight),[reps,setReps]=useState(log.reps),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const valid=/^\d+(?:[.,]\d+)?$/.test(weight)&&/^\d+$/.test(reps)
  const save=async()=>{
    if(busy||!valid)return;setBusy(true);setError('')
    try{await saveRegisteredSet(log,weight,reps);onClose()}catch(e){setError(e instanceof Error?e.message:'Modifiche non salvate.')}finally{setBusy(false)}
  }
  return <SwipeDialog title={`Modifica serie ${log.setNumber}`} onClose={onClose}><WorkoutControls><div className="completed-set-fields"><label>Kg<input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)}/></label><label>Ripetizioni<input inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)}/></label></div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={!valid||busy} onClick={()=>void save()}>Salva modifiche</button></WorkoutControls></SwipeDialog>
}
export function EditSetButton({onClick}:{onClick:()=>void}){return <button className="edit-set-button" aria-label="Modifica serie" onClick={onClick}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5"/></svg></button>}
