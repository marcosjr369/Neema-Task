'use client'

import { useEffect, useMemo, useState } from 'react'
import { BackspaceIcon } from '@phosphor-icons/react'
import { sudokuConflicts, sudokuPeers, sudokuPuzzle, type SudokuLevel } from '../../lib/games'
import { GameFrame, Intro, OptionCards, ResultCard, useGameResult, useStopwatch } from './GameFrame'
import { gameMeta } from './meta'

const g = gameMeta('sudoku')
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Sudoku() {
  const [level, setLevel] = useState<SudokuLevel>('facil')
  const [game, setGame] = useState<{ puzzle: number[]; solution: number[] } | null>(null)
  const [grid, setGrid] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [placed, setPlaced] = useState(0)
  const { result, finish, reset } = useGameResult('sudoku')
  const conflicts = useMemo(() => sudokuConflicts(grid), [grid])
  const solved = !!game && grid.length === 81 && grid.every(Boolean) && conflicts.size === 0
  const watch = useStopwatch(!!game && !solved && !result)

  useEffect(() => {
    if (!solved) return
    const t = window.setTimeout(() => finish(Math.max(20, watch.seconds)), 900)
    return () => window.clearTimeout(t)
  }, [solved, finish, watch.seconds])

  const start = () => {
    reset()
    const next = sudokuPuzzle(level)
    setGame(next)
    setGrid(next.puzzle)
    setSelected(null)
    watch.reset()
  }

  const put = (n: number) => {
    if (selected === null || !game || game.puzzle[selected] || solved) return
    setGrid(gr => gr.map((v, i) => (i === selected ? n : v)))
    if (n) setPlaced(p => p + 1)
  }

  // teclado: números, apagar e setas
  useEffect(() => {
    if (!game || result) return
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) put(Number(e.key))
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const s = selected ?? 40
        const r = Math.floor(s / 9), c = s % 9
        const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key] ?? [0, 0]
        setSelected(((r + dr + 9) % 9) * 9 + ((c + dc + 9) % 9))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (result) {
    return (
      <GameFrame id="sudoku">
        <ResultCard id="sudoku" result={result} title={`Sudoku ${level === 'facil' ? 'fácil' : 'médio'} resolvido em`} onAgain={start}>
          <p className="text-sm font-semibold text-muted">Grelha completa, sem repetições.</p>
        </ResultCard>
      </GameFrame>
    )
  }

  if (!game) {
    return (
      <GameFrame id="sudoku">
        <Intro
          id="sudoku"
          onStart={start}
          options={
            <OptionCards id="sudoku" label="Dificuldade" value={level} onChange={setLevel} items={[
              { value: 'facil', title: 'Fácil', hint: 'Mais números à vista, 5 a 10 min' },
              { value: 'medio', title: 'Médio', hint: 'Pede mais lógica, 10 a 15 min' },
            ]} />
          }
        />
      </GameFrame>
    )
  }

  const peers = selected !== null ? new Set(sudokuPeers(selected)) : new Set<number>()
  const sameValue = selected !== null ? grid[selected] : 0
  const counts = Array.from({ length: 10 }, (_, n) => grid.filter(v => v === n).length)

  return (
    <GameFrame id="sudoku" stat={<><span className="gm-pill">{level === 'facil' ? 'Fácil' : 'Médio'}</span><span className="gm-pill">{clock(watch.seconds)}</span></>}>
      <div className="my-auto py-4">
        <div className={`mx-auto grid aspect-square w-full max-w-md grid-cols-9 overflow-hidden rounded-xl border-2 border-ink/80 bg-white ${solved ? 'gm-win' : ''}`} role="grid" aria-label="Grelha do sudoku">
          {grid.map((v, i) => {
            const r = Math.floor(i / 9), c = i % 9
            const given = !!game.puzzle[i]
            const isSel = i === selected
            const bad = conflicts.has(i)
            const bg = isSel ? g.light : sameValue && v === sameValue ? '#EEF2FF' : peers.has(i) ? '#F7F6FC' : '#fff'
            return (
              <button
                key={i}
                role="gridcell"
                onClick={() => setSelected(i)}
                aria-label={`Linha ${r + 1}, coluna ${c + 1}: ${v || 'vazia'}${given ? ' (dada)' : ''}`}
                aria-selected={isSel}
                className={`flex items-center justify-center text-lg font-bold tabular-nums transition-colors duration-150 sm:text-xl
                  ${c % 3 === 2 && c < 8 ? 'border-r-2 border-r-ink/70' : c < 8 ? 'border-r border-r-line' : ''}
                  ${r % 3 === 2 && r < 8 ? 'border-b-2 border-b-ink/70' : r < 8 ? 'border-b border-b-line' : ''}`}
                style={{ background: bg, color: bad ? '#F2545B' : given ? '#2B2840' : g.color, fontWeight: given ? 800 : 700, outline: isSel ? `2px solid ${g.color}` : undefined, outlineOffset: -2 }}
              >
                {v ? <span key={`${v}-${given ? 'g' : placed}`} className={given ? '' : 'gm-pop'}>{v}</span> : null}
              </button>
            )
          })}
        </div>

        <div className="mx-auto mt-5 grid max-w-md grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => put(n)} disabled={counts[n] >= 9} className="gm-btn h-12 px-0 text-xl tabular-nums" style={{ color: g.color }}>
              {n}
            </button>
          ))}
          <button onClick={() => put(0)} className="gm-btn h-12 px-0 text-muted" aria-label="Apagar">
            <BackspaceIcon size={20} />
          </button>
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-muted">
          {selected === null ? 'Escolhe uma casa vazia.' : conflicts.size ? 'Há números repetidos (a vermelho).' : 'No computador, usa os números e as setas.'}
        </p>
      </div>
    </GameFrame>
  )
}
