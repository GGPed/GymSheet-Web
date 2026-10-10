import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
let locks=0,previousOverflow=''
export function SwipeDialog({title,onClose,children,className=''}:{title:string;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLDialogElement>(null),id=useId()
  useEffect(()=>{
    const dialog=ref.current,focus=document.activeElement as HTMLElement|null
    if(locks++===0){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden'}
    dialog?.showModal()
    return()=>{dialog?.close();if(--locks===0)document.body.style.overflow=previousOverflow;focus?.focus()}
  },[])
  const content=<dialog ref={ref} aria-labelledby={id} className={`consultative-modal ${className}`} onCancel={e=>{e.preventDefault();onClose()}}><div className="modal-heading"><h2 id={id}>{title}</h2><button type="button" className="icon-button" aria-label={`Chiudi ${title}`} onClick={onClose}>×</button></div><div className="modal-content">{children}</div></dialog>
  return typeof document==='undefined'?content:createPortal(content,document.body)
}
