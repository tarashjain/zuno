'use client'

import { useId } from 'react'

const SECTORS = [
  { label: '50s–80s', color: '#665640' },
  { label: '1990s', color: '#704c55' },
  { label: '2000s', color: '#385963' },
  { label: '2010+', color: '#476151' },
  { label: '50s–80s', color: '#79664c' },
  { label: '1990s', color: '#805962' },
  { label: '2000s', color: '#466c75' },
  { label: '2010+', color: '#567460' },
]
const point = (angle: number, radius: number) => {
  const radians = (angle - 90) * Math.PI / 180
  return { x: 180 + radius * Math.cos(radians), y: 180 + radius * Math.sin(radians) }
}

export default function BollywoodBeatsWheel({ rotation, duration, moving, selectedSlot, onFinish }: {
  rotation: number
  duration: number
  moving: boolean
  selectedSlot: number | null
  onFinish: () => void
}) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="relative w-full max-w-[360px] aspect-square my-3 isolate" role="img" aria-label="Era wheel with eight sectors: 1950s–80s, 1990s, 2000s, and 2010 onwards, each appearing twice">
      <div className="absolute inset-[2%] rounded-full shadow-[0_12px_30px_rgba(53,40,23,0.16)]" />
      <svg viewBox="0 0 360 360" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ead8ae" /><stop offset="0.45" stopColor="#b49762" /><stop offset="1" stopColor="#7b623c" />
          </linearGradient>
        </defs>
        <circle cx="180" cy="180" r="174" fill="#f3eee3" stroke="#d5c8ad" />
        <circle cx="180" cy="180" r="167" fill={`url(#${id}-brass)`} />
        <circle cx="180" cy="180" r="161" fill="#292c27" />
        {Array.from({ length: 64 }, (_, i) => {
          const a = point(i * 360 / 64, 168)
          const b = point(i * 360 / 64, i % 8 === 0 ? 173 : 170)
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#806a44" strokeWidth={i % 8 === 0 ? 1.5 : 0.6} />
        })}
      </svg>
      <svg viewBox="0 0 360 360" className="absolute inset-0 w-full h-full" aria-hidden="true"
        onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform') onFinish() }}
        style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50% 50%', transition: `transform ${duration}ms cubic-bezier(0.16, 0, 0.12, 1)`, willChange: moving ? 'transform' : undefined }}>
        {SECTORS.map((sector, i) => {
          const a = point(i * 45, 157)
          const b = point((i + 1) * 45, 157)
          const label = point(i * 45 + 22.5, 113)
          return <g key={i}>
            <path d={`M180 180 L${a.x} ${a.y} A157 157 0 0 1 ${b.x} ${b.y} Z`} fill={sector.color} stroke="#d6c39c" strokeWidth="0.7" />
            <path d={`M180 180 L${a.x} ${a.y} A157 157 0 0 1 ${b.x} ${b.y} Z`} fill="#fff0c4" opacity={selectedSlot === i ? 0.18 : 0} style={{ transition: 'opacity 300ms ease' }} />
            <text x={label.x} y={label.y} transform={`rotate(${i * 45 + 22.5}, ${label.x}, ${label.y})`}
              textAnchor="middle" dominantBaseline="middle" fill="#fff8e8" fontSize="14" fontFamily="Georgia, serif" letterSpacing="0.5">{sector.label}</text>
          </g>
        })}
        <circle cx="180" cy="180" r="151" fill="none" stroke="#efdfbc" strokeOpacity="0.35" strokeWidth="0.7" />
        <circle cx="180" cy="180" r="76" fill="none" stroke="#efdfbc" strokeOpacity="0.25" strokeWidth="0.7" />
      </svg>
      {/* The hub and pointer stay still while the dial turns beneath them. */}
      <svg viewBox="0 0 360 360" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <circle cx="180" cy="182" r="57" fill="#1c241e" fillOpacity="0.2" />
        <circle cx="180" cy="180" r="55" fill={`url(#${id}-brass)`} />
        <circle cx="180" cy="180" r="50" fill="#f6f0e3" />
        <circle cx="180" cy="180" r="45" fill="none" stroke="#c5ad7e" strokeWidth="0.6" />
        <text x="180" y="169" textAnchor="middle" fill="#897348" fontSize="7" letterSpacing="2.2">BOLLYWOOD</text>
        <text x="180" y="190" textAnchor="middle" fill="#353a30" fontFamily="Georgia, serif" fontSize="22">Beats</text>
        <path d="M168 201 H192" stroke="#b79a62" strokeWidth="0.7" />
        <path d="M169 6 Q180 1 191 6 L180 33 Z" fill={`url(#${id}-brass)`} stroke="#6e5937" strokeWidth="0.8" />
        <path d="M175 9 H185 L180 23 Z" fill="#f8edcf" />
      </svg>
    </div>
  )
}
