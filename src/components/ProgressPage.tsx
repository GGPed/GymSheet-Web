import {imageForExercise} from '../services/images'
import { db } from '../db'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { progressData } from '../services/progress'
import { exportProgressReport } from '../services/progressReport'
import { kg, type Execution, type ExerciseProgress, type Period, type LoadState } from '../progressEngine'
import {friendlyProgress,objective} from '../progressPresentation'
import { chartGeometry } from '../progressChart'

export function ProgressPage({sheetId}:{sheetId:string}) {
  const [period,setPeriod]=useState<Period>('all'),[exerciseId,setExerciseId]=useState(''),[error,setError]=useState(''),[exporting,setExporting]=useState(false),[collapsed,setCollapsed]=useState<Record<string,boolean>>({})
  const [stateFilter,setStateFilter]=useState<LoadState|null>(null)
  const data=useLiveQuery(()=>progressData(sheetId,period),[sheetId,period])
  const days=useLiveQuery(()=>db.days.where('sheetId').equals(sheetId).sortBy('dayIndex'),[sheetId])??[]
  useEffect(()=>{
    if(!stateFilter||!data)return
    const matches=new Set(data.filter(item=>item.state===stateFilter).map(item=>item.exercise.dayId))
    setCollapsed(previous=>({...previous,...Object.fromEntries([...matches].map(id=>[id,false]))}))
  },[data,stateFilter])
  const visibleData=data?.filter(item=>!stateFilter||item.state===stateFilter)??[]
  const detail=data?.find(item=>item.exercise.id===exerciseId)
  const report=async()=>{setError('');setExporting(true);try{await exportProgressReport(sheetId,period)}catch(e){setError(e instanceof Error?e.message:'Report non disponibile.')}finally{setExporting(false)}}
  return <main className="page-view progress-page"><div className="page-title"><h2>Progressi</h2><button disabled={exporting} onClick={()=>void report()}>{exporting?'Preparazione…':<><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg> Scarica PDF</>}</button></div>
    <PeriodFilter value={period} onChange={setPeriod}/>
    {error&&<p className="error" role="alert">{error}</p>}
    {!data?<p role="status">Caricamento progressi…</p>:<>
      {!detail&&<><div className="progress-dashboard">{([{state:'up',label:'In crescita'},{state:'same',label:'Stabili'},{state:'down',label:'In calo'}] as const).map(({state,label})=><button type="button" className={`${state} ${stateFilter===state?'active':''}`} aria-pressed={stateFilter===state} aria-label={`Filtra ${label}`} onClick={()=>setStateFilter(current=>current===state?null:state)} key={state}><strong>{data.filter(i=>i.state===state).length}</strong><span>{label}</span></button>)}</div>
      {!data.some(i=>['up','same','down'].includes(i.state))&&<p className="progress-empty-hint">I dati compariranno dopo i primi allenamenti.</p>}{stateFilter&&!visibleData.length&&<p className="progress-empty-hint" role="status">Nessun esercizio {stateFilter==='up'?'in crescita':stateFilter==='same'?'stabile':'in calo'} nel periodo selezionato.</p>}</>}
      {detail?<><button className="secondary" onClick={()=>setExerciseId('')}>← Tutti gli esercizi</button><ExerciseProgressDetail key={detail.exercise.id+String(period)} item={detail} workout={String.fromCharCode(65+days.filter(d=>!d.mobility).findIndex(d=>d.id===detail.exercise.dayId))}/></>:days.filter(day=>!day.mobility).map((day,index)=>{const matches=visibleData.filter(item=>item.exercise.dayId===day.id);if(stateFilter&&!matches.length)return null;return <section key={day.id} className="progress-day"><button className="progress-day-heading" aria-expanded={!collapsed[day.id]} onClick={()=>setCollapsed(v=>({...v,[day.id]:!v[day.id]}))}>{String.fromCharCode(65+index)}<span aria-hidden="true">{collapsed[day.id]?'+':'−'}</span></button><div className="progress-day-body" hidden={collapsed[day.id]}>{matches.map(item=><article className={`progress-exercise ${stateFilter?'filtered '+item.state:''}`} key={item.exercise.id}><img className="progress-thumbnail" src={imageForExercise(item.exercise.name,item.executions.at(-1)?.program??'',item.exercise.trainerNote)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=`${import.meta.env.BASE_URL}exercise-unavailable.svg`}} alt=""/><div className="progress-exercise-copy"><h3>{item.exercise.name}</h3>{stateFilter&&<span className="progress-state-label">{item.state==='up'?'In crescita':item.state==='same'?'Stabile':'In calo'}</span>}<p>{item.executions.length?`${kg(item.current)} kg · ${friendlyProgress(item).status}`:'Nessuna esecuzione nel periodo'}</p></div><button className="progress-detail-cta" aria-label={`Vai al dettaglio ${item.exercise.name}`} onClick={()=>setExerciseId(item.exercise.id)}>Vai al dettaglio</button></article>)}</div></section>})}
    </>}
  </main>
}
export function PeriodFilter({value,onChange}:{value:Period;onChange:(p:Period)=>void}) {return <div className="segmented period-filter" aria-label="Periodo progressi">{([4,8,'all'] as Period[]).map(p=><button key={p} aria-pressed={value===p} className={value===p?'active':''} onClick={()=>onChange(p)}>{p==='all'?'Tutto':p+' settimane'}</button>)}</div>}
function PointInfo({point}:{point:Execution}) {return <div className="point-info" role="status"><b>Settimana {point.week} · {new Date(point.at).toLocaleDateString('it-IT')}</b><p>{kg(point.maxKg)} kg · {point.reps.join(' / ')} ripetizioni</p><p>{objective(point)}</p></div>}
export function ExerciseProgressDetail({item,workout}:{item:ExerciseProgress;workout?:string}) {
  const rows=item.executions,[selected,setSelected]=useState<number|null>(null),[a,setA]=useState(0),[b,setB]=useState(Math.max(0,rows.length-1))
  const chart=chartGeometry(rows),latest=rows.at(-1),previous=rows.at(-2),first=rows[a],last=rows[b],friendly=friendlyProgress(item)
  const delta=first&&last&&first.maxKg!==null&&last.maxKg!==null?last.maxKg-first.maxKg:null
  const change=latest&&previous&&latest.maxKg!==null&&previous.maxKg!==null?latest.maxKg-previous.maxKg:null
  const loaded=chart.points.filter(p=>p.y!==null),values=loaded.map(p=>p.execution.maxKg!),low=Math.min(...values),high=Math.max(...values)
  return <section className="exercise-progress-detail">
    <header className="progress-detail-header"><img className="progress-detail-image" src={imageForExercise(item.exercise.name,latest?.program??'',item.exercise.trainerNote)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=`${import.meta.env.BASE_URL}exercise-unavailable.svg`}} alt=""/><div><h3>{item.exercise.name}</h3>{workout&&<small>Workout {workout}</small>}<p className="friendly-status">{friendly.status}</p></div></header>
    {!latest?<div className="progress-empty-detail"><strong>Nessuna esecuzione registrata</strong><p>Completa almeno un allenamento per vedere l’andamento.</p></div>:<>
      <div className="progress-current"><strong>{kg(latest.maxKg)} <small>kg</small></strong><p>{latest.maxKg===null?'Carico non registrato':change===null?'Primo carico di riferimento':change===0?'Stesso peso della volta scorsa':`${change>0?'+':''}${kg(change)} kg rispetto alla volta scorsa`}</p><p>{latest.reps.join(' / ')} ripetizioni</p><span className={latest.targetComplete===true?'objective achieved':'objective'}>{objective(latest)}</span></div>
      {loaded.length>0&&<section className="progress-load-chart"><h4>Come sta andando il carico</h4><svg viewBox="0 0 320 170" role="img" aria-label={`Andamento del carico di ${item.exercise.name}`}>
        <text x="2" y="12" fill="currentColor" fontSize="10">kg</text>
        {[...new Set([low,high])].map(v=><text key={v} x="1" y={chart.bottom-(v/chart.high)*(chart.bottom-chart.top)} fill="currentColor" fontSize="10">{kg(v)}</text>)}
        <path d={`M${chart.left} ${chart.top}V${chart.bottom}H305`} stroke="currentColor" opacity=".3" fill="none"/>
        {chart.points.map((p,i)=><g key={p.execution.id}>{p.y!==null&&<>{i>0&&chart.points[i-1].y!==null&&<line x1={chart.points[i-1].x} y1={chart.points[i-1].y!} x2={p.x} y2={p.y} stroke="var(--accent)" strokeWidth="2"/>}<g role="button" tabIndex={0} aria-label={`Settimana ${p.execution.week}, ${kg(p.execution.maxKg)} kg, ${objective(p.execution)}`} onClick={()=>setSelected(selected===i?null:i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(selected===i?null:i)}}}><circle cx={p.x} cy={p.y} r="16" fill="transparent"/><circle cx={p.x} cy={p.y} r={selected===i?6:4} fill="var(--accent)"/></g></>}<text x={p.x} y="164" textAnchor="middle" fill="currentColor" fontSize="9">S{p.execution.week}</text></g>)}
      </svg><p className="muted">Tocca un punto per vedere l’allenamento.</p>{selected!==null&&rows[selected]&&<PointInfo point={rows[selected]}/>}</section>}
      <section className="progress-recent"><h4>Le ultime volte</h4>{[...rows].reverse().map(e=><article className={`reps-history ${e.repState}`} key={e.id}><b>Settimana {e.week} <small>· {new Date(e.at).toLocaleDateString('it-IT')}</small></b><span>{kg(e.maxKg)} kg · {e.reps.join(' / ')}</span><small>{objective(e)}</small></article>)}</section>
      <section className="progress-insight">{friendly.title!==friendly.status&&<h4>{friendly.title}</h4>}<p>{friendly.reason}</p>{latest.coachGoal&&<small>Obiettivo coach +KG raggiunto.</small>}</section>
      {rows.length>1&&<details className="progress-comparison"><summary>Confronta due allenamenti</summary><div className="comparison-selectors">{[{value:a,set:setA,label:'Primo allenamento'},{value:b,set:setB,label:'Secondo allenamento'}].map(control=><label key={control.label}>{control.label}<select value={control.value} onChange={e=>control.set(Number(e.target.value))}>{rows.map((e,i)=><option key={e.id} value={i}>Settimana {e.week} · {new Date(e.at).toLocaleDateString('it-IT')}</option>)}</select></label>)}</div>{first&&last&&<div className="point-info"><b>Settimana {first.week} vs Settimana {last.week}</b><p>Carico: {kg(first.maxKg)} kg → {kg(last.maxKg)} kg</p><p>{delta===null?'Carico non confrontabile':`${delta>0?'+':''}${kg(delta)} kg · ${first.maxKg!>0?`${delta>0?'+':''}${kg(delta/first.maxKg!*100)}%`:'percentuale non disponibile'}`}</p><p>Ripetizioni: {first.reps.join(' / ')} → {last.reps.join(' / ')}</p><p>{objective(first)} → {objective(last)}</p></div>}</details>}
    </>}
  </section>
}
