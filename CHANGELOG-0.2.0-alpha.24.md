# 0.2.0-alpha.24 — Locale
- Kg preparabili prima del workout; reps/completamento conservano i vincoli precedenti.
- Prefill atomico solo all'avvio: ultima sessione reale dello stesso esercizio/dayId/sheetId, serie per serie; fallback ultimo carico realmente usato per serie aggiunte.
- Valori manuali (anche svuotati) protetti; post-workout legge snapshot aggiornati. Superset conserva carichi delle componenti disponibili.
- Carichi preparati non generano esecuzioni Progressi; nessuna propagazione a settimane future.
- QA: 8 scenari tramite IndexedDB isolato, recovery lock e superset; browser 390px modifica kg preavvio e persistenza refresh, console senza errori; TypeScript/Vite/PWA e audit import/backup/restore/PDF/XLSX superati.
- Nessuna pubblicazione GitHub Pages.
