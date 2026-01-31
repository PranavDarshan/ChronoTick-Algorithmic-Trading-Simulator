# 📈 ChronoTick - Historical Market Replay Engine-Backend

> **Backend service for high-fidelity historical stock market simulation with true timestamp preservation**

---

## 🎯 Overview

ChronoTick is a **backend-only** service for replaying historical intraday market data with authentic timestamp gaps and optional interpolation. The frontend (charts, UI, controls) is intentionally separated into a different repository for architectural clarity.

This engine replays market data as it actually occurred, supporting everything from 1-minute OHLCV bars to tick-level and order book replay scenarios.

---

## ✨ Features

- 📊 **CSV Upload** - Import historical OHLCV data seamlessly
- 🗄️ **Flexible Database** - SQLite for development, PostgreSQL-ready for production
- ⏱️ **True Market Time** - Authentic replay preserving real market timing
- ⚡ **Fast-Forward Mode** - Configurable time acceleration (e.g., 1 min → 1 sec)
- 🎨 **Smart Interpolation** - Smooth price transitions while preserving real OHLC integrity
- 🔒 **OHLC Integrity** - No fake highs/lows, authentic candles only
- 🌐 **WebSocket Streaming** - Real-time data delivery to frontend clients
- 🧪 **Deterministic Engine** - Fully unit testable and reproducible

---

## 🏗️ Architecture

```
CSV (OHLCV)
     ↓
Database (bars table)
     ↓
Replay Engine (tick-based, time-aware)
     ↓
WebSocket API (attaches real candles)
     ↓
Frontend (separate repository)
```

---

## 📋 Database Schema

### Table: `bars`

| Column    | Type     | Description                    |
|-----------|----------|--------------------------------|
| symbol    | TEXT     | Trading symbol identifier      |
| timestamp | DATETIME | Format: YYYY-MM-DD HH:MM:SS   |
| open      | FLOAT    | Opening price                  |
| high      | FLOAT    | Highest price in period        |
| low       | FLOAT    | Lowest price in period         |
| close     | FLOAT    | Closing price                  |
| volume    | INTEGER  | Trading volume                 |

**Constraints:**
- Unique composite key: `(symbol, timestamp)`
- Timestamp must include time component

---

## 🚀 Getting Started

### Requirements

- Python 3.11+
- FastAPI
- SQLAlchemy 2.x
- SQLite (default)

### Installation & Running

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload

# Access Swagger UI
# http://127.0.0.1:8000/docs
```

---

## 🔌 API Reference

### CSV Upload

```http
POST /upload-csv?symbol=NIFTY
Content-Type: multipart/form-data
```

**CSV Format:**
```csv
date,open,high,low,close,volume
2015-01-09 09:15:00,8300.6,8312.0,8298.0,8310.0,123456
```

### Data Query Endpoints

```http
GET /symbols                    # List all available symbols
GET /dates/{symbol}             # Get available dates for a symbol
GET /data/{symbol}/{date}       # Retrieve OHLCV data for specific date
```

---

## 🎮 Replay Engine

### Core Principles

- ✅ Replay driven by authentic timestamps
- ✅ Candles are **NOT** interpolated
- ✅ Only price (close) is interpolated for smooth transitions
- ✅ Fast-forward is explicit and configurable

### Replay Modes

1. **Real-time** - 1:1 market time reproduction
2. **Fast-forward** - Accelerated replay with configurable time scale
3. **Interpolated** - Smooth price transitions between bars
4. **Interpolated + Fast-forward** - Combined mode for optimal visualization

---

## 🌐 WebSocket API

### Connection

```
ws://localhost:8000/ws/replay
```

### Query Parameters

| Parameter    | Type    | Required | Description                          |
|-------------|---------|----------|--------------------------------------|
| symbol      | string  | ✅       | Trading symbol to replay             |
| date        | string  | ❌       | Date in YYYY-MM-DD format           |
| realtime    | boolean | ❌       | Enable real-time mode               |
| time_scale  | float   | ❌       | Time acceleration factor            |
| interpolate | boolean | ❌       | Enable price interpolation          |

---

## 📡 Event Format

### Synthetic Tick Event

```json
{
  "timestamp": "2015-01-09 09:15:30",
  "price": 8305.25,
  "is_synthetic": true,
  "source": "interpolated",
  "real_candle": null
}
```

### Real Bar Close Event

```json
{
  "timestamp": "2015-01-09 09:16:00",
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

## 🎨 Frontend Responsibilities

*The frontend (separate repository) handles:*

- Building visual candles from tick stream
- Overriding interpolated candles when `real_candle` arrives
- Chart rendering (TradingView, Chart.js, or custom solutions)
- User controls and interaction

---

## 🧪 Testing

```bash
python app/services/test_replay_engine.py
```

---

## 🛡️ Design Guarantees

- ✅ **No fake highs/lows** - Only authentic OHLC data
- ✅ **No timestamp distortion** - True market timing preserved
- ✅ **No synthetic candle storage** - Interpolation is ephemeral
- ✅ **Deterministic replay** - Reproducible for testing and backtesting

---

## 🗺️ Roadmap

- [ ] Pause / Resume / Seek functionality
- [ ] Order book replay support
- [ ] Strategy backtesting framework
- [ ] PostgreSQL + Redis scaling
- [ ] Multi-symbol concurrent replay
- [ ] Historical data providers integration

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built for traders, quants, and market enthusiasts**