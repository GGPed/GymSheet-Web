import {InlineSetEditor} from './InlineSetEditor'
import {activeExerciseTimer,startExerciseTimer,stopExerciseTimer} from '../exerciseTimer'
import {useEffect,useState} from 'react'
import {useLiveQuery} from 'dexie-react-hooks'
import {db,setSetting,updateSetLog,assertWorkoutUnlocked} from '../db'
import type {SetLog} from '../types'
import type {SupersetPart} from '../superset'
import {formatDuration} from '../utils'
interface PartValue {endAt?:number;done?:boolean;reps?:string;weight?:string;weightEdited?:boolean}
export function SupersetSet({exerciseId,week,setNumber,parts,log,enabled,onComplete,editable=false,dayClosed=false,completionLabel='Completa superset',canPrepareLoad=false}:{exerciseId:string;week:number;setNumber:number;parts:SupersetPart[];log?:SetLog;enabled:boolean;onComplete:()=>Promise<void>;editable?:boolean;dayClosed?:boolean;completionLabel?:string;canPrepareLoad?:boolean}) {
  const key=`superset:${exerciseId}:${week}:${setNumber}`
  const saved=useLiveQuery(()=>db.settings.get(key),[key])
  const values=(saved?.value??{}) as Record<number,PartValue>
  const [now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(id)},[])
  const timer=useLiveQuery(()=>activeExerciseTimer(now),[now])
  const toggleTimer=async(index:number,seconds:number)=>{if(busy)return;setBusy(true);setError('');try{if(timer?.key===key&&timer.index===index)await stopExerciseTimer(key,index);else await startExerciseTimer(key,index,seconds)}catch(e){setError(e instanceof Error?e.message:'Timer non avviato.')}finally{setBusy(false)}}
  const edit=async(index:number,patch:PartValue)=>{try{await db.transaction('rw',db.settings,async()=>{await assertWorkoutUnlocked();const current=(await db.settings.get(key))?.value as Record<number,PartValue>??{};await setSetting(key,{...current,[index]:{...current[index],...patch,...('weight' in patch?{weightEdited:true}:{})}})})}catch(e){setError(e instanceof Error?e.message:"Serie non modificata.")}}
  const ready=parts.every((part,index)=>part.seconds?Boolean(values[index]?.endAt&&values[index].endAt!<=now):(/^\d+$/.test(values[index]?.reps??String(part.reps))&&(!values[index]?.weight||/^\d+(?:[.,]\d+)?$/.test(values[index].weight!))))
  const complete=async()=>{if(busy||log?.completed||!ready)return;setBusy(true);setError('');try{const repetitions=parts.reduce((sum,part,index)=>sum+(part.reps?Number((values[index]?.reps??String(part.reps)).replace(',','.')):0),0);const weights=parts.map((part,index)=>part.load?Number((values[index]?.weight??String(part.kg??0)).replace(',','.')):0);await updateSetLog(exerciseId,week,setNumber,{reps:String(repetitions),weight:String(Math.max(0,...weights))});await onComplete()}catch(e){setError(e instanceof Error?e.message:'Serie non salvata.')}finally{setBusy(false)}}
  return <div className={`set-row superset-set ${log?.completed?'done':''}`}><>{dayClosed&&<span className={`set-status-label ${log?.completed?"completed":"incomplete"}`}>{log?.completed?"✓ Serie completata":"Serie non completata"}</span>}</><div className="set-number">Set {setNumber}{parts.length>1?' · Superset':''}</div>{(log?.completed||dayClosed)&&!editable&&<small>Registrato: {log?.reps||"—"} ripetizioni{Number(log?.weight)>0?` · ${log?.weight} kg`:""}</small>}
    {!log?.completed&&!dayClosed&&parts.map((part,index)=>{
      const value=values[index]??{},remaining=Math.max(0,(value.endAt??0)-now),finished=Boolean(value.endAt&&remaining===0)
      return <div className="superset-part compact-part" key={index}>
        <div className="component-copy"><strong title={part.name}>{part.name.replace(/laterale/gi,"lat.").replace(/ · /g," ")}</strong>{part.seconds&&part.targetLabel&&<small className="component-prescription">{part.targetLabel}</small>}</div>
        {part.seconds?<>
          <b className="component-countdown" role="timer">{finished?'✓':value.endAt?formatDuration(remaining):formatDuration(part.seconds*1000)}</b>
          <button className="component-start" disabled={!enabled||Boolean(log?.completed)||busy||timer===undefined||Boolean(timer&&(timer.key!==key||timer.index!==index))} onClick={()=>void toggleTimer(index,part.seconds!)}>{timer?.key===key&&timer.index===index?'Interrompi':finished?'Ripeti timer':'Avvia'}</button>
        </>:<>
          <span className="component-rep-target">Target {part.targetLabel??part.reps}</span>
          <input className="component-reps" aria-label={`Ripetizioni ${part.name} · set ${setNumber}`} inputMode="numeric" value={value.reps??String(part.reps)} disabled={!enabled||Boolean(log?.completed)||busy} onChange={e=>void edit(index,{reps:e.target.value})}/>
          {part.load&&<label className="component-load">Kg<input aria-label={`Carico ${part.name} · set ${setNumber}`} inputMode="decimal" value={value.weight??(part.kg===undefined?'':String(part.kg))} disabled={(!enabled&&!canPrepareLoad)||Boolean(log?.completed)||busy} onChange={e=>void edit(index,{weight:e.target.value})}/></label>}
        </>}
      </div>
    })}
    {error&&<p className="error" role="alert">{error}</p>}<>{editable&&log?<InlineSetEditor log={log}/>:<button className="complete-set" disabled={!enabled||Boolean(log?.completed)||busy||!ready} onClick={()=>void complete()}>{log?.completed?'✓ Fatta':completionLabel}</button>}</>
  </div>
}

