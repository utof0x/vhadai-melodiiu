import { useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import type { RoundId } from '../types'
import { DEFAULT_PLAYER_NAMES, ROUND_ORDER, ROUND_PLAYERS, ROUND_TITLES } from '../types'
import { BUZZER_URL, buzzerRoom } from '../buzzer'
import Logo from './Logo'

interface Props {
  // `active` are the player slots still in the game when it starts at `round`
  onStart: (names: string[], round: RoundId, active: number[]) => void
}

export default function SetupScreen({ onStart }: Props) {
  // the names live in the buzzer room: a phone that joins fills in its own
  // slot, and the host can still type or fix any of them by hand
  const room = useSyncExternalStore(buzzerRoom.subscribe, buzzerRoom.getSnapshot)

  // recovery after a reload or a crash: jump straight to a later round with whoever was still in
  const [round, setRound] = useState<RoundId>('quiz')
  const [playing, setPlaying] = useState<boolean[]>(() => DEFAULT_PLAYER_NAMES.map(() => true))

  const needed = ROUND_PLAYERS[round]
  const active = playing.map((on, i) => (on ? i : -1)).filter((i) => i >= 0)
  const isValid = round === 'quiz' || active.length === needed

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    const names = room.names.map((name, i) => name.trim() || DEFAULT_PLAYER_NAMES[i])
    onStart(names, round, round === 'quiz' ? DEFAULT_PLAYER_NAMES.map((_, i) => i) : active)
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
                {round !== 'quiz' && (
                  <button
                    type="button"
                    className={`setup-playing${playing[i] ? ' on' : ''}`}
                    onClick={() => setPlaying((prev) => prev.map((on, k) => (k === i ? !on : on)))}
                  >
                    {playing[i] ? 'у грі' : 'вибув'}
                  </button>
                )}
              </span>
              <input
                className={`setup-input neon-block${room.phones[i] ? ' has-phone' : ''}${
                  round !== 'quiz' && !playing[i] ? ' sitting-out' : ''
                }`}
                value={name}
                placeholder={DEFAULT_PLAYER_NAMES[i]}
                maxLength={20}
                autoFocus={i === 0}
                onChange={(e) => buzzerRoom.setName(i, e.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="setup-from">
          <span className="setup-label">Почати з</span>
          {ROUND_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              className={`setup-from-option${r === round ? ' on' : ''}`}
              onClick={() => setRound(r)}
            >
              {ROUND_TITLES[r].label}
            </button>
          ))}
        </div>

        <button type="submit" className="pill gold-pill setup-start" disabled={!isValid}>
          {isValid ? 'Почати гру' : `Позначте, хто у грі: ${needed} з ${playing.length}`}
        </button>
      </motion.form>
    </div>
  )
}
