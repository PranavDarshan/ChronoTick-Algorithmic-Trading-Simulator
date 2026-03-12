from pathlib import Path
from app.services.csv_loader import load_csv_file

DATA_DIR = Path("data/symbols")


def main():
    csv_files = list(DATA_DIR.glob("*.csv"))

    if not csv_files:
        print("No CSV files found")
        return

    for csv_file in csv_files:
        symbol = csv_file.stem.upper()

        print(f"Loading {symbol}...")

        with open(csv_file, "rb") as f:
            rows = load_csv_file(f, symbol)

        print(f"{symbol}: inserted {rows} rows")


if __name__ == "__main__":
    main()
