type Props = {
  symbols: string[]
  value: string
  onChange: (symbol: string) => void
}

export function SymbolSelector({ symbols, value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-slate-800 text-white p-2 rounded"
    >
      <option value="">Select symbol</option>

      {symbols.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}