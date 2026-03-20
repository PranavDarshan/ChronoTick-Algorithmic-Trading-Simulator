from fastapi import APIRouter, UploadFile, File, HTTPException, Query
import pandas as pd

from app.db.session import SessionLocal
from app.db.models import Stock, Bar

router = APIRouter()

@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    symbol: str = Query(..., description="Stock symbol, e.g. NIFTY")
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    try:
        df = pd.read_csv(file.file, encoding="utf-8-sig")
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read CSV")

    required_cols = {"date", "open", "high", "low", "close", "volume"}
    if not required_cols.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {required_cols}"
        )

    df = df.rename(columns={"date": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    if df["timestamp"].isnull().any():
        raise HTTPException(status_code=400, detail="Invalid datetime format in CSV")

    df["symbol"] = symbol.upper()
    df = df.sort_values("timestamp")

    if not df["timestamp"].is_monotonic_increasing:
        raise HTTPException(
            status_code=400,
            detail="Timestamps must be strictly increasing"
        )

    db = SessionLocal()

    try:
        db.merge(Stock(symbol=symbol.upper()))

        records = df[[
            "symbol", "timestamp",
            "open", "high", "low", "close", "volume"
        ]].to_dict(orient="records")

        CHUNK_SIZE = 5000
        for i in range(0, len(records), CHUNK_SIZE):
            db.bulk_insert_mappings(
                Bar,
                records[i:i + CHUNK_SIZE]
            )

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()

    return {
        "symbol": symbol.upper(),
        "rows_processed": len(df)
    }