import { useState, useEffect, useRef } from "react"
import type { Candle } from "../types/market"

type Position = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  entryPrice: number
  currentPrice: number
  timestamp: number
  status: 'OPEN' | 'CLOSED'
  exitPrice?: number
  exitTimestamp?: number
  pnl?: number
}

type Trade = {
  id: string
  timestamp: number
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  reason: string
}

type Props = {
  strategy: { id: string; name: string; code: string } | null
  currentCandles: Candle[]
  currentPrice: number
  isPlaying: boolean
  isConnected: boolean
  symbol: string
  initialCapital: number
  onTradeExecuted?: (timestamp: number, price: number, side: 'BUY' | 'SELL', quantity: number, reason: string) => void
}

export default function AlgoExecutor({
  strategy,
  currentCandles,
  currentPrice,
  isPlaying,
  isConnected,
  symbol,
  initialCapital,
  onTradeExecuted
}: Props) {
  const [isActive, setIsActive] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [capital, setCapital] = useState(initialCapital)
  const [lastAction, setLastAction] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionLog, setExecutionLog] = useState<string[]>([])
  const lastExecutionRef = useRef(0)
  const executionIntervalRef = useRef<number | null>(null)
  const wasConnectedRef = useRef(isConnected)
  const isExecutingRef = useRef(false)
  const marginCallExecutedRef = useRef(false)
  const squareOffInProgressRef = useRef(false)
  const marginCallCooldownRef = useRef<number | null>(null)  
  const [isInCooldown, setIsInCooldown] = useState(false)     
  const API = import.meta.env.VITE_API_URL
  // Performance metrics
  const openPositions = positions.filter(p => p.status === 'OPEN')
  const closedPositions = positions.filter(p => p.status === 'CLOSED')

  const longQuantity = openPositions
    .filter(p => p.side === 'BUY')
    .reduce((sum, p) => sum + p.quantity, 0)
  
  const shortQuantity = openPositions
    .filter(p => p.side === 'SELL')
    .reduce((sum, p) => sum + p.quantity, 0)

  const netPosition = longQuantity - shortQuantity

  const unrealizedPnL = openPositions.reduce((sum, pos) => {
    const priceDiff = pos.side === 'BUY' 
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice
    return sum + (priceDiff * pos.quantity)
  }, 0)

  const realizedPnL = closedPositions.reduce((sum, pos) => {
    if (!pos.exitPrice) return sum
    const priceDiff = pos.side === 'BUY'
      ? pos.exitPrice - pos.entryPrice
      : pos.entryPrice - pos.exitPrice
    return sum + (priceDiff * pos.quantity)
  }, 0)

  // Total account value = starting capital + all P&L (realized + unrealized)
  const totalValue = initialCapital + realizedPnL + unrealizedPnL
  const totalPnL = realizedPnL + unrealizedPnL
  const returnPercent = ((totalValue - initialCapital) / initialCapital) * 100

  const winningTrades = closedPositions.filter(p => {
    if (!p.exitPrice) return false
    const pnl = p.side === 'BUY' 
      ? p.exitPrice - p.entryPrice 
      : p.entryPrice - p.exitPrice
    return pnl > 0
  }).length

  const winRate = closedPositions.length > 0 
    ? (winningTrades / closedPositions.length) * 100 
    : 0

  // Margin system for short positions
  const shortExposure = openPositions
    .filter(p => p.side === 'SELL')
    .reduce((sum, pos) => sum + (pos.quantity * currentPrice), 0)

  const MAINTENANCE_MARGIN_RATE = 0.25  // 25% minimum equity required
  const marginRequired = shortExposure * MAINTENANCE_MARGIN_RATE
  const equity = totalValue
  const marginCallTriggered = shortExposure > 0 && equity < marginRequired && equity > 0

  const addLog = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    
    let logMessage = `[${timestamp}] ${message}`
    
    // Add detailed data if provided
    if (data) {
      const dataStr = JSON.stringify(data, null, 0)
      logMessage += ` | ${dataStr}`
    }
    
    setExecutionLog(prev => [logMessage, ...prev].slice(0, 500))
    
    // Also console.log for debugging
    if (data) {
      console.log(`[ALGO] ${message}`, data)
    } else {
      console.log(`[ALGO] ${message}`)
    }
  }

  const squareOffAllPositions = (reason: string = 'Auto square-off') => {
    // FIXED: Added lock to prevent concurrent square-off operations
    if (squareOffInProgressRef.current) {
      console.log('[SQUARE-OFF] Already in progress, skipping duplicate call')
      return
    }
    
    squareOffInProgressRef.current = true
    console.log('[SQUARE-OFF] Called with reason:', reason)
    console.log('[SQUARE-OFF] Current price:', currentPrice)
    
    setPositions(prev => {
      const openPositions = prev.filter(p => p.status === 'OPEN')
      
      console.log('[SQUARE-OFF] Open positions found:', openPositions.length)
      
      if (openPositions.length === 0) {
        console.log('[SQUARE-OFF] No open positions, returning unchanged')
        squareOffInProgressRef.current = false
        return prev  // No open positions, no changes
      }
      
      addLog(`${reason} - Closing ${openPositions.length} open position(s)`)
      
      const newTrades: Trade[] = []
      let capitalChange = 0
      
      console.log('[SQUARE-OFF] Starting capital change calculation')
      console.log('[SQUARE-OFF] Current capital before square-off:', capital)
      
      const updatedPositions = prev.map(pos => {
        if (pos.status !== 'OPEN') return pos
        
        let pnl = 0
        
        if (pos.side === 'BUY') {
          // CRITICAL FIX: Long position - return FULL PROCEEDS to capital, not just P&L
          const proceeds = currentPrice * pos.quantity
          pnl = (currentPrice - pos.entryPrice) * pos.quantity
          capitalChange += proceeds  // ← FIXED: Was "capitalChange += pnl"
          
          console.log('[SQUARE-OFF] Closing LONG:', {
            quantity: pos.quantity,
            entry: pos.entryPrice,
            exit: currentPrice,
            proceeds,
            pnl,
            capitalChange
          })
          
          newTrades.push({
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            action: 'SELL',
            quantity: pos.quantity,
            price: currentPrice,
            reason: reason
          })
          if (onTradeExecuted && currentCandles.length > 0) {
  onTradeExecuted(
    currentCandles[currentCandles.length - 1].time as number,
    currentPrice,
    'SELL',
    pos.quantity,
    reason
  )
}
          addLog(`SELL ${pos.quantity} @ ${currentPrice.toFixed(2)} - Square off long - Proceeds: ${proceeds.toFixed(2)} - P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`, {
            proceeds,
            pnl,
            totalCapitalChange: capitalChange
          })
        } else {
          // Short position: only P&L affects capital
          pnl = (pos.entryPrice - currentPrice) * pos.quantity
          capitalChange += pnl
          
          console.log('[SQUARE-OFF] Closing SHORT:', {
            quantity: pos.quantity,
            entry: pos.entryPrice,
            exit: currentPrice,
            pnl,
            capitalChange
          })
          
          newTrades.push({
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            action: 'BUY',
            quantity: pos.quantity,
            price: currentPrice,
            reason: reason
          })
          if (onTradeExecuted && currentCandles.length > 0) {
  onTradeExecuted(
    currentCandles[currentCandles.length - 1].time as number,
    currentPrice,
    'BUY',
    pos.quantity,
    reason
  )
}

          
          addLog(`BUY ${pos.quantity} @ ${currentPrice.toFixed(2)} - Square off short - P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`, {
            pnl,
            totalCapitalChange: capitalChange
          })
        }
        
        return {
          ...pos,
          status: 'CLOSED' as const,
          exitPrice: currentPrice,
          exitTimestamp: Date.now(),
          pnl
        }
      })
      
      console.log('[SQUARE-OFF] Total capital change:', capitalChange)
      console.log('[SQUARE-OFF] Updating capital and trades')
      
      // Update capital and trades atomically with position updates
      setCapital(prevCapital => {
        const newCapital = prevCapital + capitalChange
        console.log('[SQUARE-OFF] Capital update:', {
          previous: prevCapital,
          change: capitalChange,
          new: newCapital
        })
        addLog(`Capital updated: $${prevCapital.toFixed(2)} → $${newCapital.toFixed(2)} (${capitalChange >= 0 ? '+' : ''}${capitalChange.toFixed(2)})`)
        return newCapital
      })
      
      setTrades(prevTrades => [...newTrades, ...prevTrades])
      
      // FIXED: Release lock after all operations
      squareOffInProgressRef.current = false
      
      return updatedPositions
    })
  }

const executeStrategy = async () => {
  if (isExecutingRef.current || squareOffInProgressRef.current) return
  if (!strategy || !isActive || currentCandles.length === 0) return
  
  // ✅ NEW: Skip execution during cooldown
  if (isInCooldown) {
    // Optionally log this for debugging
    // addLog(`Skipping execution - in cooldown period`)
    return
  }

  if (!isConnected) {
    addLog(`WebSocket disconnected - Auto-stopping strategy`)
    setIsActive(false)
    squareOffAllPositions('WebSocket disconnected')
    return
  }
    if (!isConnected) {
      addLog(`WebSocket disconnected - Auto-stopping strategy`)
      setIsActive(false)
      squareOffAllPositions('WebSocket disconnected')
      return
    }

    if (!isPlaying) {
      addLog(`Market paused - Skipping execution`)
      return
    }

    const now = Date.now()
    if (now - lastExecutionRef.current < 1000) return
    
    isExecutingRef.current = true
    lastExecutionRef.current = now

    try {
      const currentOpenPositions = positions.filter(p => p.status === 'OPEN')
      
      const response = await fetch(`${API}/api/execute-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: strategy.code,
          candles: currentCandles,
          current_price: currentPrice,
          available_capital: capital,
          total_capital: totalValue,
          positions: currentOpenPositions.map(p => ({
            side: p.side,
            quantity: p.quantity,
            entry_price: p.entryPrice
          }))
        })
      })

      const result = await response.json()
      setLastAction(result)

      if (result.error) {
        setError(result.error)
        addLog(`ERROR: ${result.error}`)
        isExecutingRef.current = false
        return
      }

      setError(null)

      if (result.action === 'BUY' && result.quantity > 0) {
        await handleBuyAction(result.quantity, result.reason)
      } else if (result.action === 'SELL' && result.quantity > 0) {
        await handleSellAction(result.quantity, result.reason)
      } else if (result.action === 'HOLD') {
        // Don't log every HOLD to reduce noise
        // addLog(`HOLD - ${result.reason}`)
      }
    } catch (err) {
      setError("Failed to execute strategy")
      addLog(`Execution error: ${err}`)
      console.error(err)
    } finally {
      isExecutingRef.current = false
    }
  }

  const handleBuyAction = async (quantity: number, reason: string) => {
    console.log('[BUY-ACTION] Called:', { quantity, reason, currentPrice, capital })
    
    // FIXED: Use functional state update to get current positions
    setPositions(prevPositions => {
      const currentOpenPositions = prevPositions.filter(p => p.status === 'OPEN')
      const shortPositions = currentOpenPositions.filter(p => p.side === 'SELL')
      
      console.log('[BUY-ACTION] Current state:', {
        openPositions: currentOpenPositions.length,
        shortPositions: shortPositions.length
      })
      
      let remainingToBuy = quantity
      let capitalChange = 0
      const newTrades: Trade[] = []
      const updatedPositions = [...prevPositions]

      // First priority: Cover existing short positions
      if (shortPositions.length > 0) {
        console.log('[BUY-ACTION] Covering shorts first')

        for (const pos of shortPositions) {
          if (remainingToBuy <= 0) break

          const quantityToClose = Math.min(pos.quantity, remainingToBuy)
          const pnl = (pos.entryPrice - currentPrice) * quantityToClose

          console.log('[BUY-ACTION] Covering short:', {
            posId: pos.id,
            quantity: quantityToClose,
            entry: pos.entryPrice,
            exit: currentPrice,
            pnl
          })

          // Always allow covering shorts - losses must be realized
          capitalChange += pnl  // Only P&L affects capital
          remainingToBuy -= quantityToClose

          if (pnl < 0) {
            addLog(`Covering short at loss: -$${Math.abs(pnl).toFixed(2)}`, { pnl })
          }

          newTrades.push({
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            action: 'BUY',
            quantity: quantityToClose,
            price: currentPrice,
            reason: reason + ' (Cover short)'
          })
          if (onTradeExecuted && currentCandles.length > 0) {
  onTradeExecuted(
    currentCandles[currentCandles.length - 1].time as number,
    currentPrice,
    'BUY',
    quantityToClose,
    reason + ' (Cover short)'
  )
}


          addLog(`BUY ${quantityToClose} @ ${currentPrice.toFixed(2)} - ${reason} (Cover short) - P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`, {
            posId: pos.id,
            pnl,
            capitalChange
          })

          const posIndex = updatedPositions.findIndex(p => p.id === pos.id)
          if (posIndex !== -1) {
            if (quantityToClose === pos.quantity) {
              updatedPositions[posIndex] = {
                ...updatedPositions[posIndex],
                status: 'CLOSED',
                exitPrice: currentPrice,
                exitTimestamp: Date.now(),
                pnl
              }
              console.log('[BUY-ACTION] Short fully closed:', pos.id)
            } else {
              updatedPositions[posIndex] = {
                ...updatedPositions[posIndex],
                quantity: pos.quantity - quantityToClose
              }
              console.log('[BUY-ACTION] Short partially closed:', {
                posId: pos.id,
                remaining: pos.quantity - quantityToClose
              })
            }
          }
        }
      }

      // FIXED: Now update capital and trades atomically
      if (capitalChange !== 0) {
        setCapital(prev => {
          const newCap = prev + capitalChange
          console.log('[BUY-ACTION] Capital after covering shorts:', {
            previous: prev,
            change: capitalChange,
            new: newCap
          })
          addLog(`Capital: $${prev.toFixed(2)} → $${newCap.toFixed(2)} (${capitalChange >= 0 ? '+' : ''}${capitalChange.toFixed(2)})`)
          return newCap
        })
      }

      if (newTrades.length > 0) {
        setTrades(prev => [...newTrades, ...prev])
      }

      // Second priority: Open new long positions with remaining quantity
      if (remainingToBuy > 0) {
        const cost = currentPrice * remainingToBuy

        console.log('[BUY-ACTION] Opening long position:', {
          quantity: remainingToBuy,
          price: currentPrice,
          cost
        })

        // FIXED: Check capital BEFORE creating position
        setCapital(prevCapital => {
          console.log('[BUY-ACTION] Checking capital:', {
            cost,
            available: prevCapital,
            sufficient: cost <= prevCapital
          })
          
          if (cost <= prevCapital) {
            // Capital check passed - create position
            const newPosition: Position = {
              id: `${Date.now()}-${Math.random()}`,
              symbol,
              side: 'BUY',
              quantity: remainingToBuy,
              entryPrice: currentPrice,
              currentPrice: currentPrice,
              timestamp: Date.now(),
              status: 'OPEN'
            }

            const newTrade: Trade = {
              id: `${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              action: 'BUY',
              quantity: remainingToBuy,
              price: currentPrice,
              reason: reason + (shortPositions.length > 0 ? ' (Open long)' : '')
            }

            // Add position to the updated positions array
            updatedPositions.push(newPosition)
            
            // Add trade
            setTrades(prevTrades => [newTrade, ...prevTrades])
            if (onTradeExecuted && currentCandles.length > 0) {
  onTradeExecuted(
    currentCandles[currentCandles.length - 1].time as number,
    currentPrice,
    'BUY',
    remainingToBuy,
    reason + (shortPositions.length > 0 ? ' (Open long)' : '')
  )
}
            const newCap = prevCapital - cost
            console.log('[BUY-ACTION] Long opened, capital updated:', {
              previous: prevCapital,
              cost,
              new: newCap
            })
            addLog(`BUY ${remainingToBuy} @ ${currentPrice.toFixed(2)} - ${reason}${shortPositions.length > 0 ? ' (Open long)' : ''}`, {
              cost,
              capitalAfter: newCap
            })
            
            return newCap
          } else {
            console.log('[BUY-ACTION] INSUFFICIENT CAPITAL:', {
              needed: cost,
              available: prevCapital,
              deficit: cost - prevCapital
            })
            addLog(`Insufficient capital for BUY (need ${cost.toFixed(2)}, have ${prevCapital.toFixed(2)})`)
            return prevCapital
          }
        })
      }

      return updatedPositions
    })
  }

  const handleSellAction = async (quantity: number, reason: string) => {
    console.log('[SELL-ACTION] Called:', { quantity, reason, currentPrice, capital })
    
    // FIXED: Use functional state update to get current positions
    setPositions(prevPositions => {
      const currentOpenPositions = prevPositions.filter(p => p.status === 'OPEN')
      const longPositions = currentOpenPositions.filter(p => p.side === 'BUY')
      
      console.log('[SELL-ACTION] Current state:', {
        openPositions: currentOpenPositions.length,
        longPositions: longPositions.length
      })
      
      let remainingToSell = quantity
      let capitalChange = 0
      const newTrades: Trade[] = []
      const updatedPositions = [...prevPositions]

      // First priority: Close existing long positions
      if (longPositions.length > 0) {
        console.log('[SELL-ACTION] Closing longs first')

        for (const pos of longPositions) {
          if (remainingToSell <= 0) break

          const quantityToClose = Math.min(pos.quantity, remainingToSell)
          const proceeds = currentPrice * quantityToClose
          const pnl = (currentPrice - pos.entryPrice) * quantityToClose

          console.log('[SELL-ACTION] Closing long:', {
            posId: pos.id,
            quantity: quantityToClose,
            entry: pos.entryPrice,
            exit: currentPrice,
            proceeds,
            pnl
          })

          capitalChange += proceeds
          remainingToSell -= quantityToClose

          newTrades.push({
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            action: 'SELL',
            quantity: quantityToClose,
            price: currentPrice,
            reason: reason + ' (Close long)'
          })
          if (onTradeExecuted && currentCandles.length > 0) {
  onTradeExecuted(
    currentCandles[currentCandles.length - 1].time as number,
    currentPrice,
    'SELL',
    quantityToClose,
    reason + ' (Close long)'
  )
}

          addLog(`SELL ${quantityToClose} @ ${currentPrice.toFixed(2)} - ${reason} (Close long) - P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`, {
            posId: pos.id,
            proceeds,
            pnl,
            capitalChange
          })

          const posIndex = updatedPositions.findIndex(p => p.id === pos.id)
          if (posIndex !== -1) {
            if (quantityToClose === pos.quantity) {
              updatedPositions[posIndex] = {
                ...updatedPositions[posIndex],
                status: 'CLOSED',
                exitPrice: currentPrice,
                exitTimestamp: Date.now(),
                pnl
              }
              console.log('[SELL-ACTION] Long fully closed:', pos.id)
            } else {
              updatedPositions[posIndex] = {
                ...updatedPositions[posIndex],
                quantity: pos.quantity - quantityToClose
              }
              console.log('[SELL-ACTION] Long partially closed:', {
                posId: pos.id,
                remaining: pos.quantity - quantityToClose
              })
            }
          }
        }
      }

      // FIXED: Update capital and trades atomically
      if (capitalChange !== 0) {
        setCapital(prev => {
          const newCap = prev + capitalChange
          console.log('[SELL-ACTION] Capital after closing longs:', {
            previous: prev,
            change: capitalChange,
            new: newCap
          })
          addLog(`Capital: $${prev.toFixed(2)} → $${newCap.toFixed(2)} (+${capitalChange.toFixed(2)})`)
          return newCap
        })
      }

      if (newTrades.length > 0) {
        setTrades(prev => [...newTrades, ...prev])
      }

      // Second priority: Open new short positions with remaining quantity
      if (remainingToSell > 0) {
        const proceeds = currentPrice * remainingToSell

        console.log('[SELL-ACTION] Opening short position:', {
          quantity: remainingToSell,
          price: currentPrice,
          proceeds,
          note: 'Capital unchanged - proceeds locked as margin'
        })

        const newPosition: Position = {
          id: `${Date.now()}-${Math.random()}`,
          symbol,
          side: 'SELL',
          quantity: remainingToSell,
          entryPrice: currentPrice,
          currentPrice: currentPrice,
          timestamp: Date.now(),
          status: 'OPEN'
        }

        updatedPositions.push(newPosition)
        
        // Capital unchanged - short proceeds are locked as margin/liability
        // Only P&L will affect capital when the short is closed

        const newTrade: Trade = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          action: 'SELL',
          quantity: remainingToSell,
          price: currentPrice,
          reason: reason + (longPositions.length > 0 ? ' (Open short)' : '')
        }

        setTrades(prev => [newTrade, ...prev])
        if (onTradeExecuted && currentCandles.length > 0) {
  onTradeExecuted(
    currentCandles[currentCandles.length - 1].time as number,
    currentPrice,
    'SELL',
    remainingToSell,
    reason + (longPositions.length > 0 ? ' (Open short)' : '')
  )
}
        
        console.log('[SELL-ACTION] Short opened:', {
          posId: newPosition.id,
          quantity: remainingToSell,
          entry: currentPrice,
          capitalUnchanged: true
        })
        
        addLog(`SELL ${remainingToSell} @ ${currentPrice.toFixed(2)} - ${reason}${longPositions.length > 0 ? ' (Open short)' : ''} - Proceeds locked as margin`, {
          proceeds,
          capitalUnchanged: true
        })
      }

      return updatedPositions
    })
  }

  // Update current prices
  useEffect(() => {
    setPositions(prev => prev.map(pos => {
      if (pos.status === 'OPEN') {
        return { ...pos, currentPrice }
      }
      return pos
    }))
  }, [currentPrice])

  // Monitor WebSocket connection status
  useEffect(() => {
    if (wasConnectedRef.current && !isConnected) {
      if (isActive) {
        addLog(`WebSocket disconnected - Auto-stopping strategy`)
        setIsActive(false)
        squareOffAllPositions('WebSocket disconnected')
      }
    } else if (!wasConnectedRef.current && isConnected) {
      addLog(`WebSocket reconnected`)
    }
    
    wasConnectedRef.current = isConnected
  }, [isConnected, isActive])

  // FIXED: Margin call enforcement with proper guards
useEffect(() => {
  if (marginCallTriggered && !marginCallExecutedRef.current) {
    const openCount = openPositions.length
    
    if (openCount > 0) {
      console.log('[MARGIN-CALL] TRIGGERED!', {
        equity,
        marginRequired,
        shortExposure,
        openPositions: openCount,
        deficit: marginRequired - equity
      })
      
      marginCallExecutedRef.current = true
      
      addLog(`⚠️ MARGIN CALL TRIGGERED ⚠️`, {
        equity: equity.toFixed(2),
        required: marginRequired.toFixed(2),
        shortExposure: shortExposure.toFixed(2),
        deficit: (marginRequired - equity).toFixed(2)
      })
      addLog(`Force liquidating ${openCount} position(s)...`)
      
      // ✅ Liquidate positions
      squareOffAllPositions('MARGIN CALL - Forced liquidation')
      
      // ✅ Start 30-second cooldown instead of stopping
      setIsInCooldown(true)
      addLog(`⏸️ Entering 30-second cooldown period...`)
      
      marginCallCooldownRef.current = setTimeout(() => {
        setIsInCooldown(false)
        addLog(`✅ Cooldown complete - Strategy resuming`)
        marginCallCooldownRef.current = null
      }, 30000) as unknown as number  // 30 seconds
    }
  }
  
  if (!marginCallTriggered && marginCallExecutedRef.current) {
    marginCallExecutedRef.current = false
  }
}, [marginCallTriggered, openPositions.length, equity, marginRequired, shortExposure])

// Cleanup cooldown on unmount:
useEffect(() => {
  return () => {
    if (marginCallCooldownRef.current) {
      clearTimeout(marginCallCooldownRef.current)
    }
  }
}, [])
  // FIXED: Safety check with proper dependencies and guards
  useEffect(() => {
    if (!isActive && !isConnected) {
      const openCount = openPositions.length
      if (openCount > 0 && !squareOffInProgressRef.current) {
        console.log('[SAFETY-CHECK] Orphaned positions detected!', {
          count: openCount,
          isActive,
          isConnected,
          positions: openPositions.map(p => ({
            id: p.id,
            side: p.side,
            quantity: p.quantity,
            entry: p.entryPrice
          }))
        })
        
        addLog(`⚠️ Safety check: ${openCount} open position(s) detected while inactive`, {
          isActive,
          isConnected,
          openCount
        })
        squareOffAllPositions('Safety check - Strategy inactive')
      }
    }
  }, [isActive, isConnected, openPositions.length])

  // FIXED: Strategy execution loop with proper cleanup
  useEffect(() => {
    // Always cleanup existing interval first
    if (executionIntervalRef.current) {
      clearInterval(executionIntervalRef.current)
      executionIntervalRef.current = null
    }

    if (isActive && isConnected && isPlaying && strategy) {
      // Execute immediately
      executeStrategy()
      
      // Then set up interval
      executionIntervalRef.current = setInterval(() => {
        executeStrategy()
      }, 2000) as unknown as number

      console.log('[EXECUTION-LOOP] Started with interval:', executionIntervalRef.current)
    }

    // Cleanup function
    return () => {
      if (executionIntervalRef.current) {
        console.log('[EXECUTION-LOOP] Cleaning up interval:', executionIntervalRef.current)
        clearInterval(executionIntervalRef.current)
        executionIntervalRef.current = null
      }
    }
  }, [
    isActive, 
    isConnected,
    isPlaying,
    strategy?.code,
    currentCandles.length,
    currentPrice
  ])

  const handleStart = () => {
    if (!strategy) {
      setError("No strategy selected")
      return
    }
    if (!isConnected) {
      setError("WebSocket not connected - Cannot start strategy")
      return
    }
    if (!isPlaying) {
      setError("Market paused - Cannot start strategy")
      return
    }
    
    setIsActive(true)
    setError(null)
    addLog(`Strategy "${strategy.name}" activated`)
  }

  const handleStop = () => {
    // FIXED: Check if already squaring off to prevent race condition
    if (squareOffInProgressRef.current) {
      addLog(`Square-off already in progress`)
      return
    }
    
    setIsActive(false)
    addLog(`Strategy stopped`)
    
    // Always attempt to square off (idempotent - safe to call even if no positions)
    squareOffAllPositions('Strategy stopped by user')
  }

  const handleReset = () => {
    setIsActive(false)
    setPositions([])
    setTrades([])
    setCapital(initialCapital)
    setLastAction(null)
    setError(null)
    setExecutionLog([])
    isExecutingRef.current = false
    marginCallExecutedRef.current = false
    squareOffInProgressRef.current = false
    addLog(`System reset - Capital restored to ${initialCapital.toFixed(2)}`)
  }

  const handleCopyLogs = () => {
    const logsText = executionLog.join('\n')
    navigator.clipboard.writeText(logsText).then(() => {
      addLog(`Copied ${executionLog.length} log entries to clipboard`)
    }).catch(() => {
      addLog(`Failed to copy logs to clipboard`)
    })
  }

  // DOWNLOAD TRADE REPORT
  const handleDownloadReport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    
    // Generate CSV content
    let csv = 'Trade Report\n'
    csv += `Generated: ${new Date().toLocaleString()}\n`
    csv += `Strategy: ${strategy?.name || 'N/A'}\n`
    csv += `Symbol: ${symbol}\n`
    csv += `Initial Capital: $${initialCapital.toFixed(2)}\n`
    csv += `Final Value: $${totalValue.toFixed(2)}\n`
    csv += `Total Return: ${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%\n`
    csv += `Realized P&L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}\n`
    csv += `Unrealized P&L: ${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}\n`
    csv += `Win Rate: ${winRate.toFixed(1)}%\n`
    csv += `Total Trades: ${trades.length}\n\n`
    
    // Closed Positions Summary
    csv += 'CLOSED POSITIONS\n'
    csv += 'Timestamp,Side,Quantity,Entry Price,Exit Price,P&L,P&L %\n'
    
    closedPositions.forEach(pos => {
      const entryTime = new Date(pos.timestamp).toLocaleString()
      const exitTime = pos.exitTimestamp ? new Date(pos.exitTimestamp).toLocaleString() : 'N/A'
      const pnl = pos.pnl || (pos.exitPrice 
        ? (pos.side === 'BUY' 
          ? (pos.exitPrice - pos.entryPrice) * pos.quantity 
          : (pos.entryPrice - pos.exitPrice) * pos.quantity)
        : 0)
      const pnlPercent = pos.exitPrice 
        ? (pos.side === 'BUY'
          ? ((pos.exitPrice - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - pos.exitPrice) / pos.entryPrice) * 100)
        : 0
      
      csv += `${entryTime},${pos.side},${pos.quantity},${pos.entryPrice.toFixed(2)},${pos.exitPrice?.toFixed(2) || 'N/A'},${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)},${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n`
    })
    
    csv += '\n'
    
    // Open Positions
    if (openPositions.length > 0) {
      csv += 'OPEN POSITIONS\n'
      csv += 'Timestamp,Side,Quantity,Entry Price,Current Price,Unrealized P&L,P&L %\n'
      
      openPositions.forEach(pos => {
        const entryTime = new Date(pos.timestamp).toLocaleString()
        const pnl = pos.side === 'BUY' 
          ? (currentPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - currentPrice) * pos.quantity
        const pnlPercent = pos.side === 'BUY'
          ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100
        
        csv += `${entryTime},${pos.side},${pos.quantity},${pos.entryPrice.toFixed(2)},${currentPrice.toFixed(2)},${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)},${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n`
      })
      
      csv += '\n'
    }
    
    // Trade History
    csv += 'TRADE HISTORY\n'
    csv += 'Timestamp,Action,Quantity,Price,Reason\n'
    
    trades.forEach(trade => {
      const time = new Date(trade.timestamp).toLocaleString()
      csv += `${time},${trade.action},${trade.quantity},${trade.price.toFixed(2)},"${trade.reason}"\n`
    })
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade-report-${symbol}-${timestamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    addLog(`Downloaded trade report: ${trades.length} trades, ${closedPositions.length} closed positions`)
  }

  return (
    <div style={{ 
      width: "100%", 
      height: "100%", 
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
        background: "#0A0A0A"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "1px", color: "#6B7280" }}>
            STRATEGY EXECUTOR
          </div>
          <div style={{ 
            fontSize: "13px", 
            fontWeight: 600,
            color: strategy ? "#FFFFFF" : "#4B5563",
            padding: "4px 12px",
            background: strategy ? "#1A1A1A" : "#0F0F0F",
            borderRadius: "2px"
          }}>
            {strategy ? strategy.name.toUpperCase() : 'NO STRATEGY LOADED'}
          </div>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.5px",
            padding: "4px 8px",
            borderRadius: "2px",
            background: isActive ? "rgba(0, 200, 83, 0.1)" : "rgba(107, 114, 128, 0.1)",
            color: isActive ? "#00C853" : "#6B7280",
            border: `1px solid ${isActive ? "#00C853" : "#374151"}`
          }}>
            {isActive ? 'ACTIVE' : 'INACTIVE'}
          </div>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.5px",
            padding: "4px 8px",
            borderRadius: "2px",
            background: isConnected ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 23, 68, 0.1)",
            color: isConnected ? "#00C853" : "#FF1744",
            border: `1px solid ${isConnected ? "#00C853" : "#FF1744"}`
          }}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
          {isConnected && (
            <div style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              padding: "4px 8px",
              borderRadius: "2px",
              background: isPlaying ? "rgba(59, 130, 246, 0.1)" : "rgba(156, 163, 175, 0.1)",
              color: isPlaying ? "#3B82F6" : "#9CA3AF",
              border: `1px solid ${isPlaying ? "#3B82F6" : "#6B7280"}`
            }}>
              {isPlaying ? 'PLAYING' : 'PAUSED'}
            </div>
          )}
        </div>

        {isInCooldown && (
  <div style={{
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.5px",
    padding: "4px 8px",
    borderRadius: "2px",
    background: "rgba(255, 152, 0, 0.1)",
    color: "#FF9800",
    border: "1px solid #FF9800"
  }}>
    COOLDOWN
  </div>
)}


        <div style={{ display: "flex", gap: "8px" }}>
          {!isActive ? (
            <button
              onClick={handleStart}
              disabled={!strategy || !isConnected || !isPlaying}
              style={{
                padding: "8px 16px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                background: (strategy && isConnected && isPlaying) ? "#E5E7EB" : "#1A1A1A",
                color: (strategy && isConnected && isPlaying) ? "#000000" : "#4B5563",
                border: "none",
                borderRadius: "2px",
                cursor: (strategy && isConnected && isPlaying) ? "pointer" : "not-allowed",
                fontFamily: "'JetBrains Mono', monospace",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (strategy && isConnected && isPlaying) {
                  e.currentTarget.style.background = "#FFFFFF"
                }
              }}
              onMouseLeave={(e) => {
                if (strategy && isConnected && isPlaying) {
                  e.currentTarget.style.background = "#E5E7EB"
                }
              }}
            >
              START
            </button>
          ) : (
            <button
              onClick={handleStop}
              style={{
                padding: "8px 16px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                background: "#000000",
                color: "#FFFFFF",
                border: "1px solid #FFFFFF",
                borderRadius: "2px",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1A1A1A"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#000000"
              }}
            >
              STOP
            </button>
          )}

          <button
            onClick={handleDownloadReport}
            disabled={trades.length === 0}
            style={{
              padding: "8px 16px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              background: trades.length > 0 ? "#1A1A1A" : "#0F0F0F",
              color: trades.length > 0 ? "#FFFFFF" : "#4B5563",
              border: "1px solid #374151",
              borderRadius: "2px",
              cursor: trades.length > 0 ? "pointer" : "not-allowed",
              fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              if (trades.length > 0) {
                e.currentTarget.style.background = "#2A2A2A"
              }
            }}
            onMouseLeave={(e) => {
              if (trades.length > 0) {
                e.currentTarget.style.background = "#1A1A1A"
              }
            }}
          >
            DOWNLOAD
          </button>

          <button
            onClick={handleReset}
            style={{
              padding: "8px 16px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              background: "#000000",
              color: "#6B7280",
              border: "1px solid #1A1A1A",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#0F0F0F"
              e.currentTarget.style.color = "#9CA3AF"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#000000"
              e.currentTarget.style.color = "#6B7280"
            }}
          >
            RESET
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {(lastAction || error) && (
        <div style={{
          padding: "12px 20px",
          background: error ? "rgba(255, 23, 68, 0.1)" : "rgba(0, 200, 83, 0.05)",
          borderBottom: "1px solid #1A1A1A",
          fontSize: "11px"
        }}>
          {lastAction && !error && (
            <div style={{ color: "#00C853" }}>
              LAST ACTION: {lastAction.action} | QUANTITY: {lastAction.quantity} | REASON: {lastAction.reason}
            </div>
          )}
          {error && (
            <div style={{ color: "#FF1744", fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr 400px",
        gap: "1px",
        background: "#1A1A1A",
        overflow: "hidden"
      }}>
        {/* Left: Performance Dashboard */}
        <div style={{ 
          background: "#000000",
          overflow: "auto",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Performance Metrics */}
          <div style={{
            padding: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px"
          }}>
            <MetricCard 
              label="ACCOUNT VALUE" 
              value={`$${totalValue.toFixed(2)}`}
              changeValue={totalValue - initialCapital}
            />
            <MetricCard 
              label="RETURN" 
              value={`${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%`}
              changeValue={returnPercent}
            />
            <MetricCard 
              label="UNREALIZED P&L" 
              value={`${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`}
              changeValue={unrealizedPnL}
            />
            <MetricCard 
              label="REALIZED P&L" 
              value={`${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`}
              changeValue={realizedPnL}
            />
            <MetricCard 
              label="AVAILABLE CAPITAL" 
              value={`$${capital.toFixed(2)}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="WIN RATE" 
              value={`${winRate.toFixed(1)}%`}
              changeValue={winRate - 50}
              isNeutral
            />
            <MetricCard 
              label="TOTAL TRADES" 
              value={`${closedPositions.length}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="NET POSITION" 
              value={`${netPosition >= 0 ? '+' : ''}${netPosition}`}
              changeValue={netPosition}
            />
            {shortExposure > 0 && (
              <>
                <MetricCard 
                  label="SHORT EXPOSURE" 
                  value={`$${shortExposure.toFixed(2)}`}
                  changeValue={0}
                  isNeutral
                />
                <MetricCard 
                  label="MARGIN STATUS" 
                  value={marginCallTriggered ? 'MARGIN CALL' : 'OK'}
                  changeValue={marginCallTriggered ? -1 : 0}
                  isNeutral={!marginCallTriggered}
                />
              </>
            )}
          </div>

          {/* Open Positions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{
              padding: "12px 20px",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "1px",
              color: "#6B7280",
              background: "#0A0A0A",
              borderTop: "1px solid #1A1A1A",
              borderBottom: "1px solid #1A1A1A"
            }}>
              OPEN POSITIONS ({openPositions.length}) | LONG: {longQuantity} | SHORT: {shortQuantity} | NET: {netPosition}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
              {openPositions.length === 0 ? (
                <div style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4B5563",
                  fontSize: "12px"
                }}>
                  NO OPEN POSITIONS
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {openPositions.map(pos => {
                    const pnl = pos.side === 'BUY' 
                      ? (currentPrice - pos.entryPrice) * pos.quantity
                      : (pos.entryPrice - currentPrice) * pos.quantity
                    
                    const pnlPercent = pos.side === 'BUY'
                      ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100
                      : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100
                    
                    const posValue = pos.quantity * currentPrice

                    return (
                      <div 
                        key={pos.id}
                        style={{
                          padding: "12px",
                          background: pnl >= 0 ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 23, 68, 0.1)",
                          border: `1px solid ${pnl >= 0 ? "#00C853" : "#FF1744"}`,
                          borderRadius: "2px"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <div style={{ 
                            fontSize: "11px", 
                            fontWeight: 600,
                            color: pos.side === 'BUY' ? "#00C853" : "#FF1744"
                          }}>
                            {pos.side === 'BUY' ? 'LONG' : 'SHORT'} ×{pos.quantity}
                          </div>
                          <div style={{ 
                            fontSize: "12px", 
                            fontWeight: 600,
                            color: pnl >= 0 ? "#00C853" : "#FF1744",
                            fontFamily: "'JetBrains Mono', monospace"
                          }}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                          </div>
                        </div>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "repeat(3, 1fr)", 
                          gap: "8px",
                          fontSize: "10px"
                        }}>
                          <div>
                            <div style={{ color: "#6B7280", marginBottom: "2px" }}>ENTRY</div>
                            <div style={{ color: "#FFFFFF" }}>{pos.entryPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ color: "#6B7280", marginBottom: "2px" }}>CURRENT</div>
                            <div style={{ color: "#FFFFFF" }}>{currentPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ color: "#6B7280", marginBottom: "2px" }}>VALUE</div>
                            <div style={{ color: "#FFFFFF" }}>{posValue.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Trade History */}
        <div style={{ 
          background: "#000000",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "12px 20px",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#6B7280",
            background: "#0A0A0A",
            borderBottom: "1px solid #1A1A1A"
          }}>
            TRADE HISTORY ({trades.length})
          </div>

          <div style={{ 
            flex: 1,
            overflow: "auto",
            padding: "12px 20px"
          }}>
            {trades.length === 0 ? (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#4B5563",
                fontSize: "12px"
              }}>
                NO TRADES EXECUTED
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {trades.map((trade) => (
                  <div 
                    key={trade.id}
                    style={{
                      padding: "10px 12px",
                      background: "#0A0A0A",
                      borderLeft: `2px solid ${trade.action === 'BUY' ? "#00C853" : "#FF1744"}`,
                      fontSize: "10px",
                      flexShrink: 0
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between",
                      marginBottom: "4px"
                    }}>
                      <div style={{ 
                        fontWeight: 600,
                        color: trade.action === 'BUY' ? "#00C853" : "#FF1744"
                      }}>
                        {trade.action} ×{trade.quantity} @ {trade.price.toFixed(2)}
                      </div>
                      <div style={{ color: "#6B7280" }}>
                        {new Date(trade.timestamp).toLocaleTimeString('en-US', { 
                          hour12: false, 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          second: '2-digit' 
                        })}
                      </div>
                    </div>
                    <div style={{ color: "#8B92A8", fontSize: "9px" }}>
                      {trade.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Execution Log */}
        <div style={{ 
          background: "#000000",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            padding: "12px 16px",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#6B7280",
            background: "#0A0A0A",
            borderBottom: "1px solid #1A1A1A",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>EXECUTION LOG ({executionLog.length})</span>
            <button
              onClick={handleCopyLogs}
              disabled={executionLog.length === 0}
              style={{
                padding: "4px 8px",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                background: executionLog.length > 0 ? "#1A1A1A" : "#0F0F0F",
                color: executionLog.length > 0 ? "#FFFFFF" : "#4B5563",
                border: "1px solid #374151",
                borderRadius: "2px",
                cursor: executionLog.length > 0 ? "pointer" : "not-allowed",
                fontFamily: "'JetBrains Mono', monospace",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (executionLog.length > 0) {
                  e.currentTarget.style.background = "#2A2A2A"
                }
              }}
              onMouseLeave={(e) => {
                if (executionLog.length > 0) {
                  e.currentTarget.style.background = "#1A1A1A"
                }
              }}
            >
              COPY ALL
            </button>
          </div>

          <div style={{ 
            flex: 1, 
            overflow: "auto",
            padding: "12px 16px",
            fontSize: "10px",
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: "1.6",
            userSelect: "text"
          }}>
            {executionLog.length === 0 ? (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#4B5563"
              }}>
                NO ACTIVITY
              </div>
            ) : (
              executionLog.map((log, index) => (
                <div 
                  key={index}
                  style={{
                    padding: "6px 0",
                    color: log.includes('ERROR') ? "#FF1744" : 
                           log.includes('BUY') || log.includes('SELL') ? "#00C853" :
                           "#8B92A8",
                    borderBottom: index < executionLog.length - 1 ? "1px solid #0F0F0F" : "none",
                    userSelect: "text",
                    cursor: "text"
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ 
  label, 
  value, 
  changeValue,
  isNeutral 
}: { 
  label: string
  value: string
  changeValue: number
  isNeutral?: boolean 
}) {
  const getBackgroundColor = () => {
    if (isNeutral || changeValue === 0) return "#0A0A0A"
    return changeValue > 0 ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 23, 68, 0.1)"
  }

  const getBorderColor = () => {
    if (isNeutral || changeValue === 0) return "#1A1A1A"
    return changeValue > 0 ? "#00C853" : "#FF1744"
  }

  const getValueColor = () => {
    if (isNeutral || changeValue === 0) return "#8B92A8"
    return changeValue > 0 ? "#00C853" : "#FF1744"
  }

  return (
    <div style={{
      padding: "12px",
      background: getBackgroundColor(),
      border: `1px solid ${getBorderColor()}`,
      borderRadius: "2px"
    }}>
      <div style={{ 
        fontSize: "9px", 
        fontWeight: 600, 
        letterSpacing: "0.5px",
        color: "#6B7280",
        marginBottom: "6px"
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: "16px", 
        fontWeight: 600,
        color: getValueColor(),
        fontFamily: "'JetBrains Mono', monospace"
      }}>
        {value}
      </div>
    </div>
  )
}
