# Configurazione e verifica ChatGPT

## Prerequisiti

- Client OpenAI registrato per MyBalance hosted e autorizzazione esplicita all’uso del piano.
- Callback registrato sull’origine AuthService: `/integrations/chatgpt/callback`.
- Node 20 o successivo per API/AuthService; Expo richiede almeno Node 20.19.4.
- Migrazioni utenti/sessioni già presenti, inclusa la migrazione notifiche/sessioni 005.
- Domini frontend/AuthService sullo stesso sito quando possibile. Il POST autorizzato imposta
  un cookie HttpOnly via `credentials:include`; il browser deve poterlo accettare e restituire
  al callback. Cookie di terze parti bloccati possono impedire il collegamento tra siti distinti.
- Origin del frontend consentita dal CORS AuthService e configurazione HTTPS in produzione.

## Migrazioni

Sul database AuthService applicare `AuthService/migrations/006-chatgpt-integration.sql`.
Sul database MyBalance applicare `MyBalance/api/sql/migrations/006-chatgpt-preferences.sql`.
Le migrazioni sono idempotenti e sono state provate su uno schema temporaneo con dati sintetici.
Possono risiedere nello stesso database, ma le credenziali sono gestite soltanto da AuthService.

Da ciascun servizio, con la connessione corretta già impostata nella shell:

```sh
# AuthService
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/006-chatgpt-integration.sql
# MyBalance/api
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/migrations/006-chatgpt-preferences.sql
```

## Variabili

Usare `AuthService/chatgpt.env.example` e `MyBalance/api/chatgpt.env.example` come riferimento.
I file example non sono caricati automaticamente: inserire i valori nella configurazione
server già utilizzata dai servizi. Non copiare segreti in variabili `EXPO_PUBLIC_*`.

| AuthService | Valore |
| --- | --- |
| `CHATGPT_ENABLED` | `false` finché il deployment e i controlli non sono pronti |
| `CHATGPT_PLAN_USAGE_APPROVED` | `true` soltanto dopo conferma OpenAI per questo client hosted |
| `CHATGPT_CLIENT_ID` | Client registrato `oaiapp_…` fornito da OpenAI |
| `CHATGPT_REDIRECT_URI` | URL esatto registrato, con path `/integrations/chatgpt/callback` |
| `CHATGPT_RETURN_URL` | URL fisso del frontend, normalmente `https://APP_HOST/dashboard` |
| `CHATGPT_TOKEN_AUTH_METHOD` | `none` o `client_secret_basic`, secondo provisioning |
| `CHATGPT_CLIENT_SECRET` | Solo per il client confidential, conservato sul server |
| `CHATGPT_PLAN_SCOPE` | Scope che abilita l’uso del piano, da confermare con OpenAI |
| `CHATGPT_SCOPES` | Scope completi autorizzati, inclusi identità, rinnovo e uso del piano |
| `CHATGPT_SERVICE_SECRET` | Secret casuale condiviso con MyBalance API, almeno 32 caratteri |
| `ENCRYPTION_KEY` | Chiave AES esistente di AuthService, 64 caratteri esadecimali |

La resource è `https://api.openai.com/v1`. Gli scope di default sono
`openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`.
Confermare il contratto hosted ricevuto da OpenAI prima di usare tali default.

MyBalance API richiede `AUTH_SERVICE_URL` e lo stesso `CHATGPT_SERVICE_SECRET`. L’URL deve
identificare il servizio senza prefissi di path aggiuntivi, coerente con la configurazione attuale.
Il frontend continua a usare `EXPO_PUBLIC_AUTH_URL` e `EXPO_PUBLIC_API_URL` esistenti.

## Deployment e prova reale

1. Applicare le migrazioni e configurare le variabili mantenendo i flag disabilitati.
2. Eseguire build e distribuire AuthService, API MyBalance e frontend della stessa versione.
3. Verificare callback registrato, dominio cookie/CORS e metodo client con OpenAI.
4. Attivare i due flag su AuthService per il client approvato.
5. In MyBalance aprire logo → Manage → Integrazioni AI → Continue with ChatGPT.
6. Concedere i permessi e verificare il ritorno a Manage con l’account corretto.
7. Confermare il primo utilizzo, scegliere un modello e avviare “Prova collegamento”.
   La prova consuma utilizzo del piano e deve mostrare una risposta completata.
8. Verificare selezione di un secondo account, riconnessione, disconnessione e gestione utilizzo.

Non applicare la migrazione o attivare i flag su produzione senza la normale procedura di
deployment del progetto. Il codice non esegue migrazioni o modifiche alle variabili automaticamente.

## Test ripetibili

```sh
# AuthService, dopo la compilazione (i test ChatGPT importano gli artefatti dist)
npm run build
node --test tests/*.test.cjs
# URL di un database riservato ai test; il test crea e rimuove un proprio schema.
CHATGPT_TEST_DATABASE_URL="$TEST_DATABASE_URL" node --test tests/chatgpt-postgres.integration.cjs

# MyBalance/api
npm run build
node --test tests/*.test.cjs

# MyBalance/expo
./node_modules/.bin/tsc --noEmit
node --test tests/*.test.cjs
CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web
```

La suite PostgreSQL verifica cookie/callback HTTP, consumo singolo, scadenza, nonce, identità
errata, isolamento, rinnovi concorrenti, revoca concorrente, errori terminali/temporanei e firma
interna con protezione dai replay. I provider OpenAI sono simulati; non serve una API key.

Verifica del 18 ottobre 2026: 29 test frontend, 14 test API, 6 test AuthService e 13 verifiche
nella suite PostgreSQL superati. Superati anche typecheck dei tre progetti, lint dei file
frontend dell’integrazione, compilazione API/AuthService ed export web Expo con Node 22.19.0.
Entrambe le migrazioni sono state applicate due volte su schemi temporanei per verificarne
l’idempotenza; verificate anche persistenza e isolamento delle preferenze modello.
Il PostgreSQL temporaneo è stato fermato al termine. Nessuna migrazione è stata applicata ai
database reali e nessuna credenziale OpenAI è stata configurata. La verifica reale del provider
e la prova visuale interattiva nel browser restano da eseguire nell’ambiente autorizzato.

## Diagnostica

- “Da attivare”: controllare flag, client, callback, secret servizio e chiave AES.
- “Stato non disponibile”: verificare che il frontend raggiunga la route su AuthService,
  che la migrazione sia presente e che la sessione abbia `sessionId`, `deviceId` e prodotto MyBalance.
- `CHATGPT_INVALID_ATTEMPT`: avviare un nuovo tentativo; verificare cookie, SameSite, dominio,
  scadenza, callback esatto e tentativi avviati da un’altra scheda.
- `permission_required`: l’identità è collegata ma manca lo scope del piano; riconnettere e
  concedere il permesso. Se il client non è abilitato, verificare il provisioning OpenAI.
- `reauth_required`: sessione provider non più rinnovabile; ricollegare l’account selezionato.
- `revocation_pending`: l’uso nell’app è disabilitato; riprovare la revoca dalla UI o disconnettere
  l’app nelle impostazioni ChatGPT. Non indicare revoca riuscita prima della conferma remota.
- Errori limiti: aprire “Gestisci utilizzo”; nessun consumo residuo o reset viene inventato.
- Errore interno 403: verificare secret identico, orologi sincronizzati e JWT delegato corretto.

I log applicativi di AuthService registrano il path senza query string, per non scrivere i
codici OAuth. Applicare la stessa esclusione ai log di accesso del reverse proxy per il callback.
Non registrare body OAuth, firme di servizio, header Authorization o payload delle credenziali.

Per disabilitare l’integrazione impostare `CHATGPT_ENABLED=false` su AuthService. I dati restano
conservati cifrati; riattivare con gli stessi parametri per consentire la disconnessione dal
servizio o revocare l’accesso direttamente dalle impostazioni ChatGPT.
