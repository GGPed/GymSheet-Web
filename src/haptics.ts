type HapticEvent='start'|'set'|'recovery'|'finish'
const patterns:Record<HapticEvent,number|number[]>={start:35,set:65,recovery:[180,80,180],finish:[60,70,100,70,160]}
export function haptic(event:HapticEvent){if(typeof navigator!=='undefined'&&'vibrate' in navigator)navigator.vibrate(patterns[event])}
