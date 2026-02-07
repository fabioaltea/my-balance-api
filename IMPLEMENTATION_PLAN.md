# Piano Implementazione Backend - Ottimizzazione MyBalance

## Contesto

Questo piano fa parte dell'ottimizzazione complessiva del caricamento iniziale di MyBalance. Il backend deve fornire endpoint più granulari e ottimizzati per ridurre il payload e migliorare le performance.

**Piano completo**: `/Users/fabioaltea/.claude/plans/concurrent-purring-deer.md`

## Obiettivi Backend

1. **Ridurre payload**: Da ~500KB a ~50KB per uso tipico
2. **Endpoint filtrati**: Supporto query parameters per transactions
3. **Aggregazioni pre-calcolate**: Dati pronti per grafici senza invio transazioni dettagliate
4. **Delta updates**: Sincronizzazione incrementale delle modifiche

## Fase 1: Backend - Endpoint Granulari

### 1.1 Filtri Query su Transactions

**File**: `/api/src/helpers/mybalance/transactions.helper.ts`

Modificare `listTransactions()` per accettare parametri di filtro:

```typescript
// GET /transactions?from_date=01-01-2024&to_date=31-12-2024&account=Conto&limit=100
```

**Query parameters supportati**:
- `from_date`: dd-MM-yyyy (default: ultimi 12 mesi)
- `to_date`: dd-MM-yyyy (default: oggi)
- `account`: nome account (default: tutti)
- `category`: nome categoria (default: tutti)
- `type`: "in" | "out" (default: tutti)
- `status`: "Confirmed" | "recurrent" | "unconfirmed" (default: non DELETED)
- `limit`: numero risultati (default: 100, max: 1000)
- `offset`: paginazione (default: 0)

**Implementazione**:
- Scaricare comunque tutto il foglio da Google Sheets (limitation API)
- Filtrare in memoria prima di restituire
- Aggiungere parsing e validazione parametri

**Beneficio**: Riduzione payload da ~500KB a ~50KB per uso tipico

**Stime**: +80 linee di codice

### 1.2 Endpoint Summary/Aggregazioni

**File nuovo**: `/api/src/helpers/mybalance/aggregations.helper.ts`

```typescript
// GET /aggregations/monthly?from_date=01-01-2024&to_date=31-12-2024
// Returns: {
//   "2024-01": { income: 3500, expense: 2800, balance: 700, count: 45 },
//   "2024-02": { income: 3200, expense: 3100, balance: 100, count: 52 },
//   ...
// }
```

Pre-calcola aggregazioni mensili per grafici senza inviare transazioni dettagliate.

**Beneficio**: Grafici ricevono dati pronti (~1-2KB vs 500KB)

**Stime**: ~200 linee di codice

### 1.3 Account Balances Ottimizzato

**File**: `/api/src/helpers/mybalance/accounts.helper.ts`

Aggiungere parametro `?calculate_balance=false`:
- Se false: usa balance dal foglio Accounts (veloce)
- Se true: calcola da tutte le transazioni (accurato ma lento)

**Beneficio**: Evita di scaricare tutte le transazioni solo per avere i saldi

**Stime**: +20 linee di codice

### 1.4 Endpoint Delta

**File**: `/api/src/helpers/mybalance/transactions.helper.ts`

```typescript
// GET /transactions/delta?since=2024-12-01T10:30:00
// Returns: Transaction[] filtrate per dateModified > since
```

Sfrutta colonna `dateModified` già presente.

**Beneficio**: Successive sync scaricano solo modifiche

**Stime**: +50 linee di codice

### 1.5 Aggiornamento Routes

**File**: `/api/src/index.ts` (o file routes dedicato)

- Aggiungere route `/aggregations/monthly`
- Verificare che parametri query siano passati correttamente agli helper
- Mantenere backward compatibility (parametri opzionali)

**Stime**: +50 linee di codice

## File da Modificare/Creare

### File da Modificare
1. `/api/src/helpers/mybalance/transactions.helper.ts` - aggiungere filtri e endpoint delta
2. `/api/src/helpers/mybalance/accounts.helper.ts` - parametro calculate_balance
3. `/api/src/index.ts` (o routes) - nuove route

### File da Creare
4. `/api/src/helpers/mybalance/aggregations.helper.ts` - **NUOVO** per aggregazioni mensili

## Metriche di Successo Backend

| Metrica | Baseline | Target |
|---------|----------|--------|
| Payload transactions (filtrate) | 500KB | 50KB |
| Payload aggregazioni | N/A | 1-2KB |
| Response time transactions | 300-500ms | 200-300ms |
| Response time aggregazioni | N/A | 100-200ms |

## Note Implementative

### Backward Compatibility

- Tutti i parametri query sono **opzionali**
- Se non specificati, comportamento rimane come versione originale
- Versione Ionic continua a funzionare senza modifiche

### Testing

1. **Unit tests**: Validazione parametri, filtri in memoria
2. **Integration tests**: Test endpoint con vari parametri di filtro
3. **Load tests**: Verificare performance con 5000 transactions

### Google Sheets API Considerations

- Rate limit: 100 requests/100 sec per utente
- Sempre query full sheet (limitation API)
- Filtri applicati in-memory dopo fetch
- Future: considerare Redis cache per v2

## Rischi

### Rischio 1: Google Sheets API Limits
**Problema**: Rate limit per alto volume requests
**Mitigazione**: Accettabile per uso personale (basso volume)

### Rischio 2: Performance Filtri In-Memory
**Problema**: Filtrare 5000 transactions in-memory potrebbe essere lento
**Mitigazione**: JavaScript molto veloce per operazioni semplici (filter/reduce), ~10-20ms per 5k items

## Verifica End-to-End

Dopo implementazione:

1. **Test filtri transactions**:
   - GET `/transactions?from_date=01-01-2024&to_date=31-01-2024&limit=10`
   - Verificare payload ridotto
   - Verificare dati corretti

2. **Test aggregazioni**:
   - GET `/aggregations/monthly?from_date=01-01-2024&to_date=31-12-2024`
   - Verificare formato risposta
   - Verificare correttezza calcoli (somme income/expense)

3. **Test delta**:
   - Modificare una transaction
   - GET `/transactions/delta?since=[timestamp]`
   - Verificare solo transaction modificata ritorna

4. **Test account balances**:
   - GET `/accounts?calculate_balance=false`
   - Verificare risposta veloce
   - Confrontare con `calculate_balance=true` per accuratezza

## Stima Totale

- **Giorni**: 3 giorni (part-time, 4h/giorno)
- **Rischio**: Basso
- **LOC**: ~400 linee (200 nuove + 200 modifiche)

## Prossimi Step

Dopo completamento backend:
1. Frontend può iniziare integrazione React Query (Fase 2)
2. Testing congiunto endpoint + frontend
3. Deploy backend in staging per test isolati
