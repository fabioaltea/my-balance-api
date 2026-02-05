# API Usage Examples - Performance Endpoints

This document provides practical examples of using the new performance-optimized endpoints.

## Authentication

All endpoints require authentication. Include your JWT token in the Authorization header:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

## Example 1: Get Account Balances Only

**Request:**
```bash
curl -X GET "https://your-api.com/accounts/balances" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "acc_1_Checking",
      "name": "Checking",
      "balance": "€ 2,345.67"
    },
    {
      "accountId": "acc_2_Savings",
      "name": "Savings",
      "balance": "€ 10,000.00"
    },
    {
      "accountId": "acc_3_Credit_Card",
      "name": "Credit Card",
      "balance": "€ -1,234.56"
    }
  ]
}
```

---

## Example 2: Get Recent Transactions (First Page)

**Request:**
```bash
curl -X GET "https://your-api.com/transactions?page=1&limit=20&sort=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "transactionId": "tx1704110400123",
      "movementId": "mov1704110400456",
      "description": "Grocery Shopping",
      "category": "FOOD",
      "amount": "-85.42",
      "date": "01-02-2024",
      "type": "out",
      "account": "Checking",
      "status": "Confirmed",
      "notes": "",
      "location": "Supermarket",
      "dateAdded": "01-02-2024 14:30",
      "dateModified": "01-02-2024 14:30"
    },
    {
      "transactionId": "tx1704024000789",
      "movementId": "mov1704024000012",
      "description": "Salary",
      "category": "INCOME",
      "amount": "3500.00",
      "date": "31-01-2024",
      "type": "in",
      "account": "Checking",
      "status": "Confirmed",
      "notes": "Monthly salary",
      "location": "",
      "dateAdded": "31-01-2024 00:05",
      "dateModified": "31-01-2024 00:05"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 456,
    "totalPages": 23,
    "hasMore": true
  }
}
```

---

## Example 3: Get Transactions for Specific Date Range

**Request:**
```bash
curl -X GET "https://your-api.com/transactions?startDate=01-01-2024&endDate=31-01-2024&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    // Transactions from January 2024 only
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 87,
    "totalPages": 2,
    "hasMore": true
  }
}
```

---

## Example 4: Get Transaction Summary

**Request:**
```bash
curl -X GET "https://your-api.com/transactions/summary" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCount": 523,
    "dateRange": {
      "start": "01-01-2024",
      "end": "05-02-2024"
    },
    "totalIncome": 14000.00,
    "totalExpense": 8756.43,
    "netBalance": 5243.57,
    "byAccount": {
      "Checking": {
        "count": 387,
        "total": 3456.78
      },
      "Savings": {
        "count": 24,
        "total": 1500.00
      },
      "Credit Card": {
        "count": 112,
        "total": -2345.67
      }
    },
    "byCategory": {
      "INCOME": {
        "count": 5,
        "total": 14000.00
      },
      "FOOD": {
        "count": 156,
        "total": -3245.67
      },
      "RENT": {
        "count": 1,
        "total": -1200.00
      },
      "TRANSPORT": {
        "count": 78,
        "total": -456.89
      },
      "ENTERTAINMENT": {
        "count": 45,
        "total": -789.12
      }
    }
  }
}
```

---

## Example 5: Get Transaction Summary for Specific Month

**Request:**
```bash
curl -X GET "https://your-api.com/transactions/summary?startDate=01-01-2024&endDate=31-01-2024" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCount": 87,
    "dateRange": {
      "start": "01-01-2024",
      "end": "31-01-2024"
    },
    "totalIncome": 3500.00,
    "totalExpense": 2345.67,
    "netBalance": 1154.33,
    "byAccount": {
      // Account breakdown for January only
    },
    "byCategory": {
      // Category breakdown for January only
    }
  }
}
```

---

## Example 6: Get Recent Movements (Grouped Transactions)

**Request:**
```bash
curl -X GET "https://your-api.com/movements?page=1&limit=10&sort=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "movementId": "mov1704110400456",
      "description": "Grocery Shopping",
      "category": "FOOD",
      "date": "01-02-2024",
      "type": "out",
      "location": "Supermarket",
      "notes": "",
      "status": "Confirmed",
      "transactions": [
        {
          "transactionId": "tx1704110400123",
          "account": "Checking",
          "amount": "-85.42",
          "description": "Grocery Shopping",
          "category": "FOOD",
          "date": "01-02-2024",
          "type": "out"
        }
      ],
      "transactionsSum": -85.42
    },
    {
      "movementId": "mov1704024000012",
      "description": "Monthly Expenses Split",
      "category": "SHARED",
      "date": "31-01-2024",
      "type": "out",
      "location": "",
      "notes": "Split with roommate",
      "status": "Confirmed",
      "transactions": [
        {
          "transactionId": "tx1704024000789",
          "account": "Checking",
          "amount": "-600.00",
          "description": "Rent",
          "category": "RENT",
          "date": "31-01-2024",
          "type": "out"
        },
        {
          "transactionId": "tx1704024000790",
          "account": "Checking",
          "amount": "-100.00",
          "description": "Utilities",
          "category": "UTILITIES",
          "date": "31-01-2024",
          "type": "out"
        }
      ],
      "transactionsSum": -700.00
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 245,
    "totalPages": 25,
    "hasMore": true
  }
}
```

---

## Example 7: Get All Transactions (Legacy Mode - No Pagination)

For backward compatibility, you can still get all transactions without pagination:

**Request:**
```bash
curl -X GET "https://your-api.com/transactions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    // All transactions (no pagination metadata)
  ]
}
```

---

## Frontend Implementation Examples

### React Example - Progressive Loading

```javascript
import { useState, useEffect } from 'react';

function Dashboard() {
  const [balances, setBalances] = useState([]);
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load - lightweight data only
    async function loadInitialData() {
      try {
        // Load balances and summary in parallel (fast)
        const [balancesRes, summaryRes] = await Promise.all([
          fetch('/accounts/balances', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/transactions/summary?startDate=' + getLastMonthDate(), {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const balancesData = await balancesRes.json();
        const summaryData = await summaryRes.json();

        setBalances(balancesData.data);
        setSummary(summaryData.data);
        setLoading(false);

        // Load movements in background (after initial render)
        loadMovements();
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    }

    async function loadMovements() {
      const res = await fetch('/movements?page=1&limit=50&sort=desc', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMovements(data.data);
    }

    loadInitialData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <AccountBalances balances={balances} />
      <TransactionSummary summary={summary} />
      <MovementsList movements={movements} />
    </div>
  );
}
```

### React Example - Infinite Scroll

```javascript
import { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';

function MovementsList() {
  const [movements, setMovements] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreMovements = useCallback(async () => {
    try {
      const res = await fetch(`/movements?page=${page}&limit=20&sort=desc`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      setMovements(prev => [...prev, ...data.data]);
      setHasMore(data.pagination.hasMore);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error loading movements:', error);
    }
  }, [page]);

  useEffect(() => {
    loadMoreMovements();
  }, []);

  return (
    <InfiniteScroll
      dataLength={movements.length}
      next={loadMoreMovements}
      hasMore={hasMore}
      loader={<h4>Loading...</h4>}
    >
      {movements.map(movement => (
        <MovementCard key={movement.movementId} movement={movement} />
      ))}
    </InfiniteScroll>
  );
}
```

### Vue Example - Progressive Loading

```vue
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <AccountBalances :balances="balances" />
      <TransactionSummary :summary="summary" />
      <MovementsList :movements="movements" @load-more="loadMoreMovements" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: true,
      balances: [],
      summary: null,
      movements: [],
      page: 1,
      hasMore: true
    };
  },
  async mounted() {
    await this.loadInitialData();
  },
  methods: {
    async loadInitialData() {
      try {
        // Load lightweight data first
        const [balancesRes, summaryRes] = await Promise.all([
          this.$http.get('/accounts/balances'),
          this.$http.get('/transactions/summary')
        ]);

        this.balances = balancesRes.data.data;
        this.summary = summaryRes.data.data;
        this.loading = false;

        // Load movements in background
        await this.loadMovements();
      } catch (error) {
        console.error('Error loading data:', error);
        this.loading = false;
      }
    },
    async loadMovements() {
      const res = await this.$http.get(`/movements?page=${this.page}&limit=20&sort=desc`);
      this.movements.push(...res.data.data);
      this.hasMore = res.data.pagination.hasMore;
    },
    async loadMoreMovements() {
      if (!this.hasMore) return;
      this.page++;
      await this.loadMovements();
    }
  }
};
</script>
```

---

## Performance Tips

1. **Initial Load Strategy:**
   - Load `/accounts/balances` first (fastest)
   - Load `/transactions/summary` for overview
   - Load first page of movements (20-50 items)
   - Load more data on-demand (scroll, user action)

2. **Caching Strategy:**
   - Cache account balances (update on transaction change)
   - Cache summary data (update every 5 minutes or on transaction change)
   - Don't cache paginated results (they change frequently)

3. **Error Handling:**
   - Show partial data if some requests fail
   - Retry failed requests with exponential backoff
   - Provide manual refresh option

4. **User Experience:**
   - Show loading skeletons for better perceived performance
   - Display cached data immediately, then update
   - Implement optimistic UI updates for create/update operations

5. **Date Range Selection:**
   - Default to last 30 days for better performance
   - Provide quick filters (This Month, Last Month, This Year)
   - Allow custom date range selection

---

## Testing Checklist

- [ ] Load balances with 0 accounts
- [ ] Load balances with 10+ accounts
- [ ] Load transactions - first page
- [ ] Load transactions - last page
- [ ] Load transactions with invalid page number
- [ ] Load transactions with date range
- [ ] Load transactions with invalid date format
- [ ] Load summary with no transactions
- [ ] Load summary with 1000+ transactions
- [ ] Load summary for specific month
- [ ] Test pagination - navigate through all pages
- [ ] Test sorting - ascending and descending
- [ ] Test backward compatibility (no query params)
- [ ] Test with expired/invalid auth token
- [ ] Test concurrent requests
- [ ] Test with slow network connection

---

## Common Issues and Solutions

### Issue: Pagination returns empty data
**Solution:** Check if the page number is within valid range. Last page might have fewer items.

### Issue: Date filtering returns no results
**Solution:** Ensure date format is dd-MM-yyyy. Check that date range contains transactions.

### Issue: Summary shows 0 for all values
**Solution:** Check if transactions have valid amounts and are not marked as "recurrent" or "unconfirmed".

### Issue: Movements not grouped correctly
**Solution:** Ensure transactions have the same movementId to be grouped together.

### Issue: Account balances don't match transaction totals
**Solution:** Balance calculation excludes "recurrent" and "unconfirmed" transactions. Verify transaction statuses.
