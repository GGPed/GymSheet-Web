import { useRef, useState } from 'react'
import { installParsedSheet, resetAllData, setSetting } from '../db'
import type { ThemePreference } from '../types'
import { migrateAndroidBackup } from '../services/androidBackup'
import { exportWebBackup, restoreWebBackup } from '../services/backup'
import { parseExcelFile } from '../services/excel'

interface Props { open: boolean; onClose: () => void; theme: ThemePreference; onTheme: (theme: ThemePreference) => void }

export function SettingsSheet({ open, onClose, theme, onTheme }: Props) {
  const excel = useRef<HTMLInputElement>(null), restore = useRef<HTMLInputElement>(null), android = useRef<HTMLInputElement>(null)
  const [reset, setReset] = useState(false), [word, setWord] = useState('')
  if (!open) return null
  return <div className="sheet-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose() }}>
    <section className="bottom-sheet">
      <div className="sheet-handle" />
      <h2>GymSheet</h2><p className="muted">Dati, tema e backup</p>
      <div className="setting-block"><label>Tema</label><div className="segmented">
        {(['system','light','dark'] as ThemePreference[]).map((item) => <button className={theme===item?'active':''} key={item} onClick={() => { onTheme(item); void setSetting('theme', item) }}>{item==='system'?'Auto':item==='light'?'Chiaro':'Scuro'}</button>)}
      </div></div>
      <button className="menu-row" onClick={() => excel.current?.click()}>↥ <span>Importa nuova scheda Excel<small>Lo storico precedente resta salvato</small></span>›</button>
      <input hidden ref={excel} type="file" accept=".xlsx,.xls" onChange={(e)=>{const f=e.target.files?.[0];if(f)void parseExcelFile(f).then(installParsedSheet).then(onClose)}} />
      <button className="menu-row" onClick={() => void exportWebBackup()}>⤓ <span>Crea backup completo<small>Consigliato: i dati vivono solo su questo dispositivo</small></span>›</button>
      <button className="menu-row" onClick={() => restore.current?.click()}>↻ <span>Ripristina backup Web</span>›</button>
      <input hidden ref={restore} type="file" accept=".gsw,application/json" onChange={(e)=>{const f=e.target.files?.[0];if(f)void restoreWebBackup(f).then(()=>location.reload())}} />
      <button className="menu-row" onClick={() => android.current?.click()}>A <span>Migra backup Android<small>Conversione una tantum del file .gsb</small></span>›</button>
      <input hidden ref={android} type="file" accept=".gsb,application/octet-stream" onChange={(e)=>{const f=e.target.files?.[0];if(f)void migrateAndroidBackup(f).then(onClose)}} />
      <button className="menu-row danger" onClick={() => setReset(true)}>! <span>Cancella tutti i dati</span>›</button>
      {reset && <div className="danger-zone"><strong>Cancellazione definitiva</strong><p>Prima crea un backup. Poi scrivi <b>ELIMINA</b> per cancellare schede, storico e impostazioni.</p><button className="secondary" onClick={() => void exportWebBackup()}>Crea backup prima</button><input value={word} onChange={(e)=>setWord(e.target.value)} placeholder="Scrivi ELIMINA" /><button className="danger-button" disabled={word!=='ELIMINA'} onClick={() => void resetAllData().then(()=>location.reload())}>Cancella definitivamente</button></div>}
    </section>
  </div>
}
