import {db,assertWorkoutUnlocked} from './db'
export interface ExerciseTimer {key:string;index:number;endAt:number}
export async function activeExerciseTimer(now=Date.now()):Promise<ExerciseTimer|null> {
  const settings=await db.settings.toArray()
  const current=settings.find(s=>s.key==='activeExerciseTimer')?.value as ExerciseTimer|undefined
  if(current&&current.endAt>now)return current
  // Recover timers from earlier versions without resetting their countdown.
  for(const setting of settings.filter(s=>s.key.startsWith('superset:'))){
    for(const [index,value] of Object.entries((setting.value??{}) as Record<string,{endAt?:number}>))if(value?.endAt&&value.endAt>now)return {key:setting.key,index:Number(index),endAt:value.endAt}
  }
  return null
}
export async function startExerciseTimer(key:string,index:number,seconds:number){
  await db.transaction('rw',db.settings,async()=>{
    await assertWorkoutUnlocked()
    if(await activeExerciseTimer())throw new Error('Un timer esercizio è già in corso.')
    const values=(await db.settings.get(key))?.value as Record<number,object>??{},endAt=Date.now()+seconds*1000
    await db.settings.bulkPut([{key,value:{...values,[index]:{...values[index],endAt}}},{key:'activeExerciseTimer',value:{key,index,endAt}}])
  })
}
export async function stopExerciseTimer(key:string,index:number){
  await db.transaction('rw',db.settings,async()=>{
    await assertWorkoutUnlocked()
    const active=await activeExerciseTimer()
    if(!active||active.key!==key||active.index!==index)return
    const values=(await db.settings.get(key))?.value as Record<number,{endAt?:number}>??{}
    await db.settings.bulkPut([{key,value:{...values,[index]:{...values[index],endAt:undefined}}},{key:'activeExerciseTimer',value:null}])
  })
}
