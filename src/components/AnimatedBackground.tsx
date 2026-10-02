import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 60
const COLUMN_GAP = 46
const BEADS_PER_COLUMN = 16

type Rgb = [number, number, number]

const TONES: Record<Tone, Rgb[]> = {
  purple: [
    [180, 92, 255], // violet
    [226, 170, 255], // light violet
    [110, 70, 230], // indigo
    [255, 255, 255], // white
  ],
  gold: [
    [240, 195, 90], // gold
    [246, 223, 160], // light gold
    [255, 150, 50], // amber
    [255, 255, 255], // white
  ],
}

// idle: slow floating glows behind the logo
// rain: vertical strings of beads falling like the studio's light curtains
type Mode = 'idle' | 'rain'
type Tone = 'purple' | 'gold'

interface Props {
  mode?: Mode
  tone?: Tone
}

interface IdleParticle {
  x: number
  y: number
  radius: number
  phase: number
  speed: number
  colorIdx: number
  driftX: number
  driftY: number
}

interface RainColumn {
  x: number
  head: number
  speed: number
  beadGap: number
  radius: number
  colorIdx: number
}

export default function AnimatedBackground({ mode = 'idle', tone = 'purple' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let lastTime = 0
    let idleParticles: IdleParticle[] = []
    let rainColumns: RainColumn[] = []

    const c = canvas
    const x = ctx
    // the idle screen mixes both palettes, like the purple-and-gold title card
    const colors = mode === 'idle' ? [...TONES.gold, ...TONES.purple] : TONES[tone]

    function randColorIdx() {
      return Math.floor(Math.random() * colors.length)
    }

    function makeIdleParticles() {
      idleParticles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        radius: 6 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
        colorIdx: randColorIdx(),
        driftX: (Math.random() - 0.5) * 6,
        driftY: (Math.random() - 0.5) * 6,
      }))
    }

    function spawnColumn(colX: number, fromTop: boolean): RainColumn {
      const beadGap = 14 + Math.random() * 16
      return {
        x: colX,
        head: fromTop ? -Math.random() * c.height * 0.5 : Math.random() * (c.height + BEADS_PER_COLUMN * beadGap),
        speed: 40 + Math.random() * 110,
        beadGap,
        radius: 1.5 + Math.random() * 3,
        colorIdx: randColorIdx(),
      }
    }

    function makeRainColumns() {
      const count = Math.ceil(c.width / COLUMN_GAP)
      rainColumns = Array.from({ length: count }, (_, i) =>
        spawnColumn(i * COLUMN_GAP + Math.random() * COLUMN_GAP, false),
      )
    }

    function resize() {
      c.width = window.innerWidth
      c.height = window.innerHeight
      makeIdleParticles()
      makeRainColumns()
    }
    resize()
    window.addEventListener('resize', resize)

    function drawIdle(time: number) {
      for (const p of idleParticles) {
        const t = (Math.sin(time / 2200 + p.phase) + 1) / 2
        const alpha = 0.12 + t * 0.45
        const [r, g, b] = colors[p.colorIdx]

        const driftT = time / 6000
        const px = p.x + Math.sin(driftT * p.speed + p.phase) * p.driftX * 10
        const py = p.y + Math.cos(driftT * p.speed + p.phase) * p.driftY * 10

        const gradient = x.createRadialGradient(px, py, 0, px, py, p.radius)
        gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)

        x.fillStyle = gradient
        x.beginPath()
        x.arc(px, py, p.radius, 0, Math.PI * 2)
        x.fill()
      }
    }

    function drawRain(dt: number) {
      for (let i = 0; i < rainColumns.length; i++) {
        const col = rainColumns[i]
        col.head += col.speed * dt
        const length = BEADS_PER_COLUMN * col.beadGap
        if (col.head - length > c.height) {
          rainColumns[i] = spawnColumn(col.x, true)
          continue
        }

        const [r, g, b] = colors[col.colorIdx]
        for (let k = 0; k < BEADS_PER_COLUMN; k++) {
          const y = col.head - k * col.beadGap
          if (y < -10 || y > c.height + 10) continue
          // the head bead is the brightest, the string fades out behind it
          const alpha = 0.55 * (1 - k / BEADS_PER_COLUMN)
          x.fillStyle = `rgba(${r},${g},${b},${alpha})`
          x.beginPath()
          x.arc(col.x, y, k === 0 ? col.radius * 1.6 : col.radius, 0, Math.PI * 2)
          x.fill()
        }
      }
    }

    function draw(time: number) {
      animId = requestAnimationFrame(draw)
      // cap at ~30 fps to ease load on slow devices
      const dt = time - lastTime
      if (dt < 32) return
      lastTime = time

      x.clearRect(0, 0, c.width, c.height)
      if (mode === 'rain') drawRain(Math.min(dt, 100) / 1000)
      else drawIdle(time)
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [mode, tone])

  return <canvas ref={canvasRef} className="animated-bg-canvas" aria-hidden="true" />
}
