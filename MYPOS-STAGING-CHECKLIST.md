# myPOS Sandbox — piano di verifica (non produzione)

Questa branch non deve essere collegata al servizio Render di produzione. Non fare merge in main prima dei test.

## Ambiente di staging
- Creare **un nuovo servizio Render** da branch `test-mypos-sandbox`, con URL distinto.
- Impostare `MYPOS_STAGING_ONLY=true` e `MYPOS_SANDBOX_ENABLED=true` soltanto sul servizio di prova.
- Impostare `MYPOS_PUBLIC_BASE_URL` con l'origine HTTPS dello staging, senza slash finale.
- Usare `DATA_DIR` separata da produzione e `BRIDGE_KEY` diversa da quella del negozio. In staging il bridge è disabilitato anche con chiave valida.
- Inserire `MYPOS_SANDBOX_PRIVATE_KEY` e `MYPOS_SANDBOX_API_PUBLIC_KEY` solo nei Secret/Environment di Render; mai in GitHub, screenshot o chat.
- Verificare con la documentazione ufficiale myPOS **prima di attivare**: URL di test, SID/WalletNumber di prova, ordine e nomi dei campi, firma RSA, struttura e stati delle notifiche, esatto corpo della risposta OK.
- Attenzione: il codice attuale di notifica non è ancora approvato per la produzione; richiede confronto con un esempio ufficiale di callback e test end-to-end.

## Verifiche richieste
1. `npm test` e `node --check server.js`.
2. Ordine tradizionale: funziona come prima sul ramo di prova, senza collegamento al bridge del negozio.
3. Ordine myPOS non pagato: resta `awaiting_payment`, non è stampabile.
4. Notifica con firma errata, importo diverso, valuta diversa, negozio diverso, ordine sconosciuto: rifiutata.
5. Notifica reale di successo Sandbox: ordine diventa `pending` solo se verificata; duplicati non generano stampe duplicate.
6. Annullamento, errore e scadenza: mai segnati come pagati.
7. Pagina di ritorno: non dichiara un pagamento confermato senza notifica.
8. Ripetere prova completa prima di qualsiasi decisione sulla produzione.

**Non attivare pagamenti reali o pubblicare su main finché queste verifiche non sono superate.**
