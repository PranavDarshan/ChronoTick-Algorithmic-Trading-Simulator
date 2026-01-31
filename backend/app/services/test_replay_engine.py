import asyncio
from datetime import datetime
from dataclasses import dataclass

from replay_engine import replay_bars


# --------------------------------
# Mock Bar object (DB-free)
# --------------------------------
@dataclass
class Bar:
    timestamp: datetime
    close: float


# --------------------------------
# Test dataset
# --------------------------------
bars = [
    Bar(datetime(2015, 1, 9, 9, 15, 0), 8300.0),
    Bar(datetime(2015, 1, 9, 9, 16, 0), 8310.0),  # 60 sec gap
    Bar(datetime(2015, 1, 9, 9, 18, 0), 8320.0),  # 120 sec gap
]


# --------------------------------
# TEST 1 — TRUE REAL-TIME
# --------------------------------
async def test_real_time():
    print("\n===== TEST 1: TRUE REAL-TIME (1 min = 60 sec) =====")
    async for tick in replay_bars(bars):
        print(
            datetime.now().time(),
            tick["timestamp"],
            tick["price"],
            tick["source"]
        )


# --------------------------------
# TEST 2 — FAST FORWARD
# --------------------------------
async def test_fast_forward():
    print("\n===== TEST 2: FAST FORWARD (1 min = 1 sec) =====")
    async for tick in replay_bars(
        bars,
        realtime=False,
        time_scale=60
    ):
        print(
            datetime.now().time(),
            tick["timestamp"],
            tick["price"],
            tick["source"]
        )


# --------------------------------
# TEST 3 — INTERPOLATED (REAL-TIME)
# --------------------------------
async def test_interpolated_real_time():
    print("\n===== TEST 3: INTERPOLATED REAL-TIME =====")
    async for tick in replay_bars(
        bars,
        interpolate=True
    ):
        print(
            datetime.now().time(),
            tick["timestamp"],
            tick["price"],
            tick["source"]
        )


# --------------------------------
# TEST 4 — INTERPOLATED + FAST
# --------------------------------
async def test_interpolated_fast():
    print("\n===== TEST 4: INTERPOLATED + FAST FORWARD =====")
    async for tick in replay_bars(
        bars,
        realtime=False,
        time_scale=60,
        interpolate=True
    ):
        print(
            datetime.now().time(),
            tick["timestamp"],
            tick["price"],
            tick["source"]
        )


# --------------------------------
# MAIN
# --------------------------------
async def main():
    await test_real_time()
    await asyncio.sleep(2)

    await test_fast_forward()
    await asyncio.sleep(2)

    await test_interpolated_real_time()
    await asyncio.sleep(2)

    await test_interpolated_fast()


if __name__ == "__main__":
    asyncio.run(main())