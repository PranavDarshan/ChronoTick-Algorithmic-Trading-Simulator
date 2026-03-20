import asyncio
from datetime import datetime
from fastapi import WebSocket, APIRouter, Query
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models import Bar
from app.services.replay_engine import replay_bars

router = APIRouter()


@router.websocket("/ws/replay")
async def replay_ws(
    websocket: WebSocket,
    symbol: str = Query(...),
    start: str = Query(...),
    end: str = Query(...),
    realtime: bool = Query(True),
    time_scale: float = Query(1.0),
    gap_scale: float = Query(60.0),
    interpolate: bool = Query(False),
):
    await websocket.accept()
    db: Session = SessionLocal()

    # ============================
    # PLAY / PAUSE STATE
    # ============================
    paused = asyncio.Event()
    paused.clear()  # 🔴 START PAUSED (IMPORTANT)

    stop_event = asyncio.Event()

    async def control_listener():
        """
        Listens for frontend commands:
        { command: "play" | "pause" | "stop" }
        """
        try:
            while True:
                msg = await websocket.receive_json()
                command = msg.get("command")

                if command == "play":
                    paused.set()

                elif command == "pause":
                    paused.clear()

                elif command == "stop":
                    stop_event.set()
                    break

        except WebSocketDisconnect:
            stop_event.set()

        except asyncio.CancelledError:
            pass

    control_task = asyncio.create_task(control_listener())

    try:
        # ============================
        # PARSE TIME RANGE
        # ============================
        start_dt = datetime.fromisoformat(start)
        end_dt = datetime.fromisoformat(end)

        # ============================
        # LOAD BARS
        # ============================
        bars = (
            db.query(Bar)
            .filter(
                Bar.symbol == symbol.upper(),
                Bar.timestamp >= start_dt,
                Bar.timestamp <= end_dt,
            )
            .order_by(Bar.timestamp)
            .all()
        )

        # ============================
        # REPLAY LOOP
        # ============================
        async for event in replay_bars(
            bars=bars,
            realtime=realtime,
            time_scale=time_scale,
            gap_scale=gap_scale,
            interpolate=interpolate,
        ):
            # 🛑 Stop requested
            if stop_event.is_set():
                break

            # ⏸️ Pause handling
            await paused.wait()

            try:
                # ------------------------
                # SESSION GAP EVENT
                # ------------------------
                if event["type"] == "session_gap":
                    await websocket.send_json({
                        "event": "session_gap",
                        "from": event["from"].isoformat(),
                        "to": event["to"].isoformat(),
                        "gap_seconds": event["gap_seconds"],
                        "reason": event["reason"],
                    })
                    continue

                # ------------------------
                # TICK EVENT
                # ------------------------
                await websocket.send_json({
                    "event": "tick",
                    "timestamp": event["timestamp"].isoformat(),
                    "price": event["price"],
                    "is_synthetic": event["is_synthetic"],
                    "source": event["source"],
                    "real_candle": event.get("real_candle"),
                })

            except WebSocketDisconnect:
                break

    except Exception as e:
        # Send error ONLY if socket is still open
        try:
            if websocket.client_state.name == "CONNECTED":
                await websocket.send_json({
                    "event": "error",
                    "message": str(e),
                })
        except Exception:
            pass

    finally:
        # ============================
        # CLEANUP (NO DOUBLE CLOSE)
        # ============================
        stop_event.set()
        control_task.cancel()
        db.close()
        # ❌ DO NOT call websocket.close() here