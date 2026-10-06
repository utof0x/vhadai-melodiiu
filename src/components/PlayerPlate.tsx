interface Props {
  name: string
  score?: number
  hotkey?: string
  state?: 'idle' | 'active' | 'locked'
  phone?: boolean // a phone buzzer is connected for this player
  note?: string // short status line under the score
  onClick?: () => void
}

export default function PlayerPlate({ name, score, hotkey, state = 'idle', phone, note, onClick }: Props) {
  return (
    <button
      type="button"
      className={`player-plate neon-block ${state}`}
      // keeps keyboard focus off the plate, so Space/Enter never re-trigger the click
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={!onClick}
    >
      {hotkey && <span className="player-plate-key">{hotkey}</span>}
      {phone && <span className="player-plate-phone" title="телефон підключено" />}
      <span className="player-plate-name">{name}</span>
      {score !== undefined && <span className="player-plate-score">{score}</span>}
      {note && <span className="player-plate-note">{note}</span>}
    </button>
  )
}
