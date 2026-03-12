from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from app.services.csv_loader import load_csv_file

router = APIRouter()


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    symbol: str = Query(..., description="Stock symbol, e.g. NIFTY")
):
    # ensure CSV file
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    try:
        rows = load_csv_file(file.file, symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "symbol": symbol.upper(),
        "rows_processed": rows
    }
