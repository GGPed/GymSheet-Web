import {kg,type ExerciseProgress,type Execution} from './progressEngine'

export const objective=(e:Execution)=>e.targetComplete===true?'Obiettivo raggiunto':e.targetComplete===false?'Obiettivo non raggiunto':'Obiettivo non valutabile'
export function friendlyProgress(item:ExerciseProgress){
  const last=item.executions.at(-1),previous=item.executions.at(-2)
  if(!last)return {status:'In attesa del primo allenamento',title:'',reason:''}
  const from=kg(previous?.maxKg??null),to=kg(last.maxKg)
  if(last.suggestion==='Aumento riuscito')return {status:'Stai migliorando',title:'Aumento riuscito',reason:`Hai aumentato da ${from} kg a ${to} kg mantenendo tutte le ripetizioni.`}
  if(last.suggestion==='Consolida questo carico'||last.targetComplete===false&&last.loadState==='up')return {status:'Mantieni questo peso',title:'Mantieni questo peso',reason:'Prima di aumentare ancora, completa tutte le ripetizioni previste con questo peso.'}
  if(last.rangeMax)return {status:last.loadState==='up'?'Stai migliorando':'Stai mantenendo',title:'Puoi provare ad aumentare',reason:last.suggestion==='Aumento carico consigliato'?'Hai raggiunto il massimo delle ripetizioni per due allenamenti consecutivi con lo stesso peso.':'Hai raggiunto il massimo delle ripetizioni in tutte le serie.'}
  if(last.loadState==='down')return {status:'Carico in calo',title:'Prestazione in calo',reason:`Questa volta hai usato ${to} kg rispetto ai ${from} kg della volta precedente.`}
  if(last.targetComplete===false)return {status:'Mantieni questo peso',title:'Mantieni questo peso',reason:'Lavora sulle ripetizioni mancanti prima di aumentare il peso.'}
  if(last.loadState==='same')return {status:'Stai mantenendo',title:'Stai mantenendo',reason:last.targetComplete?'Stesso peso della volta scorsa, con tutte le ripetizioni completate.':'Il peso è uguale a quello della volta scorsa.'}
  if(last.loadState==='up')return {status:'Stai migliorando',title:'Mantieni questo peso',reason:'Il carico è aumentato. Continua a lavorare con questo peso.'}
  return {status:'Primo allenamento registrato',title:'Mantieni questo peso',reason:'Usa questo allenamento come riferimento per la prossima volta.'}
}
