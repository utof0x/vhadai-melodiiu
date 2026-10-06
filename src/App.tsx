import { useState, useCallback, useEffect, useMemo } from 'react'
import type { FinalResult, GameState, RoundId, RoundPlayer } from './types'
import { DEFAULT_PLAYER_NAMES, PLAYER_COUNT } from './types'
import { buzzerRoom } from './buzzer'
import AnimatedBackground from './components/AnimatedBackground'
import SetupScreen from './components/SetupScreen'
import TitleScreen from './components/TitleScreen'
import QuizRound from './components/QuizRound'
import RaceRound from './components/RaceRound'
import BidRound from './components/BidRound'
import FinalRound from './components/FinalRound'
import StandingsScreen from './components/StandingsScreen'
import GameEndScreen from './components/GameEndScreen'
import './App.css'

const ALL_PLAYERS = Array.from({ length: PLAYER_COUNT }, (_, i) => i)
const NO_SCORES = ALL_PLAYERS.map(() => 0)

// how many players the round sends through to the next one
const PICK_COUNT: Record<RoundId, number> = { quiz: 3, race: 2, bid: 1, final: 0 }
const NEXT_ROUND: Record<RoundId, RoundId> = { quiz: 'race', race: 'bid', bid: 'final', final: 'final' }

function initialState(): GameState {
  return {
    phase: 'setup',
    round: 'quiz',
    playerNames: DEFAULT_PLAYER_NAMES, // replaced by what the setup screen collects
    active: ALL_PLAYERS,
    scores: NO_SCORES,
    roundStartScores: NO_SCORES,
    finalResult: null,
  }
}

// every round starts from its interstitial, with the scores it was entered with
function enterRound(prev: GameState, round: RoundId, active: number[], scores: number[]): GameState {
  return { ...prev, phase: 'round-start', round, active, scores, roundStartScores: scores, finalResult: null }
}

export default function App() {
  const [state, setState] = useState<GameState>(() => initialState())
  const [showHints, setShowHints] = useState(true)

  const advance = useCallback(() => {
    setState((prev) => {
      if (prev.phase === 'title') return enterRound(prev, 'quiz', ALL_PLAYERS, NO_SCORES)
      if (prev.phase === 'round-start') return { ...prev, phase: prev.round }
      // new game goes back to setup; the buzzer room still holds the names and the phones
      if (prev.phase === 'game-end') return initialState()
      return prev
    })
  }, [])

  // going back restarts the current round from the scores it began with;
  // earlier rounds can't be reopened
  const goBack = useCallback(() => {
    setState((prev) => {
      const { phase, round } = prev
      if (phase === 'title') return { ...prev, phase: 'setup' }
      if (phase === 'round-start') return round === 'quiz' ? { ...prev, phase: 'title' } : prev
      if (
        phase === 'quiz' ||
        phase === 'race' ||
        phase === 'bid' ||
        phase === 'final' ||
        phase === 'standings' ||
        phase === 'game-end'
      ) {
        return enterRound(prev, round, prev.active, prev.roundStartScores)
      }
      return prev
    })
  }, [])

  const startGame = useCallback((playerNames: string[], round: RoundId, active: number[]) => {
    setState((prev) => {
      if (prev.phase !== 'setup') return prev
      if (round === 'quiz') return { ...prev, phase: 'title', playerNames }
      // recovery: start at a later round with whoever is still in; scores start level
      return enterRound({ ...prev, playerNames }, round, active, NO_SCORES)
    })
  }, [])

  const addScore = useCallback((playerIndex: number, delta: number) => {
    setState((prev) => ({ ...prev, scores: prev.scores.map((s, i) => (i === playerIndex ? s + delta : s)) }))
  }, [])

  const finishRound = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'standings' }))
  }, [])

  const confirmStandings = useCallback((picked: number[]) => {
    setState((prev) => {
      if (prev.phase !== 'standings') return prev
      // the warm-up's single points only decide who is cut; the race starts level
      const scores = prev.round === 'quiz' ? NO_SCORES : prev.scores
      return enterRound(prev, NEXT_ROUND[prev.round], picked, scores)
    })
  }, [])

  const finishFinal = useCallback((finalResult: FinalResult) => {
    setState((prev) => ({ ...prev, phase: 'game-end', finalResult }))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // the setup form handles its own keys (typing, Enter to submit)
      if (state.phase === 'setup') return
      if (e.code === 'KeyH') {
        setShowHints((v) => !v)
        return
      }
      // rounds and standings bind their own keys
      if (state.phase !== 'title' && state.phase !== 'round-start' && state.phase !== 'game-end') return
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault()
        advance()
      }
      if (e.code === 'ArrowLeft') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.phase, advance, goBack])

  // open the phone-buzzer room once; it outlives individual games
  useEffect(() => {
    buzzerRoom.connect()
  }, [])

  // only while the setup screen is up may a joining phone rename its slot
  useEffect(() => {
    buzzerRoom.setSetupOpen(state.phase === 'setup')
  }, [state.phase])

  // knocked-out players' phones stay connected but go dead
  useEffect(() => {
    buzzerRoom.setActive(state.active)
  }, [state.active])

  const players: RoundPlayer[] = useMemo(
    () => state.active.map((index) => ({ index, name: state.playerNames[index] })),
    [state.active, state.playerNames],
  )
  const isPlaying = state.phase === 'quiz' || state.phase === 'race' || state.phase === 'bid' || state.phase === 'final'

  return (
    <div className={`app${showHints ? '' : ' hints-hidden'}${state.round === 'final' && isPlaying ? ' tone-gold' : ''}`}>
      <AnimatedBackground mode={isPlaying ? 'rain' : 'idle'} tone={state.phase === 'final' ? 'gold' : 'purple'} />
      {state.phase === 'setup' && <SetupScreen onStart={startGame} />}
      {state.phase === 'title' && <TitleScreen />}
      {state.phase === 'round-start' && <TitleScreen round={state.round} />}
      {state.phase === 'quiz' && (
        <QuizRound players={players} scores={state.scores} onScore={addScore} onDone={finishRound} onBack={goBack} />
      )}
      {state.phase === 'race' && (
        <RaceRound players={players} scores={state.scores} onScore={addScore} onDone={finishRound} onBack={goBack} />
      )}
      {state.phase === 'bid' && (
        <BidRound players={players} scores={state.scores} onScore={addScore} onDone={finishRound} onBack={goBack} />
      )}
      {state.phase === 'final' && <FinalRound playerIndex={players[0].index} onDone={finishFinal} onBack={goBack} />}
      {state.phase === 'standings' && (
        <StandingsScreen
          round={state.round}
          players={players}
          scores={state.scores}
          pickCount={PICK_COUNT[state.round]}
          onConfirm={confirmStandings}
          onBack={goBack}
        />
      )}
      {state.phase === 'game-end' && state.finalResult && (
        <GameEndScreen playerName={players[0].name} result={state.finalResult} />
      )}
    </div>
  )
}
