"""Utility function to fix the NIFTY50 minute data from the original schema to the schema required by the backtesting framework."""

import pandas as pd

df = pd.read_csv("./NIFTY50_minute.csv")

df = df.rename(columns={"date": "timestamp"})
df["symbol"] = "NIFTY50"

df = df[["symbol","timestamp","open","high","low","close","volume"]]

df.to_csv("NIFTY50_fixed.csv", index=False)
