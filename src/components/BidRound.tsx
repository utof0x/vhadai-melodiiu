import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RoundPlayer } from '../types'
import { BID_POINTS, BID_SONGS, BID_START } from '../data/songs'
import { playDing, playWrong } from '../sfx'
import KeyHints from './KeyHints'
import PlayerPlate from './PlayerPlate'

// bidding: the clue is up and the players trade bids; the notes themselves are
//   played on a live instrument, so the app only tracks who holds which bid
// revealed: the song is named, points are awarded and the full track plays
type Stage = 'bidding' | 'revealed'

interface Props {
  players: RoundPlayer[] // exactly two
  scores: number[]
  onScore: (playerIndex: number, delta: number) => void
  onDone: () => void
  onBack: () => void
}

const HINTS: Record<Stage, [string, string][]> = {
  bidding: [
    ['1 / 2', 'хто робить ставку'],
    ['↑ ↓', 'кількість нот'],
    ['Enter', 'вгадав'],
    ['Backspace', 'не вгадав'],
  ],
  revealed: [['Space', 'далі']],
}

const NOTES = Array.from({ length: BID_START }, (_, i) => i + 1)

function noteWord(n: number) {
  if (n === 1) return 'ноту'
  return n < 5 ? 'ноти' : 'нот'
}

export default function BidRound({ players, scores, onScore, onDone, onBack }: Props) {
  const [songIndex, setSongIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('bidding')
  const [bid, setBid] = useState(BID_START)
  const [holder, setHolder] = useState<number | null>(null) // position in `players` of who holds the bid
  const [awarded, setAwarded] = useState<number | null>(null) // position that got the points
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { clue, song } = BID_SONGS[songIndex]
  const isLast = songIndex >= BID_SONGS.length - 1

  function stopAudio() {
    audioRef.current?.pause()
    audioRef.current = null
  }

  useEffect(() => () => stopAudio(), [])

  // the first press claims the opening bid; after that, taking the bid over
  // from the opponent means going one note lower
  function takeBid(pos: number) {
    if (stage !== 'bidding' || pos >= players.length || pos === holder) return
    if (holder !== null) setBid((b) => Math.max(1, b - 1))
    setHolder(pos)
  }

  function changeBid(delta: number) {
    if (stage !== 'bidding') return
    setBid((b) => Math.min(BID_START, Math.max(1, b + delta)))
  }

  // a miss hands the points to the opponent
  function judge(correct: boolean) {
    if (stage !== 'bidding' || holder === null) return
    const winnerPos = correct ? holder : 1 - holder
    if (correct) playDing()
    else playWrong()
    onScore(players[winnerPos].index, BID_POINTS)
    setAwarded(winnerPos)
    if (song.plus) {
      const audio = new Audio(song.plus)
      audioRef.current = audio
      audio.play().catch(() => {})
    }
    setStage('revealed')
  }

  function next() {
    stopAudio()
    if (isLast) {
      onDone()
      return
    }
    setSongIndex((i) => i + 1)
    setBid(BID_START)
    setHolder(null)
    setAwarded(null)
    setStage('bidding')
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return
    const isForward = e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight'
    if (isForward || e.code === 'Backspace' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault()

    if (stage === 'bidding') {
      if (e.key === '1') takeBid(0)
      else if (e.key === '2') takeBid(1)
      else if (e.code === 'ArrowDown') changeBid(-1)
      else if (e.code === 'ArrowUp') changeBid(1)
      else if (e.code === 'Enter') judge(true)
      else if (e.code === 'Backspace') judge(false)
      else if (e.code === 'ArrowLeft' && songIndex === 0 && holder === null) onBack()
    } else if (isForward) {
      next()
    }
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function plateState(pos: number) {
    if (stage === 'revealed') return awarded === pos ? 'active' : 'idle'
    return holder === pos ? 'active' : 'idle'
  }

  return (
    <div className="screen round-screen">
      <div className="round-header">
        <span className="pill gold-pill">10 нот</span>
        <span className="round-header-theme">
          Мелодія {songIndex + 1} / {BID_SONGS.length}
        </span>
      </div>

      <div className="round-body">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${songIndex}-${stage}`}
            className="bid-stage"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            {stage === 'bidding' ? (
              <>
                <div className="clue-card neon-block">{clue}</div>
                <div className="note-row">
                  {NOTES.map((n) => (
                    <span key={n} className={`note-dot${n <= bid ? ' lit' : ''}`}>
                      {n}
                    </span>
                  ))}
                </div>
                <div className="bid-caption">
                  {holder === null ? (
                    `Ставки починаються з ${BID_START} нот`
                  ) : (
                    <>
                      {players[holder].name} вгадає за <b>{bid}</b> {noteWord(bid)}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="song-answer">
                <span className="song-answer-name">{song.name}</span>
                <span className="song-answer-artist">{song.artist}</span>
                {awarded !== null && (
                  <span className="song-answer-result">
                    +{BID_POINTS} · {players[awarded].name}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="scoreboard">
        {players.map((p, pos) => (
          <PlayerPlate
            key={p.index}
            name={p.name}
            score={scores[p.index]}
            hotkey={String(pos + 1)}
            state={plateState(pos)}
            onClick={stage === 'bidding' ? () => takeBid(pos) : undefined}
          />
        ))}
      </div>

      <KeyHints hints={HINTS[stage]} />
    </div>
  )
}
