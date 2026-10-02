import { useState } from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_PLAYER_NAMES } from '../types'
import Logo from './Logo'

interface Props {
  playerNames: string[]
  onStart: (names: string[]) => void
}

export default function SetupScreen({ playerNames, onStart }: Props) {
  // inputs start empty when the names are still the defaults, so the host types
  // straight away instead of deleting "Гравець 1" first
  const [names, setNames] = useState<string[]>(() =>
    playerNames.map((name, i) => (name === DEFAULT_PLAYER_NAMES[i] ? '' : name)),
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onStart(names.map((name, i) => name.trim() || DEFAULT_PLAYER_NAMES[i]))
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

        <div className="setup-inputs">
          {names.map((name, i) => (
            <label key={i} className="setup-field">
              <span className="setup-label">Гравець {i + 1}</span>
              <input
                className="setup-input neon-block"
                value={name}
                placeholder={DEFAULT_PLAYER_NAMES[i]}
                maxLength={20}
                autoFocus={i === 0}
                onChange={(e) => setNames((prev) => prev.map((n, k) => (k === i ? e.target.value : n)))}
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
