interface Props {
  size?: 'large' | 'small'
}

export default function Logo({ size = 'large' }: Props) {
  return (
    <div className={`logo logo-${size}`}>
      <div className="logo-rings" aria-hidden="true" />
      <div className="logo-arc" aria-hidden="true" />
      <div className="logo-words">
        <div className="logo-top">
          <span>Вгадай</span>
        </div>
        <div className="logo-bottom">Мелодію</div>
      </div>
    </div>
  )
}
