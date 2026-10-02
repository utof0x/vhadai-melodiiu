import { motion } from 'framer-motion'
import type { RoundId } from '../types'
import { ROUND_TITLES } from '../types'
import Logo from './Logo'

interface Props {
  round?: RoundId // set on the round-start interstitial, omitted on the idle title screen
}

export default function TitleScreen({ round }: Props) {
  return (
    <div className="screen">
      <motion.div
        className="title-wrap"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, type: 'spring', bounce: 0.35 }}
      >
        <Logo />
      </motion.div>
      {round && (
        <motion.div
          className="round-label"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, type: 'spring', bounce: 0.4 }}
        >
          <span className="pill gold-pill">{ROUND_TITLES[round].label}</span>
          <span className="round-label-name">{ROUND_TITLES[round].name}</span>
        </motion.div>
      )}
    </div>
  )
}
