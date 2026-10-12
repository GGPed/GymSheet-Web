import type { Exercise, Prescription, SessionSet, SetLog, WorkoutDay, WorkoutSession } from './types'
import { effectivePrescription } from './training'
import { setCountForProgram, toNumber } from './utils'

export type Period = 4 | 8 | 'all'
export type LoadState = 'up'|'same'|'down'|'neutral'
export type RepState = 'star'|'green'|'gray'|'orange'|'red'|'neutral'
export interface Execution {
  id:string; exerciseId:string; week:number; at:number; program:string; weights:number[]; reps:number[];
  maxKg:number|null; planned:number[]|null; minimum:number[]|null; totalReps:number; expectedReps:number|null;
  targetComplete:boolean|null; rangeMax:boolean; repState:RepState; loadState:LoadState;
  events:string[]; suggestion:string; coachGoal:boolean; recordedSets:number;
}
export interface ExerciseProgress { exercise:Exercise; executions:Execution[]; state:LoadState; trend:string; interpretation:string; initial:number|null; current:number|null; delta:number|null; percent:number|null }

export function repTargets(program:string): {min:number[];max:number[];range:boolean}|null {
  const text=program.replace(/×/g,'x')
  if (/\b(?:sec|secondi)\b/i.test(text)) return null
  // Compound, timed and MAX prescriptions do not have an unambiguous numeric rep total.
  if (/\b(?:max|amrap|emom|plank|planch|set\b)|\d\s*\+\s*\d/i.test(text))return null
  const matches=[...text.matchAll(/\b(\d+)\s*x\s*(\d+)(?:\s*\/\s*(\d+))?/gi)]
  if(!matches.length)return null
  const min:number[]=[],max:number[]=[];let range=false
  for(const m of matches){const n=Number(m[1]),lo=Number(m[2]),hi=m[3]?Number(m[3]):lo;if(n<1||n>12||hi<lo)return null;range ||= hi>lo;for(let i=0;i<n;i++){min.push(lo);max.push(hi)}}
  if(min.length!==setCountForProgram(text))return null
  return {min,max,range}
}
const samePrescription=(a:Execution,b:Execution)=>a.minimum!==null && b.minimum!==null && JSON.stringify([a.minimum,a.planned])===JSON.stringify([b.minimum,b.planned])
export function analyzeExecution(input:Omit<Execution,'repState'|'loadState'|'events'|'suggestion'|'coachGoal'>,previous?:Execution,allPrevious:Execution[]=[]):Execution {
  const current:Execution={...input,repState:'neutral',loadState:'neutral',events:[],suggestion:'',coachGoal:false}
  const comparable=previous&&samePrescription(current,previous)
  if(current.maxKg!==null&&previous?.maxKg!==null&&previous?.maxKg!==undefined)current.loadState=current.maxKg>previous.maxKg?'up':current.maxKg<previous.maxKg?'down':'same'
  if(current.minimum){
    if(current.rangeMax)current.repState='star'
    else if(current.minimum.some((n,i)=>(current.reps[i]??0)<n))current.repState='red'
    else if(comparable)current.repState=current.totalReps>previous.totalReps?'green':current.totalReps<previous.totalReps?'orange':'gray'
  }
  if(current.loadState==='up')current.events.push('Aumento kg')
  if(current.targetComplete===true&&previous?.targetComplete!==true)current.events.push('Target completato')
  current.coachGoal=/\+\s*kg\b/i.test(current.program)&&current.loadState==='up'
  if(current.coachGoal)current.events.push('Obiettivo coach +KG raggiunto')
  if(current.maxKg!==null&&allPrevious.some(p=>p.maxKg!==null)&&current.maxKg>Math.max(...allPrevious.map(p=>p.maxKg??0)))current.events.push('Nuovo miglior carico')
  if(current.loadState==='up'&&current.targetComplete===true)current.suggestion='Aumento riuscito'
  else if(current.loadState==='up'&&current.repState==='red')current.suggestion='Consolida questo carico'
  else if(current.rangeMax)current.suggestion=comparable&&previous.rangeMax&&current.maxKg!==null&&current.maxKg===previous.maxKg?'Aumento carico consigliato':'Possibile aumento carico'
  return current
}

export function buildProgress(exercises:Exercise[],prescriptions:Prescription[],logs:SetLog[],sessions:WorkoutSession[],snapshots:SessionSet[]):ExerciseProgress[] {
  return exercises.map(exercise=>{
    const candidates:Array<{id:string;week:number;at:number;program:string;rows:Array<{setNumber:number;weight:string;reps:string;completed:number}>}>=[]
    const seenWeeks=new Set<number>()
    for(const session of sessions.filter(s=>s.dayId===exercise.dayId)){
      const rows=snapshots.filter(s=>s.sessionId===session.id&&s.exerciseId===exercise.id)
      const live=logs.filter(l=>l.exerciseId===exercise.id&&l.weekNumber===session.weekNumber)
      const source=session.active?live:rows
      if(!source.some(r=>r.completed||r.reps.trim()||(!('loadPrepared' in r&&r.loadPrepared)&&r.weight.trim())))continue
      seenWeeks.add(session.weekNumber)
      candidates.push({id:session.id,week:session.weekNumber,at:session.endedAt||Math.max(session.startedAt,...live.map(l=>l.updatedAt)),program:rows[0]?.prescribed||effectivePrescription(prescriptions.filter(p=>p.exerciseId===exercise.id),session.weekNumber)?.program||'',rows:source})
    }
    for(const week of new Set(logs.filter(l=>l.exerciseId===exercise.id).map(l=>l.weekNumber))){
      if(seenWeeks.has(week))continue
      const rows=logs.filter(l=>l.exerciseId===exercise.id&&l.weekNumber===week)
      if(!rows.some(r=>r.completed||r.reps.trim()||(!r.loadPrepared&&r.weight.trim())))continue
      candidates.push({id:`logs:${exercise.id}:${week}`,week,at:Math.max(...rows.map(l=>l.updatedAt)),program:effectivePrescription(prescriptions.filter(p=>p.exerciseId===exercise.id),week)?.program||'',rows})
    }
    const executions:Execution[]=[]
    for(const candidate of candidates.sort((a,b)=>a.at-b.at||a.week-b.week||a.id.localeCompare(b.id))){
      const count=setCountForProgram(candidate.program),targets=repTargets(candidate.program)
      const rows=Array.from({length:count},(_,i)=>candidate.rows.find(r=>r.setNumber===i+1))
      const weights=rows.map(r=>toNumber(r?.weight??'')),reps=rows.map(r=>toNumber(r?.reps??''))
      const used=candidate.rows.filter(r=>r.weight.trim()&&r.reps.trim()&&toNumber(r.reps)>0).map(r=>toNumber(r.weight))
      const targetComplete=targets?targets.min.every((n,i)=>Boolean(rows[i]?.reps.trim())&&reps[i]>=n):null
      executions.push(analyzeExecution({id:candidate.id,exerciseId:exercise.id,week:candidate.week,at:candidate.at,program:candidate.program,weights,reps,maxKg:used.length?Math.max(...used):null,planned:targets?.max??null,minimum:targets?.min??null,totalReps:reps.reduce((a,b)=>a+b,0),expectedReps:targets?targets.max.reduce((a,b)=>a+b,0):null,targetComplete,rangeMax:Boolean(targets?.range&&targets.max.every((n,i)=>reps[i]>=n)),recordedSets:rows.filter(r=>r?.weight.trim()||r?.reps.trim()).length},executions.at(-1),executions))
    }
    return summarize(exercise,executions)
  })
}
export function summarize(exercise:Exercise,executions:Execution[]):ExerciseProgress {
  const last=executions.at(-1),first=executions.find(e=>e.maxKg!==null),initial=first?.maxKg??null,current=last?.maxKg??null
  const delta=initial!==null&&current!==null?current-initial:null,percent=delta!==null&&initial!==null&&initial>0?delta/initial*100:null
  const tail=executions.slice(-5),loaded=tail.filter(e=>e.maxKg!==null),firstRecent=loaded[0],lastRecent=loaded.at(-1)
  let trend='Nessun dato',interpretation='Nessuna esecuzione registrata.'
  if(last){
    let full=0;for(let i=executions.length-1;i>=0&&executions[i].targetComplete===true;i--)full++
    if(last.loadState==='up'&&last.targetComplete===false){trend='Carico da consolidare';interpretation=`Sei passato a ${kg(last.maxKg)} kg ma non hai ancora completato tutte le ripetizioni previste.`}
    else if(firstRecent&&lastRecent&&loaded.length>1&&lastRecent.maxKg!>firstRecent.maxKg!){trend='In crescita';interpretation=`Nelle ultime ${tail.length} esecuzioni sei passato da ${kg(firstRecent.maxKg)} kg a ${kg(lastRecent.maxKg)} kg${full?`, completando la prescrizione nelle ultime ${full}.`:'.'}`}
    else if(last.loadState==='same'){trend='Consolidamento';interpretation=`Il carico è stabile a ${kg(last.maxKg)} kg${full?` e la prescrizione è stata completata nelle ultime ${full} esecuzioni.`:'.'}`}
    else if(last.loadState==='down'){trend='Carico in calo';interpretation=`Il carico massimo è sceso da ${kg(executions.at(-2)?.maxKg??null)} kg a ${kg(last.maxKg)} kg.`}
    else{trend='Prima esecuzione';interpretation=last.maxKg===null?'Carico non registrato.':`Carico iniziale registrato: ${kg(last.maxKg)} kg.`}
  }
  return {exercise,executions,state:last?.loadState??'neutral',trend,interpretation,initial,current,delta,percent}
}
export function filterProgress(items:ExerciseProgress[],period:Period):ExerciseProgress[] {
  const latest=Math.max(1,...items.flatMap(i=>i.executions.map(e=>e.week))),start=period==='all'?1:Math.max(1,latest-period+1)
  return items.map(item=>summarize(item.exercise,item.executions.filter(e=>e.week>=start)))
}
export const kg=(value:number|null)=>value===null?'—':value.toLocaleString('it-IT',{maximumFractionDigits:2})
export function improvements(items:ExerciseProgress[],sessionId:string){
  return items.flatMap(item=>{const index=item.executions.findIndex(e=>e.id===sessionId),cur=item.executions[index],prev=item.executions[index-1];if(!cur||!prev)return []
    const load=cur.loadState==='up'?`${kg(prev.maxKg)} kg → ${kg(cur.maxKg)} kg`:''
    const reps=samePrescription(cur,prev)&&prev.targetComplete===false&&cur.targetComplete===true?`${prev.reps.join(' / ')} → ${cur.reps.join(' / ')} · target completato`:''
    return load||reps||cur.coachGoal?[{name:item.exercise.name,load,reps,coach:cur.coachGoal}]:[]
  })
}
export function workoutStreak(sessions:WorkoutSession[],days:WorkoutDay[]):number {
  let streak=0,previous:WorkoutSession|undefined
  const slot=(s:WorkoutSession)=>{const ordered=days.filter(d=>d.sheetId===s.sheetId&&!d.mobility).sort((a,b)=>a.dayIndex-b.dayIndex);return (s.weekNumber-1)*ordered.length+ordered.findIndex(d=>d.id===s.dayId)}
  for(const session of sessions.filter(s=>Boolean(s.active)||s.endedAt>0).sort((a,b)=>(a.endedAt||a.startedAt)-(b.endedAt||b.startedAt))){
    if(previous?.sheetId===session.sheetId&&slot(session)>slot(previous)+1)streak=0
    if(session.completionMode==='early')streak=0
    if(!session.active&&session.completionMode!=='early'&&(!previous||previous.sheetId!==session.sheetId||slot(session)!==slot(previous)))streak++
    if(!session.active)previous=session
  }
  return streak
}
