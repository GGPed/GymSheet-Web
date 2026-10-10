# GymSheet Web

PWA mobile-first, senza account o backend. Dati e storico restano locali al browser/dispositivo.

## Sviluppo e test locale

```sh
npm ci
npm run dev
```

Per il test smartphone compilare con `npm run build`, poi aprire `AVVIA-TELEFONO.cmd`.
Lo script rileva automaticamente l’IPv4 e mostra l’URL `/GymSheet-Web/` sulla porta 5185.

## Build production

```sh
npm run build
node scripts/check-pages-build.mjs
```

Le immagini ufficiali sono già in `public/exercises`; la build verifica i riferimenti senza scaricare o sostituire immagini.

## Pubblicazione Alpha

GitHub Pages: https://ggped.github.io/GymSheet-Web/

Il workflow GitHub Actions è **solo manuale**: nessun push o PR pubblica automaticamente.
Prima test locale, poi verifica, poi pubblicazione solo su richiesta esplicita. Vedere `DEPLOY.md`.

## Dati

Import Excel `.xlsx`/`.xls` e backup/ripristino Web. IndexedDB e localStorage sono locali a ogni origine e dispositivo.
Per trasferire dati dalla preview locale alla versione HTTPS usare un backup Web.
