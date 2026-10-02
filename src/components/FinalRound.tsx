import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { FinalResult, RoundPlayer } from '../types'
import { FINAL_SECONDS, FINAL_SONGS } from '../data/songs'
import { playDing, playWrong } from '../sfx'
import KeyHints from './KeyHints'

// ready: waiting for the host to start the clock
// playing: a melody is on and the clock runs
// stopped: the player stopped the melody to answer; clock and music are paused
// won / wrong / timeout: the final is over
type Stage = 'ready' | 'playing' | 'stopped' | FinalResult['outcome']

interface Props {
  player: RoundPlayer
  onDone: (result: FinalResult) => void
  onBack: () => void
}

const HINTS: Record<Stage, [string, string][]> = {
  ready: [['Space', 'старт'], ['←', 'назад']],
  playing: [['Space', 'стоп — гравець відповідає'], ['→', 'пропустити']],
  stopped: [['Enter', 'правильно'], ['Backspace', 'неправильно'], ['Esc', 'грати далі']],
  won: [['Space', 'далі']],
  wrong: [['Space', 'далі']],
  timeout: [['Space', 'далі']],
}

const OUTCOME_TEXT: Record<FinalResult['outcome'], string> = {
  won: 'Усі мелодії вгадано!',
  wrong: 'Неправильна відповідь',
  timeout: 'Час вийшов',
}

const TOTAL_MS = FINAL_SECONDS * 1000
const WAVE_BARS = [0.35, 0.7, 1, 0.55, 0.8]

export default function FinalRound({ player, onDone, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('ready')
  const [guessed, setGuessed] = useState<boolean[]>(() => FINAL_SONGS.map(() => false))
  const [current, setCurrent] = useState(0)
  const [remainingMs, setRemainingMs] = useState(TOTAL_MS)
  const remainingRef = useRef(TOTAL_MS)
  // one element per melody, so a skipped one picks up where it left off when it comes round again
  const audiosRef = useRef<(HTMLAudioElement | null)[]>([])

  const isOver = stage === 'won' || stage === 'wrong' || stage === 'timeout'
  const guessedCount = guessed.filter(Boolean).length

  function playSong(i: number) {
    let audio = audiosRef.current[i]
    if (!audio) {
      const src = FINAL_SONGS[i].minus
      if (!src) return
      audio = new Audio(src)
      audio.loop = true
      audiosRef.current[i] = audio
    }
    audio.play().catch(() => {})
  }

  function pauseAll() {
    for (const audio of audiosRef.current) audio?.pause()
  }

  useEffect(() => () => pauseAll(), [])

  // next not-yet-guessed melody after `from`, wrapping round; null when none is left
  function nextPending(from: number, state: boolean[]): number | null {
    for (let step = 1; step <= FINAL_SONGS.length; step++) {
      const i = (from + step) % FINAL_SONGS.length
      if (!state[i]) return i
    }
    return null
  }

  const timeUp = useEffectEvent(() => {
    pauseAll()
    playWrong()
    setStage('timeout')
  })

  useEffect(() => {
    if (stage !== 'playing') return
    const startedAt = performance.now()
    const startRemaining = remainingRef.current
    const id = setInterval(() => {
      const left = Math.max(0, startRemaining - (performance.now() - startedAt))
      remainingRef.current = left
      setRemainingMs(left)
      if (left <= 0) timeUp()
    }, 100)
    return () => clearInterval(id)
  }, [stage])

  function start() {
    playSong(current)
    setStage('playing')
  }

  function stop() {
    pauseAll()
    setStage('stopped')
  }

  function skip() {
    const next = nextPending(current, guessed)
    if (next === null || next === current) return
    pauseAll()
    setCurrent(next)
    playSong(next)
  }

  function judge(correct: boolean) {
    if (stage !== 'stopped') return
    if (!correct) {
      playWrong()
      setStage('wrong')
      return
    }
    playDing()
    const nextGuessed = guessed.map((g, i) => (i === current ? true : g))
    setGuessed(nextGuessed)
    const next = nextPending(current, nextGuessed)
    if (next === null) {
      setStage('won')
      return
    }
    setCurrent(next)
    playSong(next)
    setStage('playing')
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return
    const isForward = e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight'
    if (isForward || e.code === 'Backspace') e.preventDefault()

    if (stage === 'ready') {
      if (e.code === 'Space' || e.code === 'Enter') start()
      else if (e.code === 'ArrowLeft') onBack()
    } else if (stage === 'playing') {
      if (e.code === 'Space') stop()
      else if (e.code === 'ArrowRight') skip()
    } else if (stage === 'stopped') {
      if (e.code === 'Enter') judge(true)
      else if (e.code === 'Backspace') judge(false)
      else if (e.code === 'Escape') start()
    } else if (isForward && (stage === 'won' || stage === 'wrong' || stage === 'timeout')) {
      onDone({ guessed: guessedCount, total: FINAL_SONGS.length, outcome: stage })
    }
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <div className="screen round-screen final-screen">
      <div className="round-header">
        <span className="pill gold-pill">Фінал</span>
        <span className="final-player neon-block">{player.name}</span>
      </div>

      <div className="round-body">
        <div className="final-row">
          <div className="final-discs">
            {FINAL_SONGS.map((_, i) => (
              <div
                key={i}
                className={`final-disc${guessed[i] ? ' guessed' : ''}${i === current && !isOver ? ' current' : ''}`}
              >
                <Wave />
                <span className="final-disc-number">{i + 1}</span>
                <Wave />
              </div>
            ))}
          </div>
          <div
            className={`final-timer${stage === 'playing' ? ' running' : ''}${seconds <= 5 && !isOver ? ' low' : ''}`}
            style={{ '--progress': remainingMs / TOTAL_MS } as React.CSSProperties}
          >
            <span>{seconds}</span>
          </div>
        </div>

        <div className="final-status">
          {stage === 'ready' && <span className="song-stage-note">{FINAL_SONGS.length} мелодій · {FINAL_SECONDS} секунд</span>}
          {stage === 'stopped' && (
            <motion.span
              className="song-stage-answering"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0.45, duration: 0.5 }}
            >
              Стоп! Ваша відповідь?
            </motion.span>
          )}
          {isOver && (
            <motion.div
              className="final-outcome"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <span className={`song-stage-answering${stage === 'won' ? '' : ' lost'}`}>{OUTCOME_TEXT[stage]}</span>
              <ol className="final-answers">
                {FINAL_SONGS.map((song, i) => (
                  <li key={i} className={guessed[i] ? 'guessed' : ''}>
                    <b>{song.name}</b> — {song.artist}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </div>
      </div>

      <KeyHints hints={HINTS[stage]} />
    </div>
  )
}

function Wave() {
  return (
    <span className="final-disc-wave" aria-hidden="true">
      {WAVE_BARS.map((h, i) => (
        <i key={i} style={{ '--bar-height': h } as React.CSSProperties} />
      ))}
    </span>
  )
}
