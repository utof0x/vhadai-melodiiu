import { useEffect, useEffectEvent, useState } from 'react'
import { motion } from 'framer-motion'
import type { RoundId, RoundPlayer } from '../types'
import { ROUND_TITLES } from '../types'
import KeyHints from './KeyHints'

interface Props {
  round: RoundId // the round that just ended
  players: RoundPlayer[]
  scores: number[]
  pickCount: number // how many players go through
  onConfirm: (playerIndices: number[]) => void
  onBack: () => void
}

export default function StandingsScreen({ round, players, scores, pickCount, onConfirm, onBack }: Props) {
  const ranked = [...players].sort((a, b) => scores[b.index] - scores[a.index])
  // the top scorers are preselected; the host can re-pick by hand, which is
  // also how a tie on the cut line gets settled
  const [picked, setPicked] = useState<number[]>(() => ranked.slice(0, pickCount).map((p) => p.index))

  const isTie = ranked.length > pickCount && scores[ranked[pickCount - 1].index] === scores[ranked[pickCount].index]
  const isValid = picked.length === pickCount

  function toggle(playerIndex: number) {
    setPicked((prev) => (prev.includes(playerIndex) ? prev.filter((i) => i !== playerIndex) : [...prev, playerIndex]))
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return
    const digit = e.key >= '1' && e.key <= '9' ? Number(e.key) - 1 : null
    if (digit !== null && ranked[digit]) {
      toggle(ranked[digit].index)
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
      e.preventDefault()
      if (isValid) onConfirm(picked)
    } else if (e.code === 'ArrowLeft') {
      onBack()
    }
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="screen round-screen">
      <div className="round-header">
        <span className="pill gold-pill">{ROUND_TITLES[round].name}</span>
        <span className="round-header-theme">Підсумки раунду</span>
      </div>

      <div className="round-body">
        <div className="standings">
          {ranked.map((p, pos) => (
            <motion.button
              key={p.index}
              type="button"
              className={`standings-row neon-block${picked.includes(p.index) ? ' picked' : ''}`}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: pos * 0.12, duration: 0.35 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle(p.index)}
            >
              <span className="standings-rank">{pos + 1}</span>
              <span className="standings-name">{p.name}</span>
              <span className="standings-score">{scores[p.index]}</span>
            </motion.button>
          ))}
        </div>
        <div className={`standings-note${isValid && !isTie ? '' : ' warn'}`}>
          {!isValid
            ? `Оберіть ${pickCount === 1 ? 'одного гравця' : `${pickCount} гравців`}, щоб продовжити`
            : isTie
              ? 'Нічия — перевірте, хто проходить далі'
              : pickCount === 1
                ? 'У фінал проходить переможець'
                : `Далі проходять ${pickCount === 2 ? 'двоє' : 'троє'} найкращих`}
        </div>
      </div>

      <KeyHints hints={[[`1–${ranked.length}`, 'змінити вибір'], ['Space', 'далі'], ['←', 'переграти раунд']]} />
    </div>
  )
}
