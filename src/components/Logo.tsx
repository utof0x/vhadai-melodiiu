interface Props {
  size?: 'large' | 'small'
}

// gold strands of the fiery ring: diameter (em), thickness (em), start angle, seconds per turn
const STRANDS: [d: number, t: number, from: number, speed: number][] = [
  [4.0, 0.075, 300, 16],
  [4.22, 0.03, 40, -22],
  [3.8, 0.022, 170, 26],
  [4.42, 0.016, 230, -34],
  [3.2, 0.012, 20, 40],
]

// glass bubbles and notes drifting around the wordmark: x/y from the centre (em), size (em), hue
const BUBBLES: [x: number, y: number, size: number, hue: number][] = [
  [-1.0, -1.5, 0.16, 300],
  [1.25, -1.95, 0.14, 275],
  [-2.75, 1.0, 0.1, 345],
  [-1.6, 1.75, 0.13, 215],
  [0.75, 1.05, 0.12, 290],
  [2.45, 1.1, 0.13, 265],
  [3.75, 1.55, 0.3, 280],
]

const NOTES: [x: number, y: number, size: number, glyph: string][] = [
  [-0.85, -1.85, 0.3, '♪'],
  [2.8, 1.3, 0.26, '♪'],
  [3.3, 1.25, 0.62, '♫'],
  [0.35, 1.25, 0.24, '♪'],
]

export default function Logo({ size = 'large' }: Props) {
  return (
    <div className={`logo logo-${size}`}>
      <div className="logo-backdrop" aria-hidden="true">
        <div className="logo-glow" />
        <div className="logo-grooves" />
        <div className="logo-strands">
          {STRANDS.map(([d, t, from, speed], i) => (
            <div
              key={i}
              className="logo-strand"
              style={
                {
                  '--d': `${d}em`,
                  '--t': `${t}em`,
                  '--from': `${from}deg`,
                  animationDuration: `${Math.abs(speed)}s`,
                  animationDirection: speed < 0 ? 'reverse' : 'normal',
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        {size === 'large' && (
          <>
            {BUBBLES.map(([x, y, s, hue], i) => (
              <span
                key={`b${i}`}
                className="logo-bubble"
                style={
                  {
                    '--x': `${x}em`,
                    '--y': `${y}em`,
                    '--s': `${s}em`,
                    '--hue': hue,
                    animationDelay: `${-i * 1.3}s`,
                  } as React.CSSProperties
                }
              />
            ))}
            {NOTES.map(([x, y, s, glyph], i) => (
              <span
                key={`n${i}`}
                className="logo-note"
                // the glyph's own font-size is --s, so its offsets are divided back into logo ems
                style={
                  {
                    '--x': `${x / s}em`,
                    '--y': `${y / s}em`,
                    '--s': `${s}em`,
                    animationDelay: `${-i * 1.7}s`,
                  } as React.CSSProperties
                }
              >
                {glyph}
              </span>
            ))}
          </>
        )}
      </div>
      <div className="logo-words">
        <div className="logo-top">
          <span>Вгадай</span>
        </div>
        <div className="logo-bottom">Мелодію</div>
      </div>
    </div>
  )
}
