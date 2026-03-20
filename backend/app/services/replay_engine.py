import asyncio
from datetime import timedelta


def is_session_gap(prev_ts, next_ts, threshold_minutes=30):
    return (next_ts - prev_ts) > timedelta(minutes=threshold_minutes)


async def replay_bars(
    bars,
    realtime: bool = True,
    time_scale: float = 1.0,
    gap_scale: float = 60.0,
    interpolate: bool = False,
    interpolate_step_sec: int = 1,
):
    """
    Event-driven market replay engine.

    Emits:
    - tick events
    - session_gap events
    """

    if not realtime and time_scale <= 0:
        raise ValueError("time_scale must be > 0")

    prev = None

    for curr in bars:
        # ----------------------------------
        # FIRST BAR
        # ----------------------------------
        if prev is None:
            yield {
                "type": "tick",
                "timestamp": curr.timestamp,
                "price": curr.close,
                "is_synthetic": False,
                "source": "real",
                "real_candle": {
                    "open": curr.open,
                    "high": curr.high,
                    "low": curr.low,
                    "close": curr.close,
                    "volume": curr.volume,
                },
            }
            prev = curr
            continue

        delta_sec = (curr.timestamp - prev.timestamp).total_seconds()
        if delta_sec < 0:
            raise ValueError("Non-monotonic timestamps")

        # ----------------------------------
        # SESSION GAP HANDLING (overnight / holidays)
        # ----------------------------------
        if is_session_gap(prev.timestamp, curr.timestamp):
            gap_sec = delta_sec

            sleep_time = (
                gap_sec
                if realtime
                else gap_sec / gap_scale
            )

            yield {
                "type": "session_gap",
                "from": prev.timestamp,
                "to": curr.timestamp,
                "gap_seconds": gap_sec,
                "reason": "market_closed",
            }

            await asyncio.sleep(sleep_time)

            # Emit opening tick immediately after gap
            yield {
                "type": "tick",
                "timestamp": curr.timestamp,
                "price": curr.open,
                "is_synthetic": False,
                "source": "real",
                "real_candle": {
                    "open": curr.open,
                    "high": curr.high,
                    "low": curr.low,
                    "close": curr.close,
                    "volume": curr.volume,
                },
            }

            prev = curr
            continue

        # ----------------------------------
        # NORMAL INTRADAY GAP
        # ----------------------------------
        elapsed_market_time = 0.0

        # INTERPOLATION (OPTIONAL)
        if interpolate and delta_sec >= interpolate_step_sec:
            steps = int(delta_sec // interpolate_step_sec)
            price_diff = curr.close - prev.close

            for i in range(1, steps):
                frac = (i * interpolate_step_sec) / delta_sec
                price = prev.close + price_diff * frac

                sleep_time = (
                    interpolate_step_sec
                    if realtime
                    else interpolate_step_sec / time_scale
                )

                await asyncio.sleep(sleep_time)
                elapsed_market_time += interpolate_step_sec

                yield {
                    "type": "tick",
                    "timestamp": prev.timestamp + timedelta(seconds=i * interpolate_step_sec),
                    "price": round(price, 4),
                    "is_synthetic": True,
                    "source": "interpolated",
                }

        # WAIT REMAINING TIME
        remaining = delta_sec - elapsed_market_time
        if remaining > 0:
            sleep_time = (
                remaining
                if realtime
                else remaining / time_scale
            )
            await asyncio.sleep(sleep_time)

        # EMIT REAL BAR CLOSE
        yield {
            "type": "tick",
            "timestamp": curr.timestamp,
            "price": curr.close,
            "is_synthetic": False,
            "source": "real",
            "real_candle": {
                "open": curr.open,
                "high": curr.high,
                "low": curr.low,
                "close": curr.close,
                "volume": curr.volume,
            },
        }

        prev = curr