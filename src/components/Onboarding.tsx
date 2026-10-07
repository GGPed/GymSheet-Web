import { useRef, useState } from 'react'
import { installParsedSheet } from '../db'
import { migrateAndroidBackup } from '../services/androidBackup'
import { parseExcelFile } from '../services/excel'

export function Onboarding() {
  const excel = useRef<HTMLInputElement>(null)
  const android = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Import non riuscito.') } finally { setBusy(false) }
  }

  return <main className="onboarding">
    <div className="brand-pill">GYMSHEET</div>
    <h1>La tua scheda.<br />Senza fronzoli.</h1>
    <p className="lead">Tutto resta sul telefono. Funziona offline e non serve un account.</p>
    <section className="welcome-card">
      <div className="welcome-icon">↥</div>
      <h2>Importa la scheda</h2>
      <p>File Excel <strong>.xlsx</strong> o <strong>.xls</strong> con blocchi FULL BODY, REC, WEEK e Note.</p>
      <button className="primary" disabled={busy} onClick={() => excel.current?.click()}>Importa Excel</button>
      <input ref={excel} hidden type="file" accept=".xlsx,.xls" onChange={(e) => { const file=e.target.files?.[0]; if(file) void run(async()=>installParsedSheet(await parseExcelFile(file))) }} />
      <div className="or"><span />oppure<span /></div>
      <button className="secondary" disabled={busy} onClick={() => android.current?.click()}>Migra da GymSheet Android</button>
      <input ref={android} hidden type="file" accept=".gsb,application/octet-stream" onChange={(e) => { const file=e.target.files?.[0]; if(file) void run(()=>migrateAndroidBackup(file)) }} />
      {busy && <p className="status">Sto importando…</p>}
      {error && <p className="error">{error}</p>}
    </section>
    <details className="format-help"><summary>Formato file Excel</summary><p>Usa uno o più blocchi con intestazioni <b>FULL BODY</b>, <b>REC</b>, <b>WEEK 1…10</b> e <b>Note</b>. GymSheet riconosce anche la sezione Mobilità.</p></details>
  </main>
}
