# V9 myPOS — checklist di attivazione controllata

Stato: **NON ATTIVARE** finché i punti di collaudo non sono completati.

## Verifiche già effettuate
- GitHub Actions: 12 test automatici superati (test con chiavi RSA sintetiche).
- Il callback di conferma è server-to-server `IPCPurchaseNotify`, con verifica firma, SID, valuta, importo e riferimento ordine.
- Il server risponde con HTTP 200 e corpo `OK` dopo la conferma.
- La pagina di ritorno del cliente non è prova di pagamento.
- La stampa delle comande myPOS richiede stato `paid` verificato.

## Prima del collaudo reale
1. Verificare che il pacchetto **reale** myPOS sia compatibile con i campi `sid,cn,pk,pc,idx` (senza esporlo in chat o GitHub).
2. Inserire il pacchetto soltanto come variabile segreta `MYPOS_CONFIGURATION_PACKAGE` in Render, sul servizio corretto. Non pubblicare screenshot con il valore.
3. Verificare le impostazioni del negozio myPOS, l'indice della chiave e la raggiungibilità HTTPS di `/api/mypos/notify`.
4. Collaudare un pagamento di piccolo importo e verificare sul pannello myPOS l'effettivo accredito.
5. Verificare una sola stampa della comanda e l'idempotenza delle notifiche duplicate.
6. Verificare pagamento annullato, callback errato e pagamento non completato: nessuna stampa.
7. Verificare che la modalità pagamento al ritiro continui a funzionare.
8. Preparare una procedura di rollback e riapertura controllata.

## Vincoli
- Non effettuare merge della PR #1 o deploy su produzione prima del collaudo e di una decisione esplicita.
- Mantenere `ORDERS_CLOSED=true` fino all'autorizzazione all'apertura.
- Non modificare o disattivare la V8 funzionante come misura di collaudo.
- Mai committare chiavi private, pacchetti Base64 o credenziali.

Documentazione di riferimento:
- https://developers.mypos.com/apis/checkout-api/purchase
- https://developers.mypos.com/apis/checkout-api/purchase-notify
- https://developers.mypos.com/apis/checkout-api/purchase-notify-ok
