# 📘 ChronoTick Backend — API Reference

> **Complete REST and WebSocket API documentation for data ingestion, metadata queries, and live replay**

---

This document describes all REST APIs exposed by the ChronoTick backend. These APIs are used for data ingestion, metadata queries, and validation. 

**Live replay is handled exclusively via WebSockets** (see `WS_TESTING.md` for detailed testing guide).

---

## 🌐 Base URL

```
http://localhost:8000
```

Or for custom deployments:

```
http://<HOST>:<PORT>
```

---

## 1️⃣ Health Check

```http
GET /
```

### Description

Basic server health check.

### Response

```json
{
  "status": "ok"
}
```

---

## 2️⃣ CSV Upload (Historical Data Ingestion)

```http
POST /upload-csv?symbol={SYMBOL}
```

**Description:** Uploads historical OHLCV data from CSV into the database.

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbol` | string | ✅ | Instrument symbol (e.g. `NIFTY100`, `NIFTY`) |

### Request (multipart/form-data)

| Field | Type | Required |
|-------|------|----------|
| `file` | CSV file | ✅ |

### CSV Requirements

- **Columns:** `date`, `open`, `high`, `low`, `close`, `volume`
- **Date Format:** `YYYY-MM-DD HH:MM:SS`
- ✔ `date` must include time
- ✔ Timestamps must be strictly increasing

### Example CSV

```csv
date,open,high,low,close,volume
2015-01-09 09:15:00,8300.6,8312,8298,8310,123456
2015-01-09 09:16:00,8310.0,8315.5,8308,8312,145678
```

### Request Example

```bash
curl -X POST "http://localhost:8000/upload-csv?symbol=NIFTY" \
  -F "file=@nifty_data.csv"
```

### Success Response

```json
{
  "symbol": "NIFTY",
  "rows_processed": 390,
  "rows_inserted": 390
}
```

### Error Cases

| Status | Reason |
|--------|--------|
| 400 | Invalid CSV format |
| 400 | Missing required columns |
| 400 | Non-monotonic timestamps |
| 500 | Database insertion error |

---

## 3️⃣ Available Symbols

```http
GET /symbols
```

Returns all symbols available in the database.

### Response

```json
{
  "symbols": ["NIFTY", "NIFTY100", "BANKNIFTY"]
}
```

---

## 4️⃣ Available Dates for a Symbol

```http
GET /dates/{symbol}
```

Returns all distinct trading dates available for a symbol.

### Path Parameters

| Name | Type |
|------|------|
| `symbol` | string |

### Example

```bash
curl http://localhost:8000/dates/NIFTY
```

### Response

```json
{
  "symbol": "NIFTY",
  "dates": [
    "2015-01-09",
    "2015-01-12",
    "2015-01-13"
  ]
}
```

✔ Dates are derived from timestamp  
✔ Time portion is preserved internally

---

## 5️⃣ Get OHLCV Data

```http
GET /data/{symbol}/{date}
```

Returns all OHLCV bars for the given date.

### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `symbol` | string | Trading symbol |
| `date` | string | Date in YYYY-MM-DD format |

### Example

```bash
curl http://localhost:8000/data/NIFTY/2015-01-09
```

### Response

```json
{
  "symbol": "NIFTY",
  "date": "2015-01-09",
  "bars": [
    {
      "timestamp": "2015-01-09T09:15:00",
      "open": 8300.6,
      "high": 8312.0,
      "low": 8298.0,
      "close": 8310.0,
      "volume": 123456
    }
  ]
}
```

---

## 6️⃣ Bar Data Query (Debug / Validation)

⚠️ **Not used by frontend replay**  
**Intended for debugging and verification**

```http
GET /bars/{symbol}
```

### Query Parameters

| Name | Type | Description |
|------|------|-------------|
| `start` | ISO datetime | Optional |
| `end` | ISO datetime | Optional |
| `limit` | int | Default: 100 |

### Example

```bash
curl "http://localhost:8000/bars/NIFTY100?start=2015-01-09T09:15:00&end=2015-01-09T10:00:00"
```

### Response

```json
[
  {
    "timestamp": "2015-01-09T09:15:00",
    "open": 8300.6,
    "high": 8309.75,
    "low": 8300.6,
    "close": 8308.35,
    "volume": 0.0
  }
]
```

---

## ⚙️ Replay Modes

The backend supports multiple replay modes that can be combined:

### Real-Time Replay

- 1 second market time = 1 second wall time

### Fast-Forward Replay

- Market time compressed using `time_scale`

### Interpolated Replay

- Synthetic ticks generated inside gaps
- Total replay duration unchanged

---

## 🌐 WebSocket Replay API

**Full documentation in `WS_TESTING.md`**

### Connection

```
ws://localhost:8000/ws/replay
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `symbol` | string | Yes | - | Trading symbol |
| `start` | string | Yes | - | Start datetime (ISO format) |
| `end` | string | No | - | End datetime (ISO format) |
| `realtime` | boolean | No | `true` | Enable real-time replay |
| `time_scale` | float | No | `1.0` | Time acceleration factor |
| `gap_scale` | float | No | `60.0` | Session gap compression factor |
| `interpolate` | boolean | No | `false` | Enable price interpolation |

### Connection Example

```javascript
const ws = new WebSocket(
  'ws://localhost:8000/ws/replay?' +
  'symbol=NIFTY&' +
  'start=2015-01-09&' +
  'realtime=false&' +
  'time_scale=60&' +
  'interpolate=true'
);

ws.onmessage = (event) => {
  const tick = JSON.parse(event.data);
  console.log(tick);
};
```

---

## 📡 WebSocket Event Format

### Synthetic Tick Event

```json
{
  "event": "tick",
  "timestamp": "2015-01-09T09:15:23",
  "price": 8304.67,
  "is_synthetic": true,
  "source": "interpolated",
  "real_candle": null
}
```

---

### Real Bar Close Event

```json
{
  "event": "tick",
  "timestamp": "2015-01-09T09:16:00",
  "price": 8310.0,
  "is_synthetic": false,
  "source": "real",
  "real_candle": {
    "open": 8300.6,
    "high": 8312.0,
    "low": 8298.0,
    "close": 8310.0,
    "volume": 123456
  }
}
```

---

### Session Gap Event

```json
{
  "event": "session_gap",
  "from": "2015-01-09T15:29:00",
  "to": "2015-01-12T09:15:00",
  "gap_seconds": 236460,
  "reason": "market_closed"
}
```

---

## 🎨 Frontend Usage Notes

**Frontend responsibilities:**

- Connect via WebSocket
- Render ticks in real time
- Build live candles from ticks
- Override candles when `real_candle` is present

### Example Frontend Flow

```javascript
let currentCandle = null;

ws.onmessage = (event) => {
  const tick = JSON.parse(event.data);
  
  if (tick.is_synthetic) {
    // Update current candle with tick price
    updateLiveCandle(tick.price, tick.timestamp);
  } else {
    // Real bar arrived - override with authentic data
    finalizeCandle(tick.real_candle);
  }
  
  updateChart(tick);
};

function updateLiveCandle(price, timestamp) {
  if (!currentCandle) {
    currentCandle = { open: price, high: price, low: price, close: price };
  } else {
    currentCandle.high = Math.max(currentCandle.high, price);
    currentCandle.low = Math.min(currentCandle.low, price);
    currentCandle.close = price;
  }
}

function finalizeCandle(realCandle) {
  currentCandle = realCandle;
  currentCandle = null; // Reset for next period
}
```

---

## 7️⃣ API Design Principles

✔ **REST = data & metadata**  
✔ **WebSocket = time-based replay**  
✔ **Frontend remains stateless**  
✔ **Backend controls time semantics**

---

## 8️⃣ Non-Goals

❌ Authentication (for now)  
❌ Order placement  
❌ Strategy execution  
❌ Real-time market feed

---

## ⚠️ Error Handling

### WebSocket Errors

| Error Condition | Behavior |
|----------------|----------|
| Missing parameters | Connection closed |
| Invalid date format | Connection closed |
| Symbol not found | Connection closed with error message |
| Client disconnect | Replay stops cleanly |

### REST API Errors

| Status | Meaning |
|--------|---------|
| 404 | Symbol not found |
| 400 | Invalid date / format |
| 500 | Internal error |

---

## 🔚 Summary

| Component | Role |
|-----------|------|
| **REST APIs** | Data ingestion & discovery |
| **WebSocket** | Historical replay engine |
| **Frontend** | Visualization & interaction |

---

**END OF API DOCUMENTATION**