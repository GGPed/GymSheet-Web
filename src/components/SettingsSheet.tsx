import {DOWNLOAD_READY,type GeneratedDownload} from '../services/download'
import {MenuAccordion} from './MenuAccordion'
import {useEffect,useRef,useState} from 'react'
import {getSetting,resetAllData,setSetting} from '../db'
import type {Period} from '../progressEngine'
import {exportWebBackup,restoreWebBackup} from '../services/backup'
import {exportHistoryExcel,exportHistoryPdf} from '../services/export'
import {PeriodFilter} from './ProgressPage'
import {SheetArchive} from './ParityFeatures'
import {SwipeDialog} from './SwipeDialog'
import {SheetImportDialog} from './SheetImportDialog'
import {NotificationGuide} from './NotificationGuide'

interface Props {onHistory:()=>void;open:boolean;onClose:()=>void}
function MenuIcon({kind}:{kind:string}) {const paths:Record<string,string>={archive:'M3 5h18v4H3zM5 9v12h14V9M9 13h6',import:'M14 3h6v18H4V3h6M12 3v11m-4-4 4 4 4-4',backup:'M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7',restore:'M4 10a8 8 0 1 1 0 6M4 4v6h6',pdf:'M4 3h11l5 5v13H4zM15 3v6h5M7 13h10m-10 4h7',sheet:'M4 3h16v18H4zM4 9h16M4 15h16M10 9v12',bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',clock:'M12 7v5l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',delete:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7'};return <svg className="menu-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>}
export function SettingsSheet({open,onClose,onHistory}:Props) {
  const excel=useRef<HTMLInputElement>(null),restore=useRef<HTMLInputElement>(null),running=useRef(false)
  const [generatedDownload,setGeneratedDownload]=useState<GeneratedDownload|null>(null)
  useEffect(()=>{const receive=(event:Event)=>{if(running.current)setGeneratedDownload((event as CustomEvent<GeneratedDownload>).detail)};window.addEventListener(DOWNLOAD_READY,receive);return()=>window.removeEventListener(DOWNLOAD_READY,receive)},[])
  useEffect(()=>{if(!generatedDownload)return;const timer=window.setTimeout(()=>setGeneratedDownload(null),Math.max(0,generatedDownload.expiresAt-Date.now()));return()=>window.clearTimeout(timer)},[generatedDownload])
  const [file,setFile]=useState<File|null>(null)
  const [archive,setArchive]=useState(false),[importOptions,setImportOptions]=useState(false),[restoreOptions,setRestoreOptions]=useState(false)
  const [reset,setReset]=useState(false),[word,setWord]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('')
  const [period,setPeriod]=useState<Period>('all'),[reportOptions,setReportOptions]=useState(false),[excelOptions,setExcelOptions]=useState(false)
  const [notifications,setNotifications]=useState(false),[notificationInfo,setNotificationInfo]=useState(false),[notificationError,setNotificationError]=useState(''),[notificationBusy,setNotificationBusy]=useState(false)
  useEffect(()=>{let cancelled=false;const refresh=()=>void getSetting('recoveryNotifications',true).then(v=>{if(cancelled)return;const granted='Notification' in window&&Notification.permission==='granted';setNotifications(v&&granted);if(granted)setNotificationError('')});refresh();if(open)window.addEventListener('focus',refresh);return()=>{cancelled=true;window.removeEventListener('focus',refresh)}},[open])
  const [feedbackOwner,setFeedbackOwner]=useState('')
  const fail=(e:unknown,owner='archive')=>{setFeedbackOwner(owner);setError(e instanceof Error?e.message:'Operazione non riuscita.')}
  const run=async(owner:string,operation:()=>Promise<void|boolean>,message='')=>{if(running.current)return;running.current=true;setFeedbackOwner(owner);setError('');setSuccess('');setGeneratedDownload(null);setBusy(true);try{const result=await operation();if(result!==false)setSuccess(message)}catch(e){fail(e,owner)}finally{running.current=false;setBusy(false)}}
  const backup=(owner='backup')=>run(owner,()=>exportWebBackup(),'Backup completo generato. Download avviato: controlla i file scaricati del browser.')
  const toggleNotifications=async()=>{
    if(notificationBusy)return;setNotificationBusy(true);setNotificationError('')
    try{
      if(notifications){await setSetting('recoveryNotifications',false);setNotifications(false);return}
      if(!window.isSecureContext)throw new Error('Le notifiche richiedono HTTPS. Questa anteprima sulla rete locale usa HTTP: il browser non può abilitarle qui.')
      if(!('Notification' in window))throw new Error('Questo browser non supporta le notifiche. Su iPhone prova GymSheet installata nella schermata Home.')
      const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission()
      if(permission!=='granted')throw new Error(permission==='denied'?'Notifiche bloccate. Riabilitale nelle impostazioni del browser o del sito.':'Permesso non concesso. Tocca ON per riprovare.')
      await setSetting('recoveryNotifications',true);setNotifications(true)
    }catch(e){setNotifications(false);setNotificationError(e instanceof Error?e.message:'Notifiche non abilitate.')}
    finally{setNotificationBusy(false)}
  }
  const feedback=(owner:string,includeDownload=true)=>feedbackOwner===owner?<div className="menu-feedback">{busy&&<p role="status">Preparazione in corso…</p>}{error&&<p className="error" role="alert">{error}</p>}{success&&<p className="operation-success" role="status">{success}</p>}{includeDownload&&generatedDownload&&<a className="generated-download" href={generatedDownload.url} download={generatedDownload.filename}>Scarica {generatedDownload.filename.endsWith('.gsw')?'backup':generatedDownload.filename.endsWith('.pdf')?'PDF':'file Excel'}</a>}</div>:null
  if(!open)return null
  if(file)return <SheetImportDialog file={file} onClose={()=>setFile(null)} onImported={()=>{setFile(null);onClose()}}/>
  return <SwipeDialog onClose={onClose} title="GymSheet" className="settings-sheet">
    <MenuAccordion title="Schede archiviate" subtitle="Apri una scheda precedente" icon={<MenuIcon kind="archive"/>} open={archive} onToggle={()=>setArchive(v=>!v)}><SheetArchive onClose={onClose} onError={fail}/>{feedback('archive')}</MenuAccordion>
    <MenuAccordion title="Carica nuova scheda" subtitle="Lo storico precedente resta salvato" icon={<MenuIcon kind="import"/>} open={importOptions} onToggle={()=>setImportOptions(v=>!v)}><p className="import-save-prompt">Salva lo storico prima di continuare</p><div className="menu-inline-actions"><button className="secondary" disabled={busy} onClick={()=>void run('import',async()=>{await exportHistoryPdf(undefined,period);excel.current?.click()})}><MenuIcon kind="download"/>Scarica PDF</button><button className="secondary" disabled={busy} onClick={()=>void run('import',async()=>{await exportHistoryExcel();excel.current?.click()})}><MenuIcon kind="download"/>Scarica Excel</button></div><button className="menu-text-action" disabled={busy} onClick={()=>excel.current?.click()}>Continua senza esportare</button>{feedback('import')}</MenuAccordion>
    <input hidden ref={excel} type="file" accept=".xlsx,.xls,.doc,.docx" onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f);e.target.value=''}}/>
    <section className="menu-section backup-section"><div className="menu-row"><MenuIcon kind="backup"/><span>Crea backup completo<small>Salva schede, storico e impostazioni</small></span></div>{feedbackOwner==='backup'&&generatedDownload?<a className="secondary backup-download" href={generatedDownload.url} download={generatedDownload.filename}><MenuIcon kind="download"/>Scarica backup</a>:<button className="secondary backup-download" disabled={busy} onClick={()=>void backup()}><MenuIcon kind="download"/>Scarica backup</button>}{feedback('backup',false)}</section>
    <MenuAccordion title="Ripristina backup Web" icon={<MenuIcon kind="restore"/>} open={restoreOptions} onToggle={()=>setRestoreOptions(v=>!v)}><p>Carica un backup creato con GymSheet.</p><button className="secondary" disabled={busy} onClick={()=>restore.current?.click()}>Seleziona backup</button>{feedback('restore')}</MenuAccordion>
    <input hidden ref={restore} type="file" accept=".gsw,application/json" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void run('restore',async()=>{if(!confirm('Ripristinare il backup? I dati attuali saranno sostituiti. Crea prima un backup se vuoi conservarli.'))return false;await restoreWebBackup(f);window.setTimeout(()=>location.reload(),1800)},'Backup ripristinato. Aggiornamento app…')}}/>
    <MenuAccordion title="Esporta storico in PDF" subtitle="Schede, settimane e allenamenti" icon={<MenuIcon kind="pdf"/>} open={reportOptions} onToggle={()=>setReportOptions(v=>!v)}><label>Periodo</label><PeriodFilter value={period} onChange={setPeriod}/><button className="secondary" disabled={busy} onClick={()=>void run('pdf',()=>exportHistoryPdf(undefined,period),'PDF generato. Download avviato.')}><MenuIcon kind="download"/>Scarica PDF</button>{feedback('pdf')}</MenuAccordion>
    <MenuAccordion title="Esporta storico in Excel" subtitle="Programmazione, serie e note" icon={<MenuIcon kind="sheet"/>} open={excelOptions} onToggle={()=>setExcelOptions(v=>!v)}><button className="secondary" disabled={busy} onClick={()=>void run('excel',()=>exportHistoryExcel(),'Excel generato. Download avviato.')}><MenuIcon kind="download"/>Scarica Excel</button>{feedback('excel')}</MenuAccordion>
    <section className="menu-section notification-section"><div className="menu-row"><MenuIcon kind="bell"/><span><span className="notification-title">Notifiche recupero <button className="notification-info" aria-label="Informazioni notifiche recupero" aria-haspopup="dialog" onClick={()=>setNotificationInfo(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 7v1"/></svg></button></span><small>Avvisami quando termina il timer</small></span><button className="notification-switch" role="switch" aria-label="Notifiche recupero" aria-checked={notifications} disabled={notificationBusy} onClick={()=>void toggleNotifications()}><span className="switch-track" aria-hidden="true"><i/></span><span className="switch-label">{notifications?'ON':'OFF'}</span></button></div>{notificationError&&<p className="error notification-error" role="alert">{notificationError}</p>}</section>
    <button className="menu-row" onClick={onHistory}><MenuIcon kind="clock"/><span>Riepilogo allenamenti</span></button>
    <MenuAccordion title="Cancella tutti i dati" icon={<MenuIcon kind="delete"/>} open={reset} danger onToggle={()=>{setReset(v=>!v);setWord('')}}><strong>Cancellazione definitiva</strong><p>Prima crea un backup. Poi scrivi ELIMINA.</p><button className="secondary" disabled={busy} onClick={()=>void backup('delete')}>Crea backup</button><input aria-label="Scrivi ELIMINA" value={word} onChange={e=>setWord(e.target.value)} placeholder="Scrivi ELIMINA"/><button className="danger-button" disabled={word!=='ELIMINA'||busy} onClick={()=>void run('delete',async()=>{await resetAllData();location.reload()})}>Cancella definitivamente</button>{feedback('delete')}</MenuAccordion>
    {notificationInfo&&<NotificationGuide onClose={()=>setNotificationInfo(false)}/>}
  </SwipeDialog>
}
