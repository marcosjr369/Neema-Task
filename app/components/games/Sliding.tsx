'use client'

import { useEffect, useState } from 'react'
import { SLIDE_SIZE, slideDone, slideMove, slideScramble } from '../../lib/games'
import { GameFrame, Intro, ResultCard, useGameResult, useStopwatch } from './GameFrame'
import { gameMeta } from './meta'

const g = gameMeta('deslizar')
const N = SLIDE_SIZE

/** Puzzle de 15: as peças deslizam com animação para o espaço vazio */
export default function Sliding() {
  const [tiles, setTiles] = useState<number[] | null>(null)
  const [moves, setMoves] = useState(0)
  const { result, finish, reset } = useGameResult('deslizar')
  const done = !!tiles && slideDone(tiles)
  const watch = useStopwatch(!!tiles && !done && !result)

  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => finish(Math.max(1, moves)), 900)
    return () => window.clearTimeout(t)
  }, [done, moves, finish])

  const start = () => {
    reset()
    setTiles(slideScramble())
    setMoves(0)
    watch.reset()
  }

  const tap = (index: number) => {
    if (!tiles || done) return
    const next = slideMove(tiles, index)
    if (next) { setTiles(next); setMoves(m => m + 1) }
  }

  // setas: a peça ao lado do espaço vazio entra nele (seta para cima = a de baixo sobe)
  useEffect(() => {
    if (!tiles || done) return
    const onKey = (e: KeyboardEvent) => {
      const empty = tiles.indexOf(0)
      const r = Math.floor(empty / N), c = empty % N
      const from = { ArrowUp: r < N - 1 ? empty + N : -1, ArrowDown: r > 0 ? empty - N : -1, ArrowLeft: c < N - 1 ? empty + 1 : -1, ArrowRight: c > 0 ? empty - 1 : -1 }[e.key]
      if (from === undefined) return
      e.preventDefault()
      if (from >= 0) tap(from)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (result) {
    return (
      <GameFrame id="deslizar">
        <ResultCard id="deslizar" result={result} title="Arrumado em" onAgain={start}>
          <p className="text-sm font-semibold text-muted">{Math.floor(watch.seconds / 60)} min {watch.seconds % 60} s</p>
        </ResultCard>
      </GameFrame>
    )
  }

  if (!tiles) return <GameFrame id="deslizar"><Intro id="deslizar" onStart={start} /></GameFrame>

  const empty = tiles.indexOf(0)
  const er = Math.floor(empty / N), ec = empty % N
  // posição de cada peça pelo número (a peça mantém-se no DOM e desliza com transição)
  const pos = new Map(tiles.map((v, i) => [v, i]))

  return (
    <GameFrame id="deslizar" stat={<><span className="gm-pill">{moves} jogadas</span><span className="gm-pill">{Math.floor(watch.seconds / 60)}:{String(watch.seconds % 60).padStart(2, '0')}</span></>}>
      <div className="my-auto py-6">
        <div className={`mx-auto aspect-square w-full max-w-sm rounded-2xl bg-snow p-1.5 ${done ? 'gm-win' : ''}`}>
          <div className="relative h-full w-full">
          {Array.from({ length: N * N - 1 }, (_, k) => k + 1).map(v => {
            const i = pos.get(v)!
            const r = Math.floor(i / N), c = i % N
            const home = i === v - 1
            const movable = r === er || c === ec
            return (
              <button
                key={v}
                onClick={() => tap(i)}
                aria-label={`Peça ${v}${home ? ', no sítio' : ''}`}
                className="absolute p-1 transition-[left,top] duration-150 ease-out"
                style={{ left: `${(c * 100) / N}%`, top: `${(r * 100) / N}%`, width: `${100 / N}%`, height: `${100 / N}%` }}
              >
                <span
                  className={`flex h-full w-full items-center justify-center rounded-xl text-2xl font-black tabular-nums transition-[background,color,transform] duration-200 ${movable && !done ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default'}`}
                  style={home ? { background: g.color, color: '#fff' } : { background: '#fff', color: '#2B2840', boxShadow: '0 1px 2px rgb(43 40 64 / 0.08)' }}
                >
                  {v}
                </span>
              </button>
            )
          })}
          </div>
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-muted">
          As peças no sítio certo ficam coloridas. No computador, usa as setas.
        </p>
      </div>
    </GameFrame>
  )
}
