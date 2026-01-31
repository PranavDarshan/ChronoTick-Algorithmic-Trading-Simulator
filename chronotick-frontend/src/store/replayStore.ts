import { create } from "zustand"
import type { Candle } from "../types/market"
import type { SeriesMarker, UTCTimestamp } from "lightweight-charts"

type ReplayState = {
  candles: Candle[]
  markers: SeriesMarker<UTCTimestamp>[]
  paused: boolean

  addCandle: (c: Candle) => void
  setInitialCandles: (c: Candle[]) => void
  addSessionMarker: (time: UTCTimestamp) => void
  setPaused: (v: boolean) => void
  reset: () => void
}


export const useReplayStore = create<ReplayState>((set) => ({
  candles: [],
  markers: [],
  paused: false,

  setPaused: (paused) => set({ paused }),

  reset: () =>
    set({
      candles: [],
      markers: [],
      paused: false,
    }),

  setInitialCandles: (candles) =>
    set({ candles }),

  addCandle: (candle) =>
    set((state) =>
      state.paused
        ? state
        : { candles: [...state.candles, candle] }
    ),

  addSessionMarker: (time) =>
    set((state) => ({
      markers: [
        ...state.markers,
        {
          time,
          position: "inBar",
          color: "#64748b",
          shape: "circle",
          text: "Session gap",
        },
      ],
    })),
}))