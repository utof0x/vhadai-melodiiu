import { motion } from 'framer-motion'
import type { FinalResult } from '../types'
import Logo from './Logo'

interface Props {
  playerName: string
  result: FinalResult
}

export default function GameEndScreen({ playerName, result }: Props) {
  return (
    <div className="screen">
      <div className="game-end-wrap">
        <Logo size="small" />
        <motion.div
          className="game-end-label"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {result.outcome === 'won' ? 'Переможець фіналу' : 'Фіналіст'}
        </motion.div>
        <motion.div
          className="game-end-name"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.7, type: 'spring', bounce: 0.45 }}
        >
          {playerName}
        </motion.div>
        <motion.div
          className="pill gold-pill"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          Вгадано {result.guessed} із {result.total}
        </motion.div>
      </div>
    </div>
  )
}
