import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { haptic } from '../haptics'

export function useRecoveryTimer() {
  const stored = useLiveQuery(async () => ({endAt:await getSetting('recoveryEndAt',0),subtitle:await getSetting('recoverySubtitle','')}))
  const endAt=stored?.endAt??0, subtitle=stored?.subtitle??''
  const notified=useRef(0)
  const [expanded,setExpanded]=useState(false),[now,setNow]=useState(Date.now())
  useEffect(()=>{
    const tick=()=>setNow(Date.now()),timer=window.setInterval(tick,250)
    document.addEventListener('visibilitychange',tick)
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',tick)}
  },[])
  useEffect(()=>{
    if(!endAt||Date.now()<endAt||notified.current===endAt)return
    notified.current=endAt
    void db.transaction('rw',db.settings,async()=>{
      if(await getSetting('recoveryEndAt',0)!==endAt||await getSetting('recoveryNotifiedAt',0)===endAt)return false
      await db.settings.put({key:'recoveryNotifiedAt',value:endAt});return true
    }).then(async claimed=>{
      if(!claimed)return
      const permitted=await getSetting('recoveryNotifications',true)
      const registration=permitted&&document.visibilityState==='hidden'&&'Notification' in window&&Notification.permission==='granted'?await navigator.serviceWorker?.getRegistration():undefined
      if(await getSetting('recoveryEndAt',0)!==endAt)return
      if(registration){await registration.showNotification('Recupero terminato',{body:subtitle,tag:'gymsheet-recovery',vibrate:[180,80,180]} as NotificationOptions);return}
      haptic('recovery')
    }).catch(()=>{/* Never duplicate feedback after a persistence failure. */})
  },[endAt,now,subtitle])
  const start=async(seconds:number,label:string)=>{
    if(seconds<=0)return
    const started=await db.transaction('rw',db.settings,async()=>{
      if(await getSetting('recoveryEndAt',0)>Date.now())return false
      await db.settings.bulkPut([{key:'recoveryEndAt',value:Date.now()+seconds*1000},{key:'recoverySubtitle',value:label}]);return true
    })
    if(started){setNow(Date.now());setExpanded(true)}
  }
  const stop=async()=>{
    await db.transaction('rw',db.settings,async()=>{await db.settings.bulkPut([{key:'recoveryEndAt',value:0},{key:'recoverySubtitle',value:''}])})
    setExpanded(false);setNow(Date.now())
    const registration=await navigator.serviceWorker?.getRegistration()
    for(const notification of await registration?.getNotifications({tag:'gymsheet-recovery'})??[])notification.close()
  }
  const extend=async(seconds:number)=>{
    await db.transaction('rw',db.settings,async()=>{
      const current=await getSetting('recoveryEndAt',0)
      if(current<=Date.now())return
      await db.settings.put({key:'recoveryEndAt',value:current+seconds*1000})
    });setNow(Date.now())
  }
  return {endAt,subtitle,expanded,setExpanded,start,stop,extend,ready:stored!==undefined,remainingMs:Math.max(0,endAt-now),active:endAt>now,expired:Boolean(endAt&&endAt<=now)}
}
