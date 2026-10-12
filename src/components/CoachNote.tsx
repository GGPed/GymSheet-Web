import {useState} from 'react'

export function CoachNote({note}:{note:string}) {
  const [expanded,setExpanded]=useState(false)
  const initialLoad=note.split('\n').find(line=>/^\s*Carico prima settimana:\s*RPE(?=\s*\d)/i.test(line))
  const content=note.split('\n').filter(line=>line!==initialLoad).join('\n').trim()
  const start=content.search(/(?:^|\n\s*\n)(?:Recuperi?\s*:?\s*)?Fondamentali\s*:/i)
  const before=start<0?content:content.slice(0,start).trim()
  const remaining=start<0?'':content.slice(start).trim().replace(/^Recuperi?\s*:?\s*/i,'')
  const recovery=remaining
  const coach=before
  return <div className="android-coach">
    {(coach||initialLoad)&&<div className="coach-note-section"><strong>Nota coach</strong>{initialLoad&&<p>{initialLoad}</p>}{coach&&<p className={expanded?'':'clamped'}>{coach}</p>}{coach.length>95&&<button onClick={()=>setExpanded(v=>!v)}>{expanded?'Riduci':'Mostra tutto'}</button>}</div>}
    {recovery&&<div className="coach-note-section"><strong>Recupero</strong><p>{recovery}</p></div>}
  </div>
}
