interface Props {
  hints: [key: string, label: string][]
}

// host cheat-sheet along the bottom edge; H toggles it (see .hints-hidden in index.css)
export default function KeyHints({ hints }: Props) {
  return (
    <div className="key-hints">
      {hints.map(([key, label]) => (
        <span key={key} className="key-hint">
          <kbd>{key}</kbd>
          {label}
        </span>
      ))}
      <span className="key-hint">
        <kbd>H</kbd>
        сховати
      </span>
    </div>
  )
}
