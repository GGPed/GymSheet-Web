# GymSheet Web

PWA mobile-first di GymSheet, ricostruita dalla versione Android 0.3.6.

## Stack

React + TypeScript + Vite, Dexie/IndexedDB, SheetJS, sql.js e vite-plugin-pwa.

## Sviluppo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

La build scarica localmente le immagini esercizio usate dalla versione Android e le include negli asset PWA/offline.

## Dati

I dati restano nel browser/dispositivo. Sono supportati import Excel `.xlsx`/`.xls`, backup Web e migrazione una tantum dai backup Android `.gsb`.
