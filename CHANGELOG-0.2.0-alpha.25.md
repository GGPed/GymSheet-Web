# 0.2.0-alpha.25 — Solo locale
- Colonne CARICO/RPE: nota prima settimana, senza campi kg o nuovo modello RPE. Note coach precedenti conservate.
- Import Excel riconosce anche blocchi LOWER/UPPER con REC e WEEK, mantenendo FULL BODY e tabulare esistenti.
- Indicazioni generali nel solo campo opzionale Sheet.coachNotes; nessun esercizio artificiale. Nuovi import Word usano lo stesso contenitore globale.
- Mobilita esistente confluisce nella sezione inline aperta/collassabile Riscaldamento & indicazioni coach, presente prima degli esercizi in ogni workout; immagini aprono la visualizzazione condivisa.
- QA Maria reale: 4 workout, 28 esercizi, 24 RPE, 6 settimane, promemoria finali integrali inclusa la dicitura post lower su A-D. RPE assente da settimana2, note abductor preservate; collasso54px a390px; avvio A 0/16 senza conteggi aggiuntivi.
- QA dati: RPE mai nei kg/Progressi, prefill30kg, backup/restore e riapertura; Luigi6 elementi Mobilita; audit Word/Excel/PDF/XLSX e prefill invariati; TypeScript/build/PWA superati.
- Nessun push o deploy; Alpha online rimane alpha.24.
- Verifica browser su database Luigi esistente: 6 contenuti riscaldamento presenti; immagine extra rotazione con elastico aperta/caricata (850px), sessione B invariata. Workout Maria di collaudo concluso con riepilogo 0/16.
