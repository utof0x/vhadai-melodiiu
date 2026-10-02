const BARS = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.9, 0.65, 0.75, 0.45, 0.8, 0.55]

interface Props {
  playing: boolean
}

export default function SoundWave({ playing }: Props) {
  return (
    <div className={`sound-wave${playing ? '' : ' paused'}`}>
      {BARS.map((h, i) => (
        <div
          key={i}
          className="sound-wave-bar"
          style={{ animationDelay: `${i * 0.08}s`, '--bar-height': h } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
