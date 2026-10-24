'use client'

import { useState } from 'react'

const COLORS = ['#7B61FF', '#12B5A6', '#FFC53D', '#FF8A3D', '#EC5BA6', '#4C7DFF', '#F2545B']

type Piece = { left: number; delay: number; duration: number; dx: number; spin: number; color: string; w: number; h: number; round: boolean }

/** Chuva de confetes (só CSS); desliga-se com prefers-reduced-motion */
export default function Confetti({ count = 60 }: { count?: number }) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.2 + Math.random() * 1.8,
      dx: (Math.random() - 0.5) * 220,
      spin: 360 + Math.random() * 720,
      color: COLORS[i % COLORS.length],
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      round: Math.random() > 0.7,
    })),
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden motion-reduce:hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.round ? p.w : p.h,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            animation: `confetti-fall ${p.duration}s cubic-bezier(0.3, 0.6, 0.5, 1) ${p.delay}s both`,
            ['--dx' as string]: `${p.dx}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
