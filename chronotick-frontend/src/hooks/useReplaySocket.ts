import { useEffect, useRef, useCallback, useState } from "react"
import { useReplayStore } from "../store/replayStore"
import type { WSMessage, Candle } from "../types/market"
import type { UTCTimestamp } from "lightweight-charts"

type Params = {
  symbol: string
  start: string
  end: string
  timeScale: number
  gapScale: number
  playing: boolean
  enabled: boolean
}

export function useReplaySocket(params: Params) {
  const addCandle = useReplayStore((s) => s.addCandle)
  const setInitialCandles = useReplayStore((s) => s.setInitialCandles)
  const addSessionMarker = useReplayStore((s) => s.addSessionMarker)
  const reset = useReplayStore((s) => s.reset)

  const wsRef = useRef<WebSocket | null>(null)
  const startedRef = useRef(false)
  const lastCommandSentRef = useRef<string | null>(null)
  const playingRef = useRef(params.playing)
  const [isConnected, setIsConnected] = useState(false)

  // Update playing ref whenever params change
  useEffect(() => {
    console.log(`[PLAYING REF] Updating playingRef from ${playingRef.current} to ${params.playing}`)
    playingRef.current = params.playing
  }, [params.playing])

  console.log(`[RENDER] Hook render - params.playing: ${params.playing}, playingRef: ${playingRef.current}, isConnected: ${isConnected}, wsRef exists: ${!!wsRef.current}, ws state: ${wsRef.current?.readyState}`)

  /* ======================
     CLOSE SOCKET FUNCTION WITH BACKEND NOTIFICATION
  ====================== */
  const closeSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("[WS] Sending close command to backend")
      try {
        wsRef.current.send(JSON.stringify({ command: "close" }))
      } catch (error) {
        console.error("[WS] Error sending close command:", error)
      }
      
      setTimeout(() => {
        if (wsRef.current) {
          console.log("[WS] Closing socket connection")
          wsRef.current.close()
          wsRef.current = null
        }
      }, 100)
    } else if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    reset()
    startedRef.current = false
    lastCommandSentRef.current = null
    setIsConnected(false)
  }, [reset])

  /* ======================
     OPEN SOCKET (AUTO-RECONNECT ON PARAM CHANGE)
  ====================== */
  useEffect(() => {
    console.log(`[CONNECTION EFFECT] Running - symbol: ${params.symbol}, enabled: ${params.enabled}`)
    
    if (!params.symbol || !params.enabled) {
      console.log(`[CONNECTION EFFECT] Skipping - no symbol or not enabled`)
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ command: "close" }))
          } catch (error) {
            console.error("[WS] Error sending close command:", error)
          }
        }
        wsRef.current.close()
        wsRef.current = null
        setIsConnected(false)
      }
      return
    }

    console.log("[WS] Opening replay socket for", params.symbol)

    // Close existing connection properly before opening new one
    const oldWs = wsRef.current
    if (oldWs) {
      console.log("[WS] Closing existing connection before reconnect")
      // Remove event handlers to prevent them from interfering
      oldWs.onopen = null
      oldWs.onclose = null
      oldWs.onerror = null
      oldWs.onmessage = null
      
      if (oldWs.readyState === WebSocket.OPEN) {
        try {
          oldWs.send(JSON.stringify({ command: "close" }))
        } catch (error) {
          console.error("[WS] Error sending close command:", error)
        }
      }
      oldWs.close()
      wsRef.current = null
    }

    // Reset all state before new connection
    console.log("[CONNECTION EFFECT] Resetting state")
    reset()
    startedRef.current = false
    lastCommandSentRef.current = null
    setIsConnected(false)

    const ws = new WebSocket(
      "ws://127.0.0.1:8000/ws/replay" +
        `?symbol=${encodeURIComponent(params.symbol)}` +
        `&start=${encodeURIComponent(params.start)}` +
        `&end=${encodeURIComponent(params.end)}` +
        `&realtime=false` +
        `&time_scale=${params.timeScale}` +
        `&gap_scale=${params.gapScale}`
    )

    console.log("[CONNECTION EFFECT] WebSocket created, readyState:", ws.readyState)
    
    // Set wsRef IMMEDIATELY so it's available when onopen fires
    wsRef.current = ws

    ws.onopen = () => {
      console.log("[WS] Connected - wsRef is set, readyState:", wsRef.current?.readyState)
      console.log("[WS] At onopen - playingRef.current:", playingRef.current, "params.playing:", params.playing)
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data)

      if (msg.event === "session_gap" && msg.to) {
        const t = Math.floor(
          new Date(msg.to + "Z").getTime() / 1000
        ) as UTCTimestamp
        addSessionMarker(t)
        return
      }

      if (msg.event !== "tick" || !msg.real_candle || !msg.timestamp) return

      const time = Math.floor(
        new Date(msg.timestamp + "Z").getTime() / 1000
      ) as UTCTimestamp

      const candle: Candle = {
        time,
        open: msg.real_candle.open,
        high: msg.real_candle.high,
        low: msg.real_candle.low,
        close: msg.real_candle.close,
        volume: msg.real_candle.volume,
      }

      if (!startedRef.current) {
        setInitialCandles([candle])
        startedRef.current = true
      } else {
        addCandle(candle)
      }
    }

    ws.onclose = () => {
      console.log("[WS] onclose fired for a WebSocket")
      // Only clear wsRef if this is still the current WebSocket
      if (wsRef.current === ws) {
        console.log("[WS] This is the current WebSocket, clearing wsRef")
        wsRef.current = null
        setIsConnected(false)
      } else {
        console.log("[WS] This is an old WebSocket, ignoring onclose")
      }
    }

    ws.onerror = () => {
      console.log("[WS] error")
      if (wsRef.current === ws) {
        setIsConnected(false)
      }
    }

    // Cleanup function
    return () => {
      console.log("[WS] cleanup - sending close command")
      // Remove event handlers to prevent interference
      ws.onopen = null
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ command: "close" }))
        } catch (error) {
          console.error("[WS] Error in cleanup:", error)
        }
      }
      ws.close()
    }
  }, [params.symbol, params.start, params.end, params.timeScale, params.gapScale, params.enabled, reset, setInitialCandles, addCandle, addSessionMarker])

  /* ======================
     PLAY / PAUSE COMMANDS
     Send command whenever playing state changes OR connection establishes
  ====================== */
  useEffect(() => {
    console.log(`[PLAY/PAUSE EFFECT] Running - params.playing: ${params.playing}, playingRef: ${playingRef.current}, isConnected: ${isConnected}`)
    
    // Don't try to send if not connected
    if (!isConnected) {
      console.log(`[WS] Waiting for connection before sending play/pause`)
      return
    }

    console.log(`[PLAY/PAUSE EFFECT] Connection ready, will send command after delay`)
    
    // Small delay to ensure WebSocket is fully ready after connection
    const timeoutId = setTimeout(() => {
      console.log(`[PLAY/PAUSE EFFECT] Timeout fired - checking ws state`)
      const ws = wsRef.current
      
      console.log(`[PLAY/PAUSE EFFECT] wsRef.current exists: ${!!ws}, readyState: ${ws?.readyState}`)
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log(`[WS] Cannot send play/pause - ws not ready (exists: ${!!ws}, state: ${ws?.readyState})`)
        return
      }

      const command = playingRef.current ? "play" : "pause"
      
      console.log(`[PLAY/PAUSE EFFECT] Preparing to send "${command}", lastCommandSent: ${lastCommandSentRef.current}`)
      
      // Only send if different from last command
      if (lastCommandSentRef.current === command) {
        console.log(`[WS] Skipping ${command} - already sent`)
        return
      }

      console.log(`[WS] Sending ${command} command (playing: ${playingRef.current})`)
      try {
        ws.send(JSON.stringify({ command }))
        lastCommandSentRef.current = command
        console.log(`[WS] Successfully sent ${command}, updated lastCommandSent`)
      } catch (error) {
        console.error(`[WS] Error sending ${command}:`, error)
      }
    }, 100)

    return () => {
      console.log(`[PLAY/PAUSE EFFECT] Cleanup - clearing timeout`)
      clearTimeout(timeoutId)
    }
  }, [params.playing, isConnected])

  /* ======================
     HANDLE PAGE UNLOAD (refresh/close)
  ====================== */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ command: "close" }))
        } catch (error) {
          console.error("[WS] Error during unload:", error)
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  return { closeSocket, isConnected }
}