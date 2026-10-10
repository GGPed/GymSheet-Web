## 0.2.0-alpha.6

- Recupero persistente come fonte centrale del blocco operativo, anche con timer minimizzato.
- Completamento serie e inizio recupero salvati nella stessa transazione: azioni concorrenti rifiutate e dati preservati.
- Kg/reps, superset, annullamento, note modificabili e conclusione bloccati; consultazione e scroll disponibili.
- Sblocco automatico a scadenza o con Salta recupero; feedback deduplicato e notifiche invalidate dopo salto.
- Test di concorrenza, persistenza, scadenza/salto e rendering superati.
