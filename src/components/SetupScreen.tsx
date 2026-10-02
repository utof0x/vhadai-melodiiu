import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_PLAYER_NAMES } from '../types'
import { BUZZER_URL, buzzerRoom } from '../buzzer'
import Logo from './Logo'

interface Props {
  onStart: (names: string[]) => void
}

export default function SetupScreen({ onStart }: Props) {
  // the names live in the buzzer room: a phone that joins fills in its own
  // slot, and the host can still type or fix any of them by hand
  const room = useSyncExternalStore(buzzerRoom.subscribe, buzzerRoom.getSnapshot)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onStart(room.names.map((name, i) => name.trim() || DEFAULT_PLAYER_NAMES[i]))
  }

  return (
    <div className="screen">
      <motion.form
        className="setup-wrap"
        onSubmit={submit}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Logo size="small" />

        <div className="setup-room">
          {room.status === 'open' && (
            <>
              <span className="setup-room-code">{room.code}</span>
              <span className="setup-room-note">
                Кнопка на телефоні: <b>{BUZZER_URL}</b> → «Вгадай мелодію» → цей код
              </span>
            </>
          )}
          {room.status === 'connecting' && <span className="setup-room-note">Готуємо кімнату для телефонів…</span>}
          {room.status === 'failed' && (
            <span className="setup-room-note">Телефони недоступні — ведучий натискає 1–4 на клавіатурі</span>
          )}
        </div>

        <div className="setup-inputs">
          {room.names.map((name, i) => (
            <label key={i} className="setup-field">
              <span className="setup-label">
                Гравець {i + 1}
                {room.phones[i] && <span className="setup-phone">телефон підключено</span>}
              </span>
              <input
                className={`setup-input neon-block${room.phones[i] ? ' has-phone' : ''}`}
                value={name}
                placeholder={DEFAULT_PLAYER_NAMES[i]}
                maxLength={20}
                autoFocus={i === 0}
                onChange={(e) => buzzerRoom.setName(i, e.target.value)}
              />
            </label>
          ))}
        </div>

        <button type="submit" className="pill gold-pill setup-start">
          Почати гру
        </button>
      </motion.form>
    </div>
  )
}
