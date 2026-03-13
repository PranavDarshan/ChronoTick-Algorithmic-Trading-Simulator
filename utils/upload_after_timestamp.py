"""Utility script to upload data file after a certain timestamp. Make use of this incase of broken uploads."""

import pandas as pd

# ===== FILE PATHS =====
input_csv = "NIFTY50_minute.csv"

output_csv = "NIFTY50_after_2023.csv"

# ===== CUTOFF TIME =====
cutoff = pd.Timestamp("2023-06-07 10:40:00")

# ===== LOAD DATA =====
df = pd.read_csv(input_csv)

# convert date column
df["date"] = pd.to_datetime(df["date"])

# filter rows after cutoff
df_filtered = df[df["date"] > cutoff]

# rename column for Supabase schema
df_filtered = df_filtered.rename(columns={"date": "timestamp"})

# add symbol column
df_filtered["symbol"] = "NIFTY50"

# reorder columns
df_filtered = df_filtered[
    ["symbol", "timestamp", "open", "high", "low", "close", "volume"]
]

# save new csv
df_filtered.to_csv(output_csv, index=False)

print("Rows exported:", len(df_filtered))
print("Saved to:", output_csv)
