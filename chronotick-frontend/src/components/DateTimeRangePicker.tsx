type Props = {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}

export function DateTimeRangePicker({ start, end, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
      <input
        type="datetime-local"
        value={start}
        onChange={(e) => onChange(e.target.value, end)}
        style={{ width: 180 }}
      />
      <input
        type="datetime-local"
        value={end}
        onChange={(e) => onChange(start, e.target.value)}
        style={{ width: 180 }}
      />
    </div>
  )
}
