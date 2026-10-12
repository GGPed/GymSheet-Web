import {useState} from 'react'

export function CoachNote({note}:{note:string}) {
  const [expanded,setExpanded]=useState(false)
  const start=note.search(/(?:^|\n\s*\n)(?:Recuperi?\s*:?\s*)?Fondamentali\s*:/i)
  const before=start<0?note:note.slice(0,start).trim()
  const remaining=start<0?'':note.slice(start).trim().replace(/^Recuperi?\s*:?\s*/i,'')
  const recovery=remaining
  const coach=before
  return <div className="android-coach">
    {coach&&<div className="coach-note-section"><strong>Nota coach</strong><p className={expanded?'':'clamped'}>{coach}</p>{coach.length>95&&<button onClick={()=>setExpanded(v=>!v)}>{expanded?'Riduci':'Mostra tutto'}</button>}</div>}
    {recovery&&<div className="coach-note-section"><strong>Recupero</strong><p>{recovery}</p></div>}
  </div>
}
