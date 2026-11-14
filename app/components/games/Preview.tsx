'use client'

import './games.css'
import type { CSSProperties, ReactNode } from 'react'
import type { GameId } from '../../types'
import { gameMeta } from './meta'

/*
 * Pequena animação de cada jogo (no ecrã de início): mostra a ideia do jogo antes de se ler
 * as regras. Só CSS, em ciclo; com "reduzir movimento" fica parada.
 */

const d = (s: number) => ({ ['--d' as string]: `${s}s` }) as CSSProperties

function Breathe({ color }: { color: string }) {
  return (
    <div className="relative h-24 w-24">
      <span className="gmp-breathe absolute inset-0 rounded-full opacity-20" style={{ background: color }} />
      <span className="gmp-breathe absolute inset-3 rounded-full" style={{ background: color, animationDelay: '0.15s' }} />
    </div>
  )
}

function Galo({ color }: { color: string }) {
  // X nas diagonais a aparecer uma a uma, O entre elas, e a linha da vitória no fim
  const marks: Record<number, ['X' | 'O', number]> = { 0: ['X', 0], 1: ['O', 0.6], 4: ['X', 1.2], 2: ['O', 1.8], 8: ['X', 2.4] }
  return (
    <div className="relative grid h-24 w-24 grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center rounded-md bg-white text-lg font-black">
          {marks[i] && <span className="gmp-show" style={{ ...d(marks[i][1] * 0.6), color: marks[i][0] === 'X' ? color : '#A3A0B8' }}>{marks[i][0]}</span>}
        </span>
      ))}
      <svg className="pointer-events-none absolute inset-0" viewBox="0 0 96 96">
        <line x1="12" y1="12" x2="84" y2="84" stroke={color} strokeWidth="4" strokeLinecap="round" className="gmp-line" />
      </svg>
    </div>
  )
}

function Forca({ color }: { color: string }) {
  const word = 'CAFÉ'
  return (
    <div className="flex gap-1.5">
      {[...word].map((ch, i) => (
        <span key={i} className="flex h-11 w-9 items-end justify-center border-b-[3px] border-ink/70 pb-1 text-2xl font-black text-ink">
          <span className="gmp-show" style={{ ...d(i * 0.7), color: i === 3 ? color : undefined }}>{ch}</span>
        </span>
      ))}
    </div>
  )
}

function Sudoku({ color }: { color: string }) {
  const cells = [5, 0, 1, 0, 8, 0, 3, 0, 9]
  const fills: Record<number, [number, number]> = { 1: [7, 0], 3: [2, 0.8], 5: [4, 1.6], 7: [6, 2.4] }
  return (
    <div className="grid h-24 w-24 grid-cols-3 overflow-hidden rounded-lg border-2 border-ink/70 bg-white">
      {cells.map((v, i) => (
        <span key={i} className="flex items-center justify-center border-[0.5px] border-line text-base font-black text-ink">
          {v || <span className="gmp-show" style={{ ...d(fills[i][1]), color }}>{fills[i][0]}</span>}
        </span>
      ))}
    </div>
  )
}

function Deslizar({ color }: { color: string }) {
  return (
    <div className="grid h-24 w-24 grid-cols-3 gap-1">
      {/* o 7 desliza para o espaço vazio ao lado e volta */}
      {[1, 2, 3, 4, 5, 6, 7, 0, 8].map((v, i) => (
        <span key={i} className="relative">
          {v === 0 ? (
            <span className="absolute inset-0 rounded-md bg-white/60" />
          ) : (
            <span className={`absolute inset-0 flex items-center justify-center rounded-md bg-white text-sm font-black ${v === 7 ? 'gmp-slide z-10' : ''}`} style={{ color }}>
              {v}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function Pares({ color, light }: { color: string; light: string }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 [perspective:400px]">
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <span key={i} className="gmp-flip relative h-11 w-9" style={d([0, 1.2, 0.4, 1.6, 2, 0.8, 2.4, 2.8][i])}>
          <span className="absolute inset-0 rounded-md [backface-visibility:hidden]" style={{ background: color, opacity: 0.85 }} />
          <span className="absolute inset-0 flex items-center justify-center rounded-md [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: light }}>
            <span className="h-3 w-3 rounded-full" style={{ background: ['#F2545B', '#4C7DFF', '#12A150', '#FF8A3D'][i % 4] }} />
          </span>
        </span>
      ))}
    </div>
  )
}

function Contas({ color }: { color: string }) {
  return (
    <p className="font-mono text-3xl font-black tabular-nums text-ink">
      <span className="gmp-show inline-block" style={d(0)}>7</span>
      <span className="gmp-show mx-2 inline-block text-muted" style={d(0.4)}>+</span>
      <span className="gmp-show inline-block" style={d(0.8)}>5</span>
      <span className="gmp-show mx-2 inline-block text-muted" style={d(1.2)}>=</span>
      <span className="gmp-show inline-block" style={{ ...d(1.8), color }}>12</span>
    </p>
  )
}

function Cores() {
  return <p className="gmp-ink text-3xl font-black tracking-wide">VERDE</p>
}

/**
 * still: parada (na lista); ganha vida ao passar o rato por cima do cartão (classe group).
 * scale: para caber em espaços mais pequenos sem refazer cada desenho.
 */
export default function GamePreview({ id, className = 'h-36 rounded-2xl', still = false, scale = 1, bare = false }: { id: GameId; className?: string; still?: boolean; scale?: number; bare?: boolean }) {
  const g = gameMeta(id)
  const art: Record<GameId, ReactNode> = {
    respirar: <Breathe color={g.color} />,
    galo: <Galo color={g.color} />,
    forca: <Forca color={g.color} />,
    sudoku: <Sudoku color={g.color} />,
    deslizar: <Deslizar color={g.color} />,
    pares: <Pares color={g.color} light={g.light} />,
    contas: <Contas color={g.color} />,
    cores: <Cores />,
  }
  return (
    <div
      className={`flex w-full items-center justify-center ${className} ${still ? 'gmp-still' : ''}`}
      style={bare ? undefined : { background: g.light }}
      aria-hidden
    >
      <div style={scale === 1 ? undefined : { transform: `scale(${scale})` }}>{art[id]}</div>
    </div>
  )
}
