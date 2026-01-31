import type { UTCTimestamp } from "lightweight-charts"

export type Candle = {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type WSMessage =
  | {
      event: "tick"
      timestamp: string
      real_candle: {
        open: number
        high: number
        low: number
        close: number
        volume: number
      }
    }
  | {
      event: "session_gap"
      from: string
      to: string
    }
  | {
      event: "error"
      message: string
    }
