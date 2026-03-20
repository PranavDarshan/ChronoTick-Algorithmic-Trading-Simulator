import { useState } from "react"

type Props = {
  initialCapital: number
  onUpdateCapital: (capital: number) => void
  currentCapital: number
  positions: any[]
  trades: any[]
}

export default function CapitalManager({ 
  initialCapital, 
  onUpdateCapital,
  currentCapital,
  positions,
  trades
}: Props) {
  const [newCapital, setNewCapital] = useState(initialCapital.toString())
  const [maxPositionSize, setMaxPositionSize] = useState("20")
  const [maxPositions, setMaxPositions] = useState("5")
  const [stopLossPercent, setStopLossPercent] = useState("2")
  const [takeProfitPercent, setTakeProfitPercent] = useState("5")
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const handleUpdateCapital = () => {
    const capital = parseFloat(newCapital)
    if (isNaN(capital) || capital <= 0) {
      setUpdateMessage("ERROR: Invalid capital amount")
      setTimeout(() => setUpdateMessage(null), 3000)
      return
    }
    onUpdateCapital(capital)
    setUpdateMessage(`Capital updated to $${capital.toFixed(2)}`)
    setTimeout(() => setUpdateMessage(null), 3000)
  }

  const handleSaveRiskParams = () => {
    setUpdateMessage("Risk parameters saved")
    setTimeout(() => setUpdateMessage(null), 3000)
  }

  // Calculate statistics
  const openPositions = positions.filter(p => p.status === 'OPEN')
  const closedTrades = trades.length

  const totalInvested = openPositions.reduce((sum, pos) => {
    return sum + (pos.entryPrice * pos.quantity)
  }, 0)

  const utilizationPercent = initialCapital > 0 
    ? (totalInvested / initialCapital) * 100 
    : 0

  const winningTrades = trades.filter(t => {
    // This is simplified - you'd need actual P&L data
    return t.action === 'SELL' // Placeholder
  }).length

  const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0

  const maxPositionValue = initialCapital * parseFloat(maxPositionSize || "0") / 100

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
        background: "#0A0A0A"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "1px", color: "#6B7280" }}>
            CAPITAL MANAGER
          </div>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.5px",
            padding: "4px 8px",
            borderRadius: "2px",
            background: "rgba(33, 150, 243, 0.1)",
            color: "#2196F3",
            border: "1px solid #2196F3"
          }}>
            CONFIGURATION
          </div>
        </div>
      </div>

      {/* Status Message */}
      {updateMessage && (
        <div style={{
          padding: "12px 20px",
          background: updateMessage.includes("ERROR") 
            ? "rgba(255, 23, 68, 0.1)" 
            : "rgba(0, 200, 83, 0.1)",
          borderBottom: "1px solid #1A1A1A",
          fontSize: "11px",
          color: updateMessage.includes("ERROR") ? "#FF1744" : "#00C853",
          fontWeight: 600
        }}>
          {updateMessage}
        </div>
      )}

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "1px",
        background: "#1A1A1A"
      }}>
        {/* Capital Overview Section */}
        <div style={{ 
          background: "#000000",
          padding: "20px"
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#6B7280",
            marginBottom: "16px"
          }}>
            CAPITAL OVERVIEW
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px"
          }}>
            <MetricCard 
              label="INITIAL CAPITAL" 
              value={`$${initialCapital.toFixed(2)}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="AVAILABLE CAPITAL" 
              value={`$${currentCapital.toFixed(2)}`}
              changeValue={currentCapital - initialCapital}
            />
            <MetricCard 
              label="CAPITAL INVESTED" 
              value={`$${totalInvested.toFixed(2)}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="UTILIZATION" 
              value={`${utilizationPercent.toFixed(1)}%`}
              changeValue={utilizationPercent - 50}
            />
          </div>

          {/* Utilization Bar */}
          <div style={{ marginTop: "16px" }}>
            <div style={{
              height: "4px",
              background: "#0A0A0A",
              borderRadius: "2px",
              overflow: "hidden",
              position: "relative"
            }}>
              <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${Math.min(utilizationPercent, 100)}%`,
                background: utilizationPercent > 80 ? "#FF1744" :
                           utilizationPercent > 50 ? "#FF9800" : "#00C853",
                transition: "width 0.3s ease"
              }} />
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              fontSize: "9px", 
              color: "#4B5563",
              marginTop: "6px",
              fontWeight: 600
            }}>
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Update Capital Section */}
        <div style={{ 
          background: "#000000",
          padding: "20px"
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#6B7280",
            marginBottom: "16px"
          }}>
            UPDATE CAPITAL
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ 
              fontSize: "9px", 
              color: "#6B7280", 
              fontWeight: 600,
              marginBottom: "6px",
              display: "block",
              letterSpacing: "0.5px"
            }}>
              NEW CAPITAL AMOUNT
            </label>
            <input
              type="number"
              step="1000"
              value={newCapital}
              onChange={(e) => setNewCapital(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0A0A0A",
                border: "1px solid #1A1A1A",
                borderRadius: "2px",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#374151"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#1A1A1A"
              }}
            />
          </div>

          <button
            onClick={handleUpdateCapital}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "#E5E7EB",
              border: "none",
              borderRadius: "2px",
              color: "#000000",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.5px",
              fontFamily: "'JetBrains Mono', monospace"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FFFFFF"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#E5E7EB"
            }}
          >
            UPDATE CAPITAL
          </button>

          <div style={{
            marginTop: "12px",
            padding: "10px 12px",
            background: "rgba(255, 152, 0, 0.1)",
            border: "1px solid #FF9800",
            borderRadius: "2px",
            fontSize: "9px",
            color: "#8B92A8",
            lineHeight: "1.5",
            fontWeight: 500
          }}>
            ⚠️ WARNING: Updating capital will reset all positions and trades
          </div>
        </div>

        {/* Risk Management Section */}
        <div style={{ 
          background: "#000000",
          padding: "20px"
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#6B7280",
            marginBottom: "16px"
          }}>
            RISK MANAGEMENT
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Max Position Size */}
            <div>
              <label style={{ 
                fontSize: "9px", 
                color: "#6B7280", 
                fontWeight: 600,
                marginBottom: "6px",
                display: "block",
                letterSpacing: "0.5px"
              }}>
                MAX POSITION SIZE (% OF CAPITAL)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={maxPositionSize}
                onChange={(e) => setMaxPositionSize(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#0A0A0A",
                  border: "1px solid #1A1A1A",
                  borderRadius: "2px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#374151"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#1A1A1A"
                }}
              />
              <div style={{ 
                fontSize: "9px", 
                color: "#4B5563", 
                marginTop: "4px",
                fontWeight: 600
              }}>
                MAX ${maxPositionValue.toFixed(2)} PER POSITION
              </div>
            </div>

            {/* Max Positions */}
            <div>
              <label style={{ 
                fontSize: "9px", 
                color: "#6B7280", 
                fontWeight: 600,
                marginBottom: "6px",
                display: "block",
                letterSpacing: "0.5px"
              }}>
                MAX CONCURRENT POSITIONS
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="20"
                value={maxPositions}
                onChange={(e) => setMaxPositions(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#0A0A0A",
                  border: "1px solid #1A1A1A",
                  borderRadius: "2px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#374151"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#1A1A1A"
                }}
              />
            </div>

            {/* Stop Loss */}
            <div>
              <label style={{ 
                fontSize: "9px", 
                color: "#6B7280", 
                fontWeight: 600,
                marginBottom: "6px",
                display: "block",
                letterSpacing: "0.5px"
              }}>
                DEFAULT STOP LOSS (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="20"
                value={stopLossPercent}
                onChange={(e) => setStopLossPercent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#0A0A0A",
                  border: "1px solid #1A1A1A",
                  borderRadius: "2px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#374151"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#1A1A1A"
                }}
              />
            </div>

            {/* Take Profit */}
            <div>
              <label style={{ 
                fontSize: "9px", 
                color: "#6B7280", 
                fontWeight: 600,
                marginBottom: "6px",
                display: "block",
                letterSpacing: "0.5px"
              }}>
                DEFAULT TAKE PROFIT (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={takeProfitPercent}
                onChange={(e) => setTakeProfitPercent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#0A0A0A",
                  border: "1px solid #1A1A1A",
                  borderRadius: "2px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#374151"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#1A1A1A"
                }}
              />
            </div>
          </div>

          <button
            onClick={handleSaveRiskParams}
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "10px 16px",
              background: "#000000",
              border: "1px solid #FFFFFF",
              borderRadius: "2px",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.5px",
              fontFamily: "'JetBrains Mono', monospace"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1A1A1A"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#000000"
            }}
          >
            SAVE RISK PARAMETERS
          </button>
        </div>

        {/* Trading Statistics Section */}
        <div style={{ 
          background: "#000000",
          padding: "20px"
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#6B7280",
            marginBottom: "16px"
          }}>
            TRADING STATISTICS
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px"
          }}>
            <MetricCard 
              label="OPEN POSITIONS" 
              value={`${openPositions.length}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="TOTAL TRADES" 
              value={`${closedTrades}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="WINNING TRADES" 
              value={`${winningTrades}`}
              changeValue={0}
              isNeutral
            />
            <MetricCard 
              label="WIN RATE" 
              value={`${winRate.toFixed(1)}%`}
              changeValue={winRate - 50}
            />
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