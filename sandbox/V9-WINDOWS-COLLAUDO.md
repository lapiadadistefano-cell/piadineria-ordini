# V9 Windows — piano di collaudo senza rischio

Questo documento riguarda **solo il laboratorio** sul ramo `test-mypos-sandbox`.
Non sostituisce `AVVIA_BRIDGE_ONLINE_V8` e non modifica il PC del negozio.

## Stato verificato
- Test myPOS sandbox automatici superati.
- Test PostgreSQL 16 temporaneo superati: conferma stampa, retry manuale, presa in carico atomica, persistenza e rifiuto di ordini non fittizi.
- Bridge PowerShell V9 offline testato su Windows GitHub Actions: nessuna rete e nessuna stampante.
- Servizio Render Sandbox pubblicato; il collaudo autenticato end-to-end sul database Render non è ancora concluso.

## Condizioni prima del primo test con la Rongta
1. Eseguire un controllo di sola lettura autorizzato verso il server Sandbox, senza condividere chiavi in chat, script o log.
2. Collegare V9 a una coda di **sole comande sintetiche** e impedire la lettura degli ordini reali.
3. Verificare manualmente indirizzo IP, porta, protocollo ESC/POS e taglio carta della Rongta in una finestra di prova.
4. Eseguire una sola comanda di prova e controllare il risultato fisico.
5. Simulare interruzione dopo l'invio e prima della conferma: la comanda deve entrare in revisione manuale, mai ristampare automaticamente.
6. Verificare le due decisioni manuali, l'audit e il blocco dei duplicati dopo riavvio.
7. Conservare V8 come unico processo operativo finché il collaudo non è completato e autorizzato.

## Divieti per il laboratorio
- Non avviare due bridge sulla stessa coda o stampante.
- Non riutilizzare la chiave V8 per V9.
- Non disattivare la protezione del database o rendere pubblici endpoint di stampa.
- Non trattare un ritorno del browser myPOS come prova di pagamento.
- Non attivare automaticamente V9 all'avvio di Windows.

**Nota:** la stampa fisica esattamente una volta non può essere garantita dopo un'interruzione nel punto tra stampa e conferma. In caso di dubbio serve verifica manuale.
