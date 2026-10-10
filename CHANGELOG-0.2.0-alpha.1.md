# GymSheet Web 0.2.0-alpha.1
- Settimane iniziali dall'Excel reale, aggiunta e persistenza della settimana successiva.
- Riepilogo con durata, miglioramenti concreti, obiettivi coach, settimana e streak allenamenti.
- Pagina Progressi completa: periodi, grafici carico, reps separate, eventi, suggerimenti e confronto sessioni.
- Report PDF con grafici e calcoli condivisi con Progressi; scelta del periodo anche dal menu.
- Pannelli minimizzabili con stato preservato; timer continua durante la minimizzazione.
- Feedback aptico limitato ai cinque eventi richiesti, con protezione dai duplicati.

Verifica automatica: parser Excel reale, aggiunta settimane, motore progressi, filtri, streak, backup/ripristino, migrazione Android, archivio e snapshot. Report PDF generato e controllato visivamente su dati sintetici.
La verifica fisica delle gesture e delle vibrazioni sul telefono resta da effettuare. Le notifiche in background dipendono dalle funzionalità e dalla sospensione del browser.

Avvio telefonico locale: doppio clic su AVVIA-TELEFONO.cmd. Telefono e PC sulla stessa Wi-Fi; aprire l’URL completo stampato nella finestra. L’IPv4 viene rilevato a ogni avvio; il server ascolta su 0.0.0.0:5185. In HTTP locale installazione PWA e notifiche richiedono invece una pubblicazione HTTPS.
La pubblicazione privata Sites è stata autorizzata dall'utente ma è bloccata dal controllo automatico del passaggio stdin al workflow. Nessuna versione Sites è stata pubblicata.
