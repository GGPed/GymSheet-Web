import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// Keep children mounted while minimized so drafts, selection and scroll survive.
export function SwipePanel({expanded,onExpand,onMinimize,onClose,title,compact,children,className=''}:{expanded:boolean;onExpand:()=>void;onMinimize:()=>void;onClose?:()=>void;title:string;compact?:ReactNode;children:ReactNode;className?:string}) {
  const [dock,setDock]=useState<HTMLElement|null>(null)
  useEffect(()=>{let element=document.getElementById('gymsheet-panel-dock');if(!element){element=document.createElement('div');element.id='gymsheet-panel-dock';element.className='panel-dock';document.body.appendChild(element)}setDock(element)},[])
  const panel=useRef<HTMLElement>(null),gesture=useRef<{x:number;y:number;at:number;mode:'up'|'down'}|null>(null)
  const offsetRef=useRef(0),[offset,setOffset]=useState(0),[dragging,setDragging]=useState(false)
  const update=(dy:number,dx:number)=>{const start=gesture.current;if(!start)return;const distance=start.mode==='down'?dy:-dy;if(distance>Math.abs(dx)){offsetRef.current=Math.max(0,distance);setOffset(offsetRef.current);setDragging(true)}}
  const finish=(cancel=false)=>{const start=gesture.current,distance=offsetRef.current;gesture.current=null;offsetRef.current=0;setOffset(0);setDragging(false);if(start&&!cancel&&(distance>65||(distance>30&&distance/Math.max(1,performance.now()-start.at)>.5)))(start.mode==='down'?onMinimize:onExpand)()}
  useEffect(()=>{const element=panel.current;if(!element)return;const move=(e:TouchEvent)=>{if(!gesture.current||!e.touches.length)return;const dy=e.touches[0].clientY-gesture.current.y,dx=e.touches[0].clientX-gesture.current.x;if(dy>Math.abs(dx)&&element.scrollTop<=0){e.preventDefault();update(dy,dx)}};element.addEventListener('touchmove',move,{passive:false});return()=>element.removeEventListener('touchmove',move)},[])
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(expanded&&!document.querySelector('dialog[open]')&&!e.defaultPrevented&&e.key==='Escape'){e.preventDefault();onMinimize()}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[expanded,onMinimize])
  const begin=(x:number,y:number,mode:'up'|'down')=>{gesture.current={x,y,at:performance.now(),mode};offsetRef.current=0}
  const peek=<div className={`panel-peek ${className}`} onTouchStart={e=>begin(e.touches[0].clientX,e.touches[0].clientY,'up')} onTouchMove={e=>{if(gesture.current)update(e.touches[0].clientY-gesture.current.y,e.touches[0].clientX-gesture.current.x)}} onTouchEnd={()=>finish()} onTouchCancel={()=>finish(true)} style={{borderTopColor:dragging?'var(--accent)':undefined}}><button onClick={onExpand} aria-label={`Riapri ${title}`}><i className="sheet-handle"/><span>{compact??title}</span><svg className="panel-indicator" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>{onClose&&<button aria-label={`Chiudi ${title}`} onClick={onClose}>×</button>}</div>
  return <>
    {!expanded&&(dock?createPortal(peek,dock):peek)}
    <div aria-hidden={!expanded} className={`sheet-backdrop swipe-panel-backdrop ${expanded?'':'is-minimized'}`} onMouseDown={e=>{if(e.target===e.currentTarget)onMinimize()}}>
      <section ref={panel} role="dialog" aria-modal={expanded} aria-label={title} className={`bottom-sheet swipe-panel ${className} ${dragging?'is-dragging':''}`} style={{transform:`translateY(${offset}px)`}}
        onTouchStart={e=>{if(!(e.target as HTMLElement).closest('.panel-grip,input,textarea,select')&&e.currentTarget.scrollTop<=0)begin(e.touches[0].clientX,e.touches[0].clientY,'down')}} onTouchEnd={()=>finish()} onTouchCancel={()=>finish(true)}>
        <div className="panel-grip" onPointerDown={e=>{if(((e.target as HTMLElement).closest('button')&&!(e.target as HTMLElement).closest('.panel-handle-control'))||!e.isPrimary||e.button!==0)return;begin(e.clientX,e.clientY,'down');((e.target as HTMLElement).closest<HTMLElement>('.panel-handle-control')??e.currentTarget).setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(gesture.current)update(e.clientY-gesture.current.y,e.clientX-gesture.current.x)}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)}><button className="panel-handle-control" aria-label={`Minimizza ${title}`} onClick={onMinimize}><span className="sheet-handle"/><svg className="panel-indicator" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div className="settings-title"><h2>{title}</h2>{onClose&&<button aria-label={`Chiudi ${title}`} onClick={onClose}>×</button>}</div></div>
        {children}
      </section>
    </div>
  </>
}

