export default function WaveformIcon({ size = 18, color = 'currentColor' }) {
  const heights = [5, 9, 14, 18, 14, 9, 5]
  const barW = 1.8, gap = 2.6
  const totalW = heights.length * barW + (heights.length - 1) * (gap - barW)
  const startX = (20 - totalW) / 2
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      {heights.map((h, i) => (
        <rect key={i} x={startX + i * gap} y={(20 - h) / 2} width={barW} height={h} rx={0.9} fill={color} />
      ))}
    </svg>
  )
}
