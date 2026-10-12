import { useRef, useState } from 'react'
import { SheetImportDialog } from './SheetImportDialog'
import { restoreWebBackup } from '../services/backup'

export function Onboarding() {
  const excel = useRef<HTMLInputElement>(null)
  const restore = useRef<HTMLInputElement>(null)
  const [excelFile,setExcelFile]=useState<File|null>(null)
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
      <div className="welcome-icon"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H5v18h14V8l-5-5Z M14 3v5h5 M8 14h8 M12 10l4 4-4 4"/></svg></div>
      <h2>Importa la scheda</h2>
      <p>Schede Excel <strong>.xlsx / .xls</strong> o Word <strong>.docx / .doc</strong>, con workout da A a G.</p>
      <button className="primary" disabled={busy} onClick={() => excel.current?.click()}>Importa scheda</button>
      <input ref={excel} hidden type="file" accept=".xlsx,.xls,.doc,.docx" onChange={(e) => { const file=e.target.files?.[0]; if(file)setExcelFile(file);e.target.value='' }} />
      <div className="or"><span />oppure<span /></div>
      <button className="secondary" disabled={busy} onClick={()=>restore.current?.click()}>Ripristina backup Web</button>
      <input hidden ref={restore} type="file" accept=".gsw,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void run(()=>restoreWebBackup(file))}}/>
      {busy && <p className="status">Sto importando…</p>}
      {error && <p className="error">{error}</p>}
    </section>
    {excelFile&&<SheetImportDialog file={excelFile} onClose={()=>setExcelFile(null)} onImported={()=>setExcelFile(null)}/>}
  </main>
}
