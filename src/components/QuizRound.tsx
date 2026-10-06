import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RoundPlayer } from '../types'
import type { ChoiceResult } from '../buzzer'
import { buzzerRoom } from '../buzzer'
import { QUIZ_POINTS, QUIZ_SONGS } from '../data/songs'
import { playDing } from '../sfx'
import KeyHints from './KeyHints'
import PlayerPlate from './PlayerPlate'
import SoundWave from './SoundWave'

// ready: the next melody is waiting, music paused
// playing: the instrumental is on and the options are live on the phones
// revealed: the right option is shown, points are given and the full track plays
type Stage = 'ready' | 'playing' | 'revealed'

interface Props {
  players: RoundPlayer[]
  scores: number[]
  onScore: (playerIndex: number, delta: number) => void
  onDone: () => void
  onBack: () => void
}

interface Answer {
  pos: number // position in `players`
  option: number
}

const OPTION_KEYS = ['KeyA', 'KeyB', 'KeyC', 'KeyD']
const OPTION_LETTERS = ['A', 'B', 'C', 'D']

const RESULT_NOTE: Record<ChoiceResult, string> = {
  point: `+${QUIZ_POINTS}`,
  late: 'останній',
  wrong: 'мимо',
  none: 'без відповіді',
}

export default function QuizRound({ players, scores, onScore, onDone, onBack }: Props) {
  const [songIndex, setSongIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('ready')
  const [answers, setAnswers] = useState<Answer[]>([]) // in the order they came in
  const [entering, setEntering] = useState<number | null>(null) // player the host is keying an answer in for
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const phones = useSyncExternalStore(buzzerRoom.subscribe, buzzerRoom.getSnapshot).phones

  const quiz = QUIZ_SONGS[songIndex]
  const isLast = songIndex >= QUIZ_SONGS.length - 1

  // right answers score, except for whoever answers last of all the players
  function resultFor(pos: number): ChoiceResult {
    const order = answers.findIndex((a) => a.pos === pos)
    if (order < 0) return 'none'
    if (answers[order].option !== quiz.correct) return 'wrong'
    return order >= players.length - 1 ? 'late' : 'point'
  }

  function stopAudio() {
    audioRef.current?.pause()
    audioRef.current = null
  }

  useEffect(() => () => stopAudio(), [])

  function play(src: string | undefined, loop: boolean) {
    stopAudio()
    if (!src) return
    const audio = new Audio(src)
    audio.loop = loop
    audioRef.current = audio
    audio.play().catch(() => {})
  }

  function startSong() {
    play(quiz.song.minus, true)
    setStage('playing')
  }

  function answer(pos: number, option: number) {
    if (stage !== 'playing' || pos < 0 || pos >= players.length || option >= quiz.options.length) return
    // functional update: two phones can land in the same tick, and both must keep their place in line
    setAnswers((prev) => (prev.some((a) => a.pos === pos) ? prev : [...prev, { pos, option }]))
    setEntering(null)
  }

  function reveal() {
    let anyPoint = false
    players.forEach((p, pos) => {
      if (resultFor(pos) !== 'point') return
      anyPoint = true
      onScore(p.index, QUIZ_POINTS)
    })
    if (anyPoint) playDing()
    play(quiz.song.plus, false)
    setEntering(null)
    setStage('revealed')
  }

  function next() {
    stopAudio()
    if (isLast) {
      onDone()
      return
    }
    setSongIndex((i) => i + 1)
    setAnswers([])
    setStage('ready')
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return
    const isForward = e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight'
    const digit = e.key >= '1' && e.key <= '9' ? Number(e.key) - 1 : null
    if (isForward) e.preventDefault()

    if (stage === 'ready') {
      if (isForward) startSong()
      else if (e.code === 'ArrowLeft' && songIndex === 0) onBack()
    } else if (stage === 'playing') {
      const option = OPTION_KEYS.indexOf(e.code)
      // keyboard fallback for a player without a phone: their number, then the letter
      if (digit !== null && digit < players.length && !answers.some((a) => a.pos === digit)) setEntering(digit)
      else if (option >= 0 && entering !== null) answer(entering, option)
      else if (e.code === 'Escape') setEntering(null)
      else if (e.code === 'Space' || e.code === 'Enter') reveal()
    } else if (isForward) {
      next()
    }
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // a pick on a phone is recorded the same way as one keyed in by the host
  const onPhoneAnswer = useEffectEvent((playerIndex: number, option: number) => {
    answer(players.findIndex((p) => p.index === playerIndex), option)
  })

  useEffect(() => buzzerRoom.onAnswer((playerIndex, option) => onPhoneAnswer(playerIndex, option)), [])

  // per player slot, for the phones
  const answersBySlot = useMemo(
    () => new Map(answers.map((a) => [players[a.pos].index, a.option])),
    [answers, players],
  )

  // the phones mirror the stage: options while the melody plays, then everyone's own result
  const syncPhones = useEffectEvent(() => {
    if (stage === 'playing') buzzerRoom.showChoice(quiz.options, answersBySlot)
    else if (stage === 'revealed') {
      const results = new Map(players.map((p, pos) => [p.index, resultFor(pos)]))
      buzzerRoom.showChoiceResult(quiz.options, answersBySlot, quiz.correct, results)
    } else buzzerRoom.idle()
  })

  useEffect(() => {
    syncPhones()
  }, [stage, answersBySlot])

  useEffect(() => () => buzzerRoom.idle(), [])

  const allAnswered = answers.length >= players.length

  function plateState(pos: number) {
    if (stage === 'revealed') return resultFor(pos) === 'point' ? 'active' : 'locked'
    if (stage === 'playing' && (entering === pos || answers.some((a) => a.pos === pos))) return 'active'
    return 'idle'
  }

  function plateNote(pos: number) {
    if (stage === 'revealed') return RESULT_NOTE[resultFor(pos)]
    if (stage !== 'playing') return undefined
    if (entering === pos) return 'A / B / C ?'
    return answers.some((a) => a.pos === pos) ? 'відповів' : undefined
  }

  return (
    <div className="screen round-screen">
      <div className="round-header">
        <span className="pill gold-pill">Розминка</span>
        <span className="round-header-theme">
          Мелодія {songIndex + 1} / {QUIZ_SONGS.length}
        </span>
      </div>

      <div className="round-body">
        <AnimatePresence mode="wait">
          <motion.div
            key={songIndex}
            className="quiz-stage"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25 }}
          >
            <SoundWave playing={stage !== 'ready'} />
            {stage !== 'ready' && (
              <div className="quiz-options">
                {quiz.options.map((option, i) => (
                  <div
                    key={i}
                    className={`quiz-option neon-block${
                      stage === 'revealed' ? (i === quiz.correct ? ' correct' : ' dimmed') : ''
                    }`}
                  >
                    <span className="quiz-option-letter">{OPTION_LETTERS[i]}</span>
                    {option}
                  </div>
                ))}
              </div>
            )}
            <div className="quiz-caption">
              {stage === 'playing' && (allAnswered ? 'Усі відповіли' : 'Оберіть варіант на телефоні')}
            </div>
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
            phone={phones[p.index]}
            note={plateNote(pos)}
            state={plateState(pos)}
          />
        ))}
      </div>

      <KeyHints
        hints={
          stage === 'ready'
            ? [['Space', 'грати'], ['←', 'назад']]
            : stage === 'playing'
              ? [['Space', 'показати відповідь'], [`1–${players.length}, потім A/B/C`, 'відповідь без телефона']]
              : [['Space', 'далі']]
        }
      />
    </div>
  )
}
