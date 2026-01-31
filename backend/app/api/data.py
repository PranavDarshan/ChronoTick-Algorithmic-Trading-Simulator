from fastapi import APIRouter, HTTPException
from datetime import date
from sqlalchemy import text

from app.db.session import SessionLocal
from app.db.models import Bar

router = APIRouter()

@router.get("/symbols")
def get_symbols():
    db = SessionLocal()
    try:
        symbols = db.query(Bar.symbol).distinct().all()
        return {
            "symbols": [s[0] for s in symbols]
        }
    finally:
        db.close()

@router.get("/dates/{symbol}")
def get_dates(symbol: str):
    db = SessionLocal()
    try:
        rows = db.execute(
            text("""
                SELECT DISTINCT DATE(timestamp) AS trade_date
                FROM bars
                WHERE symbol = :symbol
                ORDER BY trade_date
            """),
            {"symbol": symbol.upper()}
        ).fetchall()

        return [row[0] for row in rows]

    finally:
        db.close()

from datetime import date, datetime, timedelta

@router.get("/data/{symbol}/{trade_date}")
def get_day_data(symbol: str, trade_date: date):
    start_dt = datetime.combine(trade_date, datetime.min.time())
    end_dt = start_dt + timedelta(days=1)

    db = SessionLocal()
    try:
        bars = db.query(Bar).filter(
            Bar.symbol == symbol.upper(),
            Bar.timestamp >= start_dt,
            Bar.timestamp < end_dt
        ).order_by(Bar.timestamp).all()

        if not bars:
            raise HTTPException(status_code=404, detail="No data found")

        return [
            {
                "timestamp": bar.timestamp.isoformat(),
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume
            }
            for bar in bars
        ]

    finally:
        db.close()

@router.get("/date-range/{symbol}")
def get_date_range(symbol: str):
    db = SessionLocal()
    try:
        min_ts, max_ts = db.query(
            func.min(Bar.timestamp),
            func.max(Bar.timestamp)
        ).filter(Bar.symbol == symbol).one()

        return {
            "min": min_ts,
            "max": max_ts,
        }
    finally:
        db.close()