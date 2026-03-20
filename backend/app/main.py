from fastapi import FastAPI
from app.api.upload import router as upload_router
from app.api.data import router as data_router
from app.api.replay_ws import router as replay_ws_router
from fastapi.middleware.cors import CORSMiddleware
from app.api.algo_trading_backend import router as algo_router



app = FastAPI(title="Market Replay Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(algo_router)
app.include_router(upload_router)
app.include_router(data_router)
app.include_router(replay_ws_router)

@app.get("/health")
def health():
    return {"status": "ok"}
