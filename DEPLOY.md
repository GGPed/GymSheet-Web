# Pubblicazione Alpha

URL standard: https://ggped.github.io/GymSheet-Web/

La pubblicazione usa solo il workflow manuale **Publish approved Alpha to GitHub Pages**.
Non sono presenti trigger push, pull_request, tag o pianificazioni.

Flusso obbligatorio per ogni BUG/CR:
1. Modificare e compilare in locale.
2. Testare da smartphone usando AVVIA-TELEFONO.cmd.
3. Attendere verifica e richiesta esplicita di pubblicazione.
4. Solo allora sincronizzare la versione approvata e avviare manualmente il workflow su main.

In Settings → Pages la source deve essere GitHub Actions, senza dominio personalizzato.
Il build usa npm ci, npm run build e un controllo degli asset/manifest.
Il job deploy pubblica lo stesso artifact generato dal job build.

IndexedDB e localStorage rimangono sul singolo dispositivo/origine. Il server locale e
GitHub Pages sono origini diverse: per trasferire dati usare backup Web e ripristino.
Non pubblicare Excel personali, backup, database, node_modules o file di test con dati utente.
