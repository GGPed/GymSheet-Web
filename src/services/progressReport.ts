import { jsPDF } from 'jspdf'
import { progressData } from './progress'
import { kg, type Period } from '../progressEngine'
import { chartGeometry } from '../progressChart'

export async function appendProgressReport(doc:jsPDF,sheetId:string,period:Period) {
  const items=await progressData(sheetId,period)
  for(let index=0;index<items.length;index++){
    doc.addPage()
    const item=items[index];doc.setFontSize(17);doc.text(doc.splitTextToSize(item.exercise.name,175),16,20)
    doc.setFontSize(10);doc.text(`Progressi · ${period==='all'?'Tutto':period+' settimane'}`,16,36)
    doc.text(`Inizio: ${kg(item.initial)} kg   Attuale: ${kg(item.current)} kg`,16,44)
    doc.text(`Variazione: ${item.delta===null?'—':(item.delta>0?'+':'')+kg(item.delta)+' kg'} (${item.percent===null?'—':(item.percent>0?'+':'')+kg(item.percent)+'%'})`,16,51)
    doc.text(`Trend: ${item.trend}`,16,58)
    if(item.executions.some(e=>e.maxKg!==null)){const chart=chartGeometry(item.executions,175,75),originY=67
    doc.setDrawColor(100);doc.line(16+chart.left,originY+chart.top,16+chart.left,originY+chart.bottom);doc.line(16+chart.left,originY+chart.bottom,191,originY+chart.bottom)
    doc.setFontSize(8);doc.text('kg',18,originY+10);doc.text(kg(chart.high),18,originY+20);doc.text('0',22,originY+chart.bottom)
    for(const p of chart.points){if(p.y===null)continue;const prev=chart.points[p.index-1];doc.setDrawColor(49,91,226);if(prev?.y!==null&&prev?.y!==undefined)doc.line(16+prev.x,originY+prev.y,16+p.x,originY+p.y);doc.setFillColor(49,91,226);doc.circle(16+p.x,originY+p.y,1.4,'F');doc.setTextColor(30);doc.text(`W${p.execution.week}`,16+p.x-3,originY+chart.bottom+6);doc.text(p.execution.targetComplete===true?'OK':p.execution.targetComplete===false?'!':'?',16+p.x-2,originY+p.y-3)}
    }
    doc.setFontSize(10);let y=item.executions.some(e=>e.maxKg!==null)?155:70
    doc.text(doc.splitTextToSize(item.interpretation,175),16,y);y+=22
    doc.text('Sessioni e ripetizioni (OK = target completato; ! = non completato)',16,y);y+=9
    for(const [n,e] of item.executions.entries()){
      const lines=doc.splitTextToSize(`W${e.week} · Esecuzione ${n+1} · ${kg(e.maxKg)} kg · ${e.reps.join(' / ')} Ripetizioni (${({star:'massimo range',green:'aumento',gray:'stabili',orange:'calo entro il minimo',red:'sotto minimo',neutral:'non confrontabili'})[e.repState]}) · ${e.expectedReps===null?'target non numerico':e.totalReps+'/'+e.expectedReps+' Ripetizioni'} · ${e.targetComplete===true?'OK':e.targetComplete===false?'!':'non valutabile'}\nTarget: ${e.program}\n${[...e.events,e.suggestion].filter(Boolean).join(' · ')}`,175)
      if(y+lines.length*5>277){doc.addPage();y=20;doc.text(item.exercise.name+' · continua',16,y);y+=10}
      doc.text(lines,16,y);y+=lines.length*5+6
    }
    if(!item.executions.length)doc.text('Nessuna esecuzione registrata nel periodo.',16,y)
  }
  if(!items.length)doc.text('Nessun esercizio nella scheda.',16,20)
}
export async function exportProgressReport(sheetId:string,period:Period) {
  const doc=new jsPDF();await appendProgressReport(doc,sheetId,period);doc.deletePage(1);
  doc.save(`GymSheet-Progressi-${period==='all'?'tutto':period+'-settimane'}.pdf`)
}

