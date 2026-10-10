import messages from './streak_messages.json'
export function streakMessage(value:number):string {
  const threshold=Math.min(999,Math.floor(Math.max(0,value)/3)*3)
  return (messages as Record<string,string>)[String(threshold)]??''
}
