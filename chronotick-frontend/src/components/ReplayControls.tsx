type Props = {
  speed: number
  onSpeedChange: (v: number) => void
  onStart: () => void
}

export function ReplayControls({ speed, onSpeedChange, onStart }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
      <div>
        <label style={{ fontSize: 12, color: "#9ca3af" }}>Speed</label>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={{ width: 110, marginTop: 4 }}
        >
          <option value={60}>1×</option>
          <option value={300}>5×</option>
          <option value={600}>10×</option>
          <option value={3600}>1h/sec</option>
        </select>
      </div>

      <button
        onClick={onStart}
        style={{
          height: 32,
          padding: "0 16px",
          backgroundColor: "#16a34a",
        }}
      >
        ▶ Start
      </button>
    </div>
  )
}