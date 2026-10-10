import {useId,type ReactNode} from 'react'
export function MenuAccordion({title,subtitle,icon,open,onToggle,danger=false,children}:{title:string;subtitle?:string;icon:ReactNode;open:boolean;onToggle:()=>void;danger?:boolean;children:ReactNode}) {
  const id=useId()
  return <section className={`menu-section ${danger?'danger':''}`}><button className={`menu-row ${danger?'danger':''}`} aria-expanded={open} aria-controls={id} onClick={onToggle}>{icon}<span>{title}{subtitle&&<small>{subtitle}</small>}</span><svg className="menu-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={open?'M6 15l6-6 6 6':'M6 9l6 6 6-6'}/></svg></button><div id={id} className="menu-accordion-content" hidden={!open}>{children}</div></section>
}
