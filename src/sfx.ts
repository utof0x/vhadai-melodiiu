import dingSrc from './assets/ding.mp3'
import wrongSrc from './assets/wrong.mp3'

export function playDing() {
  new Audio(dingSrc).play().catch(() => {})
}

export function playWrong() {
  new Audio(wrongSrc).play().catch(() => {})
}
