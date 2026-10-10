# GymSheet Web 0.2.0-alpha.5 — Bug report consolidato
- Tema primo blocco; accordion del menu centralizzati con espansione nella stessa card e layout compatto per import, restore, PDF, Excel e cancellazione.
- Backup completo letto in una transazione coerente; download con link allegato al documento, feedback e link esplicito di salvataggio per backup/Excel.
- Notifiche: info accanto al titolo, switch a destra, errori nella stessa card e aggiornamento dello stato al ritorno dal browser.
- Progressi: riepilogo a tre colonne, stato +/− accordion, thumbnail identiche alla scheda, CTA Vai al dettaglio.
- Dettaglio senza esecuzioni: messaggio dedicato e nessun grafico/asse/scala fittizia; anche il report evita grafici privi di carichi.
- Dati e compatibilità esistenti preservati. Nessuna evolutiva fuori scope.

Verifiche: TypeScript/build PWA; Excel reale, snapshot, backup/restore e rollback; contenuto backup e gestione errori download; motore Progressi/report; pannelli; accordion, protezione cancellazione e stati vuoti su viewport 390x844.

Limiti della preview: il link HTTP LAN non permette notifiche web (serve HTTPS). Il browser integrato non restituisce l'evento di download: il salvataggio finale va verificato sul telefono tramite il link esplicito.
Preview: http://192.168.1.7:5185/GymSheet-Web/ sulla stessa Wi-Fi, finestra AVVIA-TELEFONO.cmd aperta.
