export interface SupersetPart {name:string;seconds?:number;reps?:number;load?:boolean;kg?:number}
export function supersetParts(program:string,fallbackName=''):SupersetPart[] {
  const text=program.replace(/^\s*\d+\s*set\s+(?:di\s+)?/i,'').replace(/^\s*\d+\s*[x×]\s*(?=\d+\s*(?:"|''|″|s\b|sec\b))/i,'')
  const parts=text.split(/\s*\+\s*/)
  const parsed=parts.map(part=>{
    const timed=part.match(/^(.*?)\s*(\d+)\s*(?:''|"|″|s\b|sec\b)(.*)$/i)
    const reps=part.match(/^(.*?)\s*x\s*(\d+)(.*)$/i)??part.match(/^(.*?)\s+(\d+)\s*(?:reps?|rip(?:etizioni)?)(.*)$/i)
    if(!timed&&!reps)return null
    const match=(timed??reps)!,name=match[1].trim()||(timed?fallbackName:''),value=Number(match[2])
    if(!/[a-zà-ÿ]/i.test(name)||!value)return null
    const kg=part.match(/@?\s*(\d+(?:[.,]\d+)?)\s*kg\b/i)
    const load=Boolean(kg||/machine|macchina|manubr|bilanciere|cav[oi]|con (?:peso|carico)|zavorr/i.test(name))
    const sides=/laterale|per lato/i.test(part)?[' · sinistra',' · destra']:['']
    return sides.map(side=>({name:name+side,...(timed?{seconds:value}:{reps:value,...(load?{load:true,...(kg?{kg:Number(kg[1].replace(',','.'))}:{})}:{})})}))
  })
  return parsed.some(p=>p===null)?[]:parsed.flat() as SupersetPart[]
}
