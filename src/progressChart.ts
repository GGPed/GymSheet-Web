import type { Execution } from './progressEngine'
export function chartGeometry(executions:Execution[],width=320,height=170) {
  const values=executions.map(e=>e.maxKg).filter((n):n is number=>n!==null)
  const high=Math.max(1,...values)*1.12, left=35, top=12, bottom=height-30
  const points=executions.map((e,i)=>({execution:e,index:i,x:left+i*(width-left-15)/Math.max(1,executions.length-1),y:e.maxKg===null?null:bottom-e.maxKg/high*(bottom-top)}))
  return {points,high,left,top,bottom,width,height}
}
