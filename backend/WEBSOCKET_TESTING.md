# 📡 WebSocket Replay Engine — Testing & Usage Guide

> **Independent testing, validation, and integration of the historical market replay WebSocket**

---

This document explains how to test, validate, and integrate the historical market replay WebSocket independently of any frontend.

The WebSocket emits time-accurate market ticks reconstructed from historical OHLCV data, with support for:

- Multi-day replay
- Session gaps (overnight / holidays)
- Time compression
- Optional interpolation
- Candle-aware output

---

## 1️⃣ WebSocket Endpoint

```
ws://<HOST>:<PORT>/ws/replay
```

### Example (local)

```
ws://127.0.0.1:8000/ws/replay
```

---

## 2️⃣ Required Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `symbol` | string | Instrument symbol (e.g. `NIFTY100`) |
| `start` | ISO date / datetime | Replay start (e.g. `2015-01-09` or `2015-01-09T09:15:00`) |
| `end` | ISO date / datetime | Replay end (e.g. `2015-01-14`) |

---

## 3️⃣ Optional Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `realtime` | bool | `true` | If true, market time = wall time |
| `time_scale` | float | `1.0` | Intraday time compression factor |
| `gap_scale` | float | `60.0` | Session gap compression factor |
| `interpolate` | bool | `false` | Generate synthetic ticks between real bars |

---

## 4️⃣ Recommended Test Commands (wscat)

### Install wscat

```bash
npm install -g wscat
```

### ▶ Basic connection test

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY&start=2015-01-09"
```

**Expected:**
- Connection accepted
- JSON events streamed continuously

### ▶ Fast-forward test

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY&start=2015-01-09&realtime=false&time_scale=60"
```

**Expected:**
- One minute of market data arrives every second
- No long gaps
- Replay completes quickly

### ▶ Interpolation test

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY&start=2015-01-09&interpolate=true"
```

**Expected:**
- Events with `is_synthetic = true` and `source = "interpolated"`
- Real bar close events still appear

### ▶ Date range test

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY&start=2015-01-09&end=2015-01-12&realtime=false&time_scale=120"
```

**Expected:**
- Continuous replay across dates
- Overnight gaps respected
- No timestamp regressions

### ▶ Partial time range test

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY&start=2015-01-09 10:00&end=2015-01-09 14:30"
```

**Expected:**
- Replay starts exactly at 10:00
- Replay ends exactly at 14:30

### ▶ Normal multi-day replay (compressed)

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY100&start=2015-01-09&end=2015-01-14&realtime=false&time_scale=6000&gap_scale=100000"
```

### ▶ Real-time replay (slow, realistic)

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY100&start=2015-01-09&end=2015-01-09"
```

### ▶ With interpolation enabled

```bash
wscat -c "ws://127.0.0.1:8000/ws/replay?symbol=NIFTY100&start=2015-01-09&end=2015-01-09&interpolate=true"
```

---

## 5️⃣ WebSocket Event Types

### 🔹 1. Tick Event

Emitted for:
- Every real bar close
- Every interpolated synthetic tick (if enabled)

```json
{
  "event": "tick",
  "timestamp": "2015-01-09T09:15:00",
  "price": 8308.35,
  "is_synthetic": false,
  "source": "real",
  "real_candle": {
    "open": 8300.6,
    "high": 8309.75,
    "low": 8300.6,
    "close": 8308.35,
    "volume": 0.0
  }
}
```

#### Tick Fields

| Field | Meaning |
|-------|---------|
| `timestamp` | Market timestamp |
| `price` | Tick price (close for real bars) |
| `is_synthetic` | `true` if interpolated |
| `source` | `real` or `interpolated` |
| `real_candle` | Present only on real ticks |

---

### 🔹 2. Session Gap Event

Emitted when the market is closed (overnight / weekends / holidays).

```json
{
  "event": "session_gap",
  "from": "2015-01-09T15:29:00",
  "to": "2015-01-12T09:15:00",
  "gap_seconds": 236460,
  "reason": "market_closed"
}
```

#### Purpose

- Allows frontend to fast-forward time
- Prevents long freezes during overnight gaps
- Enables timeline compression between days

---

## 6️⃣ Time Scaling Rules (IMPORTANT)

### Intraday scaling

```
wall_time = market_time / time_scale
```

**Example:**

```
time_scale = 600
1 minute market time → 0.1s wall time
```

### Session gap scaling

```
wall_time = gap_time / gap_scale
```

**Example:**

```
gap_scale = 100000
16-hour overnight gap → ~0.6s
```

✔ **Intraday and session gaps are scaled independently**

---

## 7️⃣ Candle Accuracy Guarantee

### ✔ All real candles preserve:

- Open
- High
- Low
- Close
- Volume

### ✔ Interpolated ticks:

- Never modify OHLC data
- Exist only for visualization / replay smoothness
- Clearly marked with `is_synthetic = true`

### Frontend can safely:

- Build candles from real ticks
- Ignore synthetic ticks for indicators
- Display smooth price animation

---

## 8️⃣ Expected Behavior Checklist

| Feature | Status |
|---------|--------|
| Multi-day replay | ✅ |
| No overnight freezes | ✅ |
| Configurable gap compression | ✅ |
| Optional interpolation | ✅ |
| Candle-aware ticks | ✅ |
| Frontend-agnostic | ✅ |
| Deterministic replay | ✅ |

---

## 9️⃣ Frontend Integration Contract (Summary)

Frontend only needs to:

1. Open WebSocket
2. Listen for `event`
3. Handle:
   - `tick`
   - `session_gap`

**No polling**  
**No REST dependency**  
**No time math required on frontend**

---

## 🔟 Known Non-Goals (By Design)

❌ No live market feed  
❌ No order execution  
❌ No strategy logic  
❌ No state stored per client

**This service is a pure deterministic replay engine.**

---

## 1️⃣1️⃣ Debugging Tips

- **If replay stops early** → check date range contains data
- **If replay freezes** → lower `gap_scale`
- **If candles look wrong** → ignore synthetic ticks
- **If timing feels off** → tune `time_scale`

---

**END OF DOCUMENT**