type Props = {
  symbols: string[]
  symbol: string
  setSymbol: (v: string) => void
  start: string
  setStart: (v: string) => void
  end: string
  setEnd: (v: string) => void
  timeScale: number
  setTimeScale: (v: number) => void
  gapScale: number
  setGapScale: (n: number) => void
  playing: boolean
  onPlay: () => void
  onPause?: () => void
  onReplay?: () => void
  isConnected: boolean
}

const inputStyle = {
  background: "#0A0A0A",
  color: "#FFFFFF",
  padding: "8px 12px",
  borderRadius: "2px",
  border: "1px solid #1A1A1A",
  fontSize: "11px",
  outline: "none",
  fontWeight: 500 as const,
  fontFamily: "'JetBrains Mono', monospace",
  transition: "all 0.2s"
}

const labelStyle = {
  fontSize: "9px",
  fontWeight: 600 as const,
  color: "#6B7280",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  marginBottom: "6px"
}

export function TopBar({
  symbols,
  symbol,
  setSymbol,
  start,
  setStart,
  end,
  setEnd,
  timeScale,
  setTimeScale,
  gapScale,
  setGapScale,
  playing,
  onPlay,
  onPause,
  onReplay,
  isConnected,
}: Props) {
  return (
    <div style={{
      background: "#0A0A0A",
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      borderBottom: "1px solid #1A1A1A"
    }}>
      {/* Branding */}
      <div style={{ 
        fontSize: "11px", 
        fontWeight: 600, 
        letterSpacing: "1px", 
        color: "#6B7280",
        fontFamily: "'JetBrains Mono', monospace"
      }}>
        MARKET REPLAY
      </div>

      <div style={{ width: "1px", height: "32px", background: "#1A1A1A" }} />

      {/* Date Range */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={labelStyle}>START DATE</label>
        <input 
          type="datetime-local" 
          value={start} 
          onChange={(e) => setStart(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid #374151"
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid #1A1A1A"
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={labelStyle}>END DATE</label>
        <input 
          type="datetime-local" 
          value={end} 
          onChange={(e) => setEnd(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid #374151"
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid #1A1A1A"
          }}
        />
      </div>

      <div style={{ width: "1px", height: "32px", background: "#1A1A1A" }} />

      {/* Time Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={labelStyle}>SPEED (MS)</label>
        <input
          type="number"
          value={timeScale}
          onChange={(e) => setTimeScale(Number(e.target.value))}
          style={{ ...inputStyle, width: "100px" }}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid #374151"
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid #1A1A1A"
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={labelStyle}>GAP SCALE</label>
        <select
          value={gapScale}
          onChange={(e) => setGapScale(Number(e.target.value))}
          style={{ 
            ...inputStyle, 
            cursor: "pointer", 
            width: "100px",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23FFFFFF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: "36px"
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid #374151"
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid #1A1A1A"
          }}
        >
          <option value={1000}>SLOW</option>
          <option value={10000}>MEDIUM</option>
          <option value={100000}>FAST</option>
          <option value={1000000}>INSTANT</option>
        </select>
      </div>

      <div style={{ flex: 1 }} />

      {/* Connection Status */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        background: isConnected ? "rgba(255, 23, 68, 0.1)" : "#0A0A0A",
        border: `1px solid ${isConnected ? "#FF1744" : "#374151"}`,
        borderRadius: "2px"
      }}>
        <div style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: isConnected ? "#FF1744" : "#4B5563",
          boxShadow: isConnected ? "0 0 8px rgba(255, 23, 68, 0.5)" : "none"
        }} />
        <span style={{ 
          fontSize: "10px", 
          color: isConnected ? "#FF1744" : "#6B7280", 
          fontWeight: 600,
          letterSpacing: "0.5px",
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          {isConnected ? 'REPLAY MODE' : 'OFFLINE'}
        </span>
      </div>

      {/* Playback Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Replay Button */}
        {!isConnected && onReplay && (
          <button 
            onClick={onReplay}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontWeight: 600,
              fontSize: "11px",
              border: "none",
              cursor: "pointer",
              background: "#E5E7EB",
              color: "#000000",
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
            REPLAY
          </button>
        )}

        {/* Play Button */}
        {isConnected && !playing && (
          <button 
            onClick={onPlay}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontWeight: 600,
              fontSize: "11px",
              border: "none",
              cursor: "pointer",
              background: "#00C853",
              color: "#000000",
              transition: "all 0.2s",
              letterSpacing: "0.5px",
              fontFamily: "'JetBrains Mono', monospace"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#00C853"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#00C853"
            }}
          >
            PLAY
          </button>
        )}

        {/* Pause Button */}
        {isConnected && playing && (
          <button 
            onClick={onPause}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontWeight: 600,
              fontSize: "11px",
              border: "1px solid #FFFFFF",
              cursor: "pointer",
              background: "#000000",
              color: "#FFFFFF",
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
            PAUSE
          </button>
        )}

        {/* Initial Play Button (Disabled) */}
        {!isConnected && !onReplay && (
          <button 
            disabled={true}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontWeight: 600,
              fontSize: "11px",
              border: "1px solid #374151",
              cursor: "not-allowed",
              background: "#0F0F0F",
              color: "#4B5563",
              letterSpacing: "0.5px",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          >
            PLAY
          </button>
        )}
      </div>
    </div>
  )
}