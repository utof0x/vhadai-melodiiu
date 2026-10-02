import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RoundPlayer } from '../types'
import { RACE_POINTS, RACE_THEMES } from '../data/songs'
import { playDing, playWrong } from '../sfx'
import KeyHints from './KeyHints'
import PlayerPlate from './PlayerPlate'
import SoundWave from './SoundWave'

// board: the theme grid, waiting for a pick
// ready: a theme is open, music not started yet
// playing: the instrumental is on, anyone may buzz
// buzzed: music paused, one player is answering
// revealed: the answer is on screen and the full track plays
type Stage = 'board' | 'ready' | 'playing' | 'buzzed' | 'revealed'

interface Props {
  players: RoundPlayer[]
  scores: number[]
  onScore: (playerIndex: number, delta: number) => void
  onDone: () => void
  onBack: () => void
}

const HINTS: Record<Stage, [string, string][]> = {
  board: [['1–8', 'тема'], ['Space', 'далі, коли все зіграно'], ['←', 'назад']],
  ready: [['Space', 'грати'], ['←', 'до тем']],
  playing: [['1–4', 'хто натиснув'], ['Space', 'ніхто не вгадав']],
  buzzed: [['Enter', 'правильно'], ['Backspace', 'неправильно'], ['Esc', 'скасувати']],
  revealed: [['Space', 'до тем']],
}

export default function RaceRound({ players, scores, onScore, onDone, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('board')
  const [played, setPlayed] = useState<boolean[]>(() => RACE_THEMES.map(() => false))
  const [current, setCurrent] = useState<number | null>(null)
  const [buzzer, setBuzzer] = useState<number | null>(null) // position in `players`
  const [lockedOut, setLockedOut] = useState<number[]>([]) // positions that already missed this song
  const [winner, setWinner] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const theme = current === null ? null : RACE_THEMES[current]
  const allPlayed = RACE_THEMES.every((t, i) => !t.song || played[i])

  function stopAudio() {
    audioRef.current?.pause()
    audioRef.current = null
  }

  useEffect(() => () => stopAudio(), [])

  function openTheme(i: number) {
    if (stage !== 'board' || !RACE_THEMES[i]?.song || played[i]) return
    setCurrent(i)
    setBuzzer(null)
    setLockedOut([])
    setWinner(null)
    setStage('ready')
  }

  function startSong() {
    const src = theme?.song?.minus
    if (src) {
      const audio = new Audio(src)
      audio.loop = true
      audioRef.current = audio
      audio.play().catch(() => {})
    }
    setStage('playing')
  }

  function buzz(pos: number) {
    if (stage !== 'playing' || pos >= players.length || lockedOut.includes(pos)) return
    audioRef.current?.pause()
    setBuzzer(pos)
    setStage('buzzed')
  }

  function reveal(winnerPos: number | null) {
    stopAudio()
    const src = theme?.song?.plus
    if (src) {
      const audio = new Audio(src)
      audioRef.current = audio
      audio.play().catch(() => {})
    }
    setWinner(winnerPos)
    setBuzzer(null)
    setStage('revealed')
  }

  function resume() {
    audioRef.current?.play().catch(() => {})
    setBuzzer(null)
    setStage('playing')
  }

  function judge(correct: boolean) {
    if (stage !== 'buzzed' || buzzer === null) return
    if (correct) {
      playDing()
      onScore(players[buzzer].index, RACE_POINTS)
      reveal(buzzer)
      return
    }
    playWrong()
    const nextLocked = [...lockedOut, buzzer]
    setLockedOut(nextLocked)
    // once everyone has missed there is nobody left to buzz
    if (nextLocked.length >= players.length) reveal(null)
    else resume()
  }

  function closeSong() {
    stopAudio()
    setPlayed((prev) => prev.map((p, i) => (i === current ? true : p)))
    setCurrent(null)
    setStage('board')
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return
    const isForward = e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight'
    const digit = e.key >= '1' && e.key <= '9' ? Number(e.key) - 1 : null
    if (isForward || e.code === 'Backspace') e.preventDefault()

    if (stage === 'board') {
      if (digit !== null) openTheme(digit)
      else if (isForward && allPlayed) onDone()
      else if (e.code === 'ArrowLeft') onBack()
    } else if (stage === 'ready') {
      if (isForward) startSong()
      else if (e.code === 'ArrowLeft') {
        setCurrent(null)
        setStage('board')
      }
    } else if (stage === 'playing') {
      if (digit !== null) buzz(digit)
      else if (e.code === 'Space') reveal(null)
    } else if (stage === 'buzzed') {
      if (e.code === 'Enter') judge(true)
      else if (e.code === 'Backspace') judge(false)
      else if (e.code === 'Escape') resume()
    } else if (stage === 'revealed') {
      if (isForward) closeSong()
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
        <span className="pill gold-pill">Наввипередки</span>
        {theme && <span className="round-header-theme">{theme.title}</span>}
      </div>

      <div className="round-body">
        <AnimatePresence mode="wait">
          {stage === 'board' ? (
            <motion.div
              key="board"
              className="theme-grid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              {RACE_THEMES.map((t, i) => {
                const state = played[i] ? 'played' : t.song ? 'open' : 'locked'
                return (
                  <button
                    key={i}
                    type="button"
                    className={`theme-tile neon-block ${state}`}
                    disabled={state !== 'open'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => openTheme(i)}
                  >
                    <span className="theme-tile-key">{i + 1}</span>
                    {t.title}
                  </button>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="song"
              className="song-stage"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
              <SoundWave playing={stage === 'playing' || stage === 'revealed'} />
              <div className="song-stage-caption">
                {stage === 'ready' && <span className="song-stage-note">Готові?</span>}
                {stage === 'playing' && <span className="song-stage-note">Хто перший?</span>}
                {stage === 'buzzed' && buzzer !== null && (
                  <motion.span
                    className="song-stage-answering"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.45, duration: 0.5 }}
                  >
                    Відповідає {players[buzzer].name}
                  </motion.span>
                )}
                {stage === 'revealed' && theme?.song && (
                  <motion.div
                    className="song-answer"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <span className="song-answer-name">{theme.song.name}</span>
                    <span className="song-answer-artist">{theme.song.artist}</span>
                    <span className="song-answer-result">
                      {winner === null ? 'Ніхто не вгадав' : `+${RACE_POINTS} · ${players[winner].name}`}
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="scoreboard">
        {players.map((p, pos) => (
          <PlayerPlate
            key={p.index}
            name={p.name}
            score={scores[p.index]}
            hotkey={String(pos + 1)}
            state={
              stage === 'board'
                ? 'idle'
                : buzzer === pos || (stage === 'revealed' && winner === pos)
                  ? 'active'
                  : lockedOut.includes(pos)
                    ? 'locked'
                    : 'idle'
            }
            onClick={stage === 'playing' && !lockedOut.includes(pos) ? () => buzz(pos) : undefined}
          />
        ))}
      </div>

      <KeyHints hints={HINTS[stage]} />
    </div>
  )
}
