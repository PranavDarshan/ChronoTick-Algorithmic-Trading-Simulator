import { createChart, CandlestickSeries } from "lightweight-charts"
import type { CandlestickData } from "lightweight-charts"
import { useEffect, useRef } from "react"
import type { Candle } from "../types/market"

export default function Chart({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0b0e11" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1f2430" },
        horzLines: { color: "#1f2430" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      borderVisible: false,
    })

    seriesRef.current = series

    return () => chart.remove()
  }, [])

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles as CandlestickData[])
    }
  }, [candles])

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
}
