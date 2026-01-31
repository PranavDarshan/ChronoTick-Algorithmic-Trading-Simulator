import { useState, useEffect, useRef } from "react"
import type { Candle } from "../types/market"

type Props = {
  onSave: (code: string, name: string) => void
  savedStrategies: Array<{ id: string; name: string; code: string }>
  onLoad: (strategy: { id: string; name: string; code: string }) => void
  onDelete: (id: string) => void
  currentCandles: Candle[]
  currentPrice: number
}

const EXAMPLE_STRATEGY = `def strategy(candles, current_price, available_capital, total_capital, positions):
    """
    Simple Moving Average Crossover Strategy
    
    Parameters:
    - candles: List of recent candles (each with open, high, low, close, volume)
    - current_price: Current market price
    - available_capital: Available capital for trading
    - total_capital: Total capital allocated
    - positions: List of current open positions
    
    Returns:
    - Dictionary with keys: 'action' (BUY/SELL/HOLD), 'quantity', 'reason'
    """
    
    # Need at least 50 candles for indicators
    if len(candles) < 50:
        return {
            'action': 'HOLD',
            'quantity': 0,
            'reason': 'Insufficient data (need 50+ candles)'
        }
    
    # Calculate SMA 20 and SMA 50
    def calculate_sma(data, period):
        closes = [c['close'] for c in data]
        if len(closes) < period:
            return None
        return sum(closes[-period:]) / period
    
    sma20 = calculate_sma(candles, 20)
    sma50 = calculate_sma(candles, 50)
    
    if sma20 is None or sma50 is None:
        return {
            'action': 'HOLD',
            'quantity': 0,
            'reason': 'Calculating indicators...'
        }
    
    # Calculate previous SMAs for crossover detection
    prev_sma20 = calculate_sma(candles[:-1], 20)
    prev_sma50 = calculate_sma(candles[:-1], 50)
    
    # Golden Cross: SMA20 crosses above SMA50 (Bullish)
    if prev_sma20 <= prev_sma50 and sma20 > sma50:
        # Calculate position size (use 20% of available capital)
        position_value = available_capital * 0.2
        quantity = int(position_value / current_price)
        
        if quantity > 0:
            return {
                'action': 'BUY',
                'quantity': quantity,
                'reason': f'Golden Cross detected! SMA20({sma20:.2f}) > SMA50({sma50:.2f})'
            }
    
    # Death Cross: SMA20 crosses below SMA50 (Bearish)
    elif prev_sma20 >= prev_sma50 and sma20 < sma50:
        # Close all positions
        total_quantity = sum(pos['quantity'] for pos in positions if pos['side'] == 'BUY')
        
        if total_quantity > 0:
            return {
                'action': 'SELL',
                'quantity': total_quantity,
                'reason': f'Death Cross detected! SMA20({sma20:.2f}) < SMA50({sma50:.2f})'
            }
    
    return {
        'action': 'HOLD',
        'quantity': 0,
        'reason': f'No signal. SMA20: {sma20:.2f}, SMA50: {sma50:.2f}'
    }
`

const RSI_STRATEGY = `def strategy(candles, current_price, available_capital, total_capital, positions):
    """
    RSI Oversold / Overbought Strategy with Long + Short support

    Buy  when RSI < 30
    Sell when RSI > 70
    """

    if len(candles) < 15:
        return {
            'action': 'HOLD',
            'quantity': 0,
            'reason': 'Insufficient data for RSI'
        }

    def calculate_rsi(data, period=14):
        closes = [c['close'] for c in data]
        gains, losses = [], []

        for i in range(1, len(closes)):
            change = closes[i] - closes[i - 1]
            gains.append(max(change, 0))
            losses.append(abs(min(change, 0)))

        avg_gain = sum(gains[-period:]) / period
        avg_loss = sum(losses[-period:]) / period

        if avg_loss == 0:
            return 100

        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    rsi = calculate_rsi(candles)

    if rsi is None:
        return {
            'action': 'HOLD',
            'quantity': 0,
            'reason': 'Calculating RSI...'
        }

    # ---- POSITION STATE ----
    long_qty = sum(p['quantity'] for p in positions if p['side'] == 'BUY')
    short_qty = sum(p['quantity'] for p in positions if p['side'] == 'SELL')

    trade_value = available_capital * 0.25
    trade_qty = int(trade_value / current_price)

    # ---- OVERSOLD → BUY / CLOSE SHORT ----
    if rsi < 30:
        if short_qty > 0:
            # Close shorts first
            return {
                'action': 'BUY',
                'quantity': short_qty,
                'reason': f'RSI Oversold - Close Short: {rsi:.2f} < 30'
            }

        if trade_qty > 0:
            return {
                'action': 'BUY',
                'quantity': trade_qty,
                'reason': f'RSI Oversold - Open Long: {rsi:.2f} < 30'
            }

    # ---- OVERBOUGHT → SELL / CLOSE LONG ----
    elif rsi > 70:
        if long_qty > 0:
            # Close longs first
            return {
                'action': 'SELL',
                'quantity': long_qty,
                'reason': f'RSI Overbought - Close Long: {rsi:.2f} > 70'
            }

        if trade_qty > 0:
            return {
                'action': 'SELL',
                'quantity': trade_qty,
                'reason': f'RSI Overbought - Open Short: {rsi:.2f} > 70'
            }

    return {
        'action': 'HOLD',
        'quantity': 0,
        'reason': f'RSI Neutral: {rsi:.2f}'
    }

`

export default function AlgoEditor({ onSave, savedStrategies, onLoad, onDelete, currentCandles, currentPrice }: Props) {
  const [code, setCode] = useState(EXAMPLE_STRATEGY)
  const [strategyName, setStrategyName] = useState("SMA Crossover")
  const [testResult, setTestResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [autoTest, setAutoTest] = useState(false)
  const [testHistory, setTestHistory] = useState<Array<{timestamp: number, result: any}>>([])

  const lastTestRef = useRef<number>(0)
  const lastCandleCountRef = useRef<number>(0)
  const lastTestResultRef = useRef<any>(null)

  const handleTest = async (isAutoTest = false) => {
    if (isAutoTest && !autoTest) return

    const now = Date.now()
    if (now - lastTestRef.current < 1000) return
    lastTestRef.current = now

    if (currentCandles.length === 0) {
      const result = {
        action: 'HOLD',
        quantity: 0,
        reason: 'No candle data available'
      }
      
      if (JSON.stringify(lastTestResultRef.current) !== JSON.stringify(result)) {
        setTestResult(result)
        lastTestResultRef.current = result
      }
      return
    }

    if (!isAutoTest) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch("http://127.0.0.1:8000/api/execute-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          candles: currentCandles,
          current_price: currentPrice,
          available_capital: 100000,
          total_capital: 100000,
          positions: []
        })
      })

      const result = await response.json()
      
      const resultString = JSON.stringify(result)
      if (JSON.stringify(lastTestResultRef.current) !== resultString) {
        setTestResult(result)
        lastTestResultRef.current = result
        
        setTestHistory(prev => [
          { timestamp: Date.now(), result },
          ...prev.slice(0, 49)
        ])
      }
      
      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      const errorMsg = "Failed to test strategy. Make sure backend is running."
      setError(errorMsg)
      const result = {
        action: 'ERROR',
        quantity: 0,
        reason: errorMsg
      }
      
      if (JSON.stringify(lastTestResultRef.current) !== JSON.stringify(result)) {
        setTestResult(result)
        lastTestResultRef.current = result
      }
      console.error(err)
    } finally {
      if (!isAutoTest) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (autoTest && currentCandles.length > 0) {
      if (currentCandles.length !== lastCandleCountRef.current) {
        lastCandleCountRef.current = currentCandles.length
        handleTest(true)
      }
    }
  }, [currentCandles.length, autoTest])

  useEffect(() => {
    if (autoTest && currentCandles.length > 0) {
      handleTest(true)
    }
  }, [currentPrice])

  useEffect(() => {
    let interval: any
    if (autoTest && currentCandles.length > 0) {
      interval = setInterval(() => {
        handleTest(true)
      }, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoTest, currentCandles.length, code])

  const handleSave = () => {
    if (!strategyName.trim()) {
      setError("Please enter a strategy name")
      return
    }
    onSave(code, strategyName)
    setError(null)
  }

  const loadExample = (example: string) => {
    if (example === "sma") {
      setCode(EXAMPLE_STRATEGY)
      setStrategyName("SMA Crossover")
    } else if (example === "rsi") {
      setCode(RSI_STRATEGY)
      setStrategyName("RSI Strategy")
    }
    setShowExamples(false)
    setTestHistory([])
    setTestResult(null)
  }

  const clearSignal = () => {
    setTestResult(null)
    setError(null)
    lastTestResultRef.current = null
  }

  return (
    <div style={{
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#000000",
      color: "#FFFFFF",
      fontFamily: "'JetBrains Mono', monospace",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #1A1A1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0A0A0A",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "1px", color: "#6B7280" }}>
            STRATEGY EDITOR
          </div>
          {autoTest && (
            <div style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              padding: "4px 8px",
              borderRadius: "2px",
              background: "rgba(0, 200, 83, 0.1)",
              color: "#00C853",
              border: "1px solid #00C853",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <div style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#00C853",
                animation: "pulse 2s infinite"
              }} />
              LIVE TESTING
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => {
              setAutoTest(!autoTest)
              if (!autoTest) {
                setTestHistory([])
                handleTest(false)
              }
            }}
            disabled={currentCandles.length === 0}
            style={{
              padding: "8px 16px",
              background: currentCandles.length > 0 ? (autoTest ? "#E5E7EB" : "#000000") : "#0A0A0A",
              border: currentCandles.length > 0 ? (autoTest ? "none" : "1px solid #374151") : "1px solid #1A1A1A",
              borderRadius: "2px",
              color: currentCandles.length > 0 ? (autoTest ? "#000000" : "#6B7280") : "#4B5563",
              fontSize: "11px",
              fontWeight: 600,
              cursor: currentCandles.length > 0 ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              letterSpacing: "0.5px"
            }}
            onMouseEnter={(e) => {
              if (currentCandles.length > 0 && !autoTest) {
                e.currentTarget.style.background = "#1A1A1A"
              }
            }}
            onMouseLeave={(e) => {
              if (currentCandles.length > 0 && !autoTest) {
                e.currentTarget.style.background = "#000000"
              }
            }}
          >
            {autoTest ? "STOP AUTO TEST" : "START AUTO TEST"}
          </button>

          <button
            onClick={() => setShowExamples(!showExamples)}
            style={{
              padding: "8px 16px",
              background: "#000000",
              border: "1px solid #374151",
              borderRadius: "2px",
              color: "#6B7280",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.5px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1A1A1A"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#000000"
            }}
          >
            EXAMPLES
          </button>

          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              background: "#E5E7EB",
              border: "none",
              borderRadius: "2px",
              color: "#000000",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.5px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FFFFFF"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#E5E7EB"
            }}
          >
            SAVE
          </button>
        </div>
      </div>

      {/* Examples Dropdown */}
      {showExamples && (
        <div style={{
          position: "absolute",
          top: "65px",
          right: "20px",
          background: "#0A0A0A",
          border: "1px solid #374151",
          borderRadius: "2px",
          padding: "4px",
          zIndex: 100,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.8)",
          minWidth: "200px"
        }}>
          <button
            onClick={() => loadExample("sma")}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              color: "#E5E7EB",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.5px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1A1A1A"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            SMA Crossover
          </button>
          <button
            onClick={() => loadExample("rsi")}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              color: "#E5E7EB",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.5px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1A1A1A"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            RSI Strategy
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        overflow: "hidden",
        background: "#1A1A1A",
        gap: "1px"
      }}>
        {/* Left: Code Editor */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          overflow: "hidden",
          background: "#000000"
        }}>
          {/* Strategy Name Input */}
          <div style={{ 
            padding: "16px 20px", 
            borderBottom: "1px solid #1A1A1A", 
            background: "#000000", 
            flexShrink: 0 
          }}>
            <label style={{ 
              fontSize: "9px", 
              color: "#6B7280", 
              fontWeight: 600,
              marginBottom: "8px",
              display: "block",
              letterSpacing: "0.5px"
            }}>
              STRATEGY NAME
            </label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="Enter strategy name"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0A0A0A",
                border: "1px solid #1A1A1A",
                borderRadius: "2px",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 500,
                outline: "none",
                fontFamily: "'JetBrains Mono', monospace"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#374151"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#1A1A1A"
              }}
            />
          </div>

          {/* Code Editor */}
          <div style={{ flex: 1, overflow: "hidden", background: "#000000" }}>
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setTestHistory([])
              }}
              spellCheck={false}
              style={{
                width: "100%",
                height: "100%",
                padding: "20px",
                background: "#000000",
                border: "none",
                color: "#E5E7EB",
                fontSize: "12px",
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: "1.8",
                resize: "none",
                outline: "none",
                overflowY: "auto"
              }}
            />
          </div>
        </div>

        {/* Right: Results Panel - FIXED WITH PROPER OVERFLOW */}
        <div style={{ 
          width: "400px", 
          display: "flex", 
          flexDirection: "column", 
          overflow: "hidden",
          background: "#000000"
        }}>
          {/* Current Signal - Fixed height */}
          <div style={{
            padding: "20px",
            borderBottom: "1px solid #1A1A1A",
            background: "#000000",
            flexShrink: 0
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "16px"
            }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6B7280", 
                fontWeight: 600,
                letterSpacing: "1px"
              }}>
                CURRENT SIGNAL
              </div>
              {testResult && (
                <button
                  onClick={clearSignal}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "1px solid #374151",
                    borderRadius: "2px",
                    color: "#6B7280",
                    fontSize: "9px",
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.5px",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1A1A1A"
                    e.currentTarget.style.color = "#E5E7EB"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.color = "#6B7280"
                  }}
                >
                  CLEAR
                </button>
              )}
            </div>

            {testResult ? (
              error ? (
                <div style={{
                  padding: "16px",
                  background: "rgba(255, 23, 68, 0.1)",
                  border: "1px solid #FF1744",
                  borderRadius: "2px"
                }}>
                  <div style={{ 
                    fontSize: "11px", 
                    color: "#FF1744", 
                    lineHeight: "1.6", 
                    whiteSpace: "pre-wrap"
                  }}>
                    {error}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: "16px",
                  background: "#0A0A0A",
                  border: "1px solid #1A1A1A",
                  borderRadius: "2px"
                }}>
                  <div style={{ marginBottom: "16px" }}>
                    <span style={{
                      padding: "6px 12px",
                      background: testResult.action === 'BUY' ? "#00C853" :
                                  testResult.action === 'SELL' ? "#FF1744" :
                                  "#374151",
                      color: "#FFFFFF",
                      borderRadius: "2px",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "1px"
                    }}>
                      {testResult.action}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ 
                      fontSize: "9px", 
                      color: "#6B7280", 
                      marginBottom: "6px", 
                      fontWeight: 600,
                      letterSpacing: "0.5px"
                    }}>
                      QUANTITY
                    </div>
                    <div style={{ 
                      fontSize: "20px", 
                      fontWeight: 600, 
                      color: "#FFFFFF"
                    }}>
                      {testResult.quantity}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ 
                      fontSize: "9px", 
                      color: "#6B7280", 
                      marginBottom: "6px", 
                      fontWeight: 600,
                      letterSpacing: "0.5px"
                    }}>
                      REASON
                    </div>
                    <div style={{ 
                      fontSize: "11px", 
                      color: "#E5E7EB", 
                      lineHeight: "1.7"
                    }}>
                      {testResult.reason}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div style={{
                padding: "32px",
                textAlign: "center",
                color: "#4B5563",
                background: "#0A0A0A",
                border: "1px solid #1A1A1A",
                borderRadius: "2px",
                fontSize: "10px",
                letterSpacing: "0.5px"
              }}>
                {autoTest ? "AWAITING DATA" : "READY TO TEST"}
              </div>
            )}

            <div style={{ 
              marginTop: "12px", 
              fontSize: "9px", 
              color: "#4B5563",
              letterSpacing: "0.5px"
            }}>
              {currentCandles.length} CANDLES • ${currentPrice.toFixed(2)}
            </div>
          </div>

          {/* Test History - FIXED: Scrollable with flex */}
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
            borderBottom: "1px solid #1A1A1A"
          }}>
            <div style={{
              padding: "12px 20px",
              borderBottom: "1px solid #1A1A1A",
              fontSize: "10px",
              color: "#6B7280",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              letterSpacing: "1px",
              background: "#0A0A0A",
              flexShrink: 0
            }}>
              <span>TEST LOG ({testHistory.length})</span>
              {testHistory.length > 0 && (
                <button
                  onClick={() => setTestHistory([])}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "1px solid #374151",
                    borderRadius: "2px",
                    color: "#6B7280",
                    fontSize: "9px",
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.5px",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1A1A1A"
                    e.currentTarget.style.color = "#E5E7EB"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.color = "#6B7280"
                  }}
                >
                  CLEAR
                </button>
              )}
            </div>

            <div style={{ 
              flex: 1, 
              overflowY: "auto", 
              padding: "12px 20px",
              minHeight: 0
            }}>
              {testHistory.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#4B5563",
                  fontSize: "10px",
                  letterSpacing: "0.5px"
                }}>
                  NO HISTORY
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {testHistory.map((test, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "12px",
                        background: "#0A0A0A",
                        border: "1px solid #1A1A1A",
                        borderRadius: "2px",
                        fontSize: "10px",
                        flexShrink: 0
                      }}
                    >
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        marginBottom: "8px",
                        alignItems: "center"
                      }}>
                        <span style={{
                          padding: "4px 8px",
                          background: test.result.action === 'BUY' ? "#00C853" :
                                      test.result.action === 'SELL' ? "#FF1744" :
                                      "#374151",
                          color: "#FFFFFF",
                          borderRadius: "2px",
                          fontSize: "9px",
                          fontWeight: 600,
                          letterSpacing: "0.5px"
                        }}>
                          {test.result.action}
                        </span>
                        <span style={{ 
                          color: "#4B5563", 
                          fontSize: "9px"
                        }}>
                          {new Date(test.timestamp).toLocaleTimeString('en-US', { 
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      <div style={{ 
                        color: "#8B92A8", 
                        fontSize: "10px", 
                        lineHeight: "1.6"
                      }}>
                        QTY {test.result.quantity} • {test.result.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Saved Strategies - FIXED: Proper height and scrolling */}
          <div style={{ 
            height: "280px",
            display: "flex",
            flexDirection: "column",
            background: "#000000",
            flexShrink: 0,
            overflow: "hidden"
          }}>
            <div style={{
              padding: "12px 20px",
              borderBottom: "1px solid #1A1A1A",
              fontSize: "10px",
              color: "#6B7280",
              fontWeight: 600,
              letterSpacing: "1px",
              background: "#0A0A0A",
              flexShrink: 0
            }}>
              SAVED STRATEGIES ({savedStrategies.length})
            </div>

            <div style={{ 
              flex: 1, 
              overflowY: "auto", 
              padding: "12px 20px",
              minHeight: 0
            }}>
              {savedStrategies.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#4B5563",
                  fontSize: "10px",
                  letterSpacing: "0.5px"
                }}>
                  NO SAVED STRATEGIES
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {savedStrategies.map((strategy) => (
                    <div
                      key={strategy.id}
                      style={{
                        padding: "12px",
                        background: "#0A0A0A",
                        border: "1px solid #1A1A1A",
                        borderRadius: "2px",
                        transition: "all 0.2s",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#1A1A1A"
                        e.currentTarget.style.borderColor = "#374151"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#0A0A0A"
                        e.currentTarget.style.borderColor = "#1A1A1A"
                      }}
                    >
                      <div 
                        onClick={() => {
                          onLoad(strategy)
                          setCode(strategy.code)
                          setStrategyName(strategy.name)
                          setTestResult(null)
                          setError(null)
                          setTestHistory([])
                        }}
                        style={{ flex: 1, cursor: "pointer" }}
                      >
                        <div style={{ 
                          fontSize: "11px", 
                          fontWeight: 600, 
                          color: "#FFFFFF", 
                          marginBottom: "4px"
                        }}>
                          {strategy.name}
                        </div>
                        <div style={{ 
                          fontSize: "9px", 
                          color: "#6B7280",
                          letterSpacing: "0.5px"
                        }}>
                          CLICK TO LOAD
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(strategy.id)
                        }}
                        style={{
                          padding: "6px 10px",
                          background: "transparent",
                          border: "1px solid #374151",
                          borderRadius: "2px",
                          color: "#6B7280",
                          fontSize: "9px",
                          fontWeight: 600,
                          cursor: "pointer",
                          letterSpacing: "0.5px",
                          transition: "all 0.2s",
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#1A1A1A"
                          e.currentTarget.style.color = "#E5E7EB"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent"
                          e.currentTarget.style.color = "#6B7280"
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}