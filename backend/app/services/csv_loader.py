import pandas as pd

from app.db.session import SessionLocal
from app.db.models import Stock, Bar


def load_csv_file(file_like, symbol: str):
    df = pd.read_csv(file_like, encoding="utf-8-sig")

    required_cols = {"date", "open", "high", "low", "close", "volume"}
    if not required_cols.issubset(df.columns):
        raise ValueError("CSV missing required columns")

    df = df.rename(columns={"date": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    if df["timestamp"].isnull().any():
        raise ValueError("Invalid datetime format")

    df["symbol"] = symbol.upper()
    df = df.sort_values("timestamp")

    db = SessionLocal()

    try:
        db.merge(Stock(symbol=symbol.upper()))

        records = df[
            ["symbol", "timestamp", "open", "high", "low", "close", "volume"]
        ].to_dict(orient="records")

        CHUNK_SIZE = 5000

        for i in range(0, len(records), CHUNK_SIZE):
            db.bulk_insert_mappings(
                Bar,
                records[i:i + CHUNK_SIZE]
            )

        db.commit()

    except:
        db.rollback()
        raise

    finally:
        db.close()

    return len(df)
