import catalog from './exerciseImages.json'
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const images:Record<string,string[]>=catalog.images
const aliases:Record<string,string>=catalog.aliases
const groupsByFile=new Map(Object.values(images).flatMap(group=>group.map(file=>[file,group] as const)))
const variants:Record<string,string>={
 'crunch':'crunches','planch':'plank','plank laterale':'side bridge','planch laterale':'side bridge',
 'barbell bench press':'barbell bench press medium grip','bench press':'barbell bench press medium grip',
 'leg extension':'leg extensions','lying leg curl':'lying leg curls','seated cable row':'seated cable rows',
 'dumbbell lateral raise':'side lateral raise','dumbbell row':'one arm dumbbell row',
 'external rotation with band':'external rotation with band'
}
export function imagesForExercise(name:string,program:string,note:string):string[]{
 const components=name.split(/\s*\+\s*/)
 if(components.length>1){
  const photos=components.map(component=>imagesForExercise(component,'',note))
  if(photos.every(group=>!group[0].endsWith('exercise-unavailable.svg')))return [...new Set(photos.flat())]
 }
 const key=normalize(name)
 let preferred:string|undefined=aliases[key]
 let group:string[]|undefined=images[key]??(preferred?groupsByFile.get(preferred):images[variants[key]])
 if(group&&preferred&&!group.includes(preferred))preferred=undefined
 if(key==='addome'){
  const details=normalize(`${program} ${note}`)
  if(/\b(?:plank|planch)\b/.test(details)&&/\bcrunch\b/.test(details))return [`${import.meta.env.BASE_URL}exercises/${encodeURIComponent(catalog.compound)}`]
  if(/\bcrunch machine\b/.test(details)){preferred=aliases['crunch machine'];group=groupsByFile.get(preferred)}
  else if(/\b(?:plank|planch) laterale\b/.test(details)){group=images['side bridge'];preferred=undefined}
  else if(/\b(?:plank|planch)\b/.test(details)){group=images['plank'];preferred=undefined}
  else if(/\bcrunch\b/.test(details)){group=images['crunches'];preferred=undefined}
 }
 if(!group?.length)return [`${import.meta.env.BASE_URL}exercise-unavailable.svg`]
 return [...new Set([...(preferred?[preferred]:[]),...group])].map(file=>`${import.meta.env.BASE_URL}exercises/${encodeURIComponent(file)}`)
}
export function imageForExercise(name:string,program:string,note:string):string{return imagesForExercise(name,program,note)[0]}


