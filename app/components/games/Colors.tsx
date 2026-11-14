'use client'

import { useEffect, useState } from 'react'
import { COLORS_SECONDS, COLOR_HEX, COLOR_NAMES, colorRound, type ColorRound } from '../../lib/games'
import { GameFrame, Intro, ResultCard, TimeBar, useCountdown, useGameResult } from './GameFrame'
import { gameMeta } from './meta'

const g = gameMeta('cores')

/**
 * Cores: aparece o nome de uma cor escrito com outra cor. Conta a cor da tinta, não a palavra.
 * O cérebro lê a palavra sozinho; travar isso é o exercício.
 */
export default function Colors() {
  const [state, setState] = useState<'ready' | 'playing'>('ready')
  const [round, setRound] = useState<ColorRound>(() => colorRound())
  const [right, setRight] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [flash, setFlash] = useState<{ key: number; good: boolean } | null>(null)
  const { result, finish, reset } = useGameResult('cores')
  const left = useCountdown(COLORS_SECONDS, state === 'playing' && !result, () => finish(right))

  const answer = (color: number) => {
    if (state !== 'playing') return
    const good = color === round.ink
    if (good) setRight(r => r + 1)
    else setWrong(w => w + 1)
    setFlash({ key: Date.now(), good })
    setRound(r => colorRound(Math.random, r))
  }

  useEffect(() => {
    if (state !== 'playing' || result) return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < COLOR_NAMES.length) answer(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const start = () => {
    reset()
    setRight(0); setWrong(0); setFlash(null)
    setRound(colorRound())
    setState('playing')
  }

  if (result) {
    const total = result.score + wrong
    const pct = total ? Math.round((result.score / total) * 100) : 0
    return (
      <GameFrame id="cores">
        <ResultCard id="cores" result={result} title={pct >= 90 && result.score >= 20 ? 'Atenção de ferro' : pct >= 75 ? 'Muito focado' : 'O cérebro aqueceu'} onAgain={start}>
          <p className="text-sm font-semibold text-muted">{pct}% certas · {wrong} {wrong === 1 ? 'erro' : 'erros'}</p>
        </ResultCard>
      </GameFrame>
    )
  }

  if (state === 'ready') return <GameFrame id="cores"><Intro id="cores" onStart={start} /></GameFrame>

  return (
    <GameFrame id="cores" stat={<span className="gm-pill">{right} certas</span>}>
      <TimeBar left={left} total={COLORS_SECONDS} color={g.color} />
      <div className="my-auto flex flex-col items-center py-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Cor da tinta?</p>
        <div key={flash?.key ?? 0} className={`relative mt-3 rounded-3xl px-6 py-6 ${flash?.good ? 'gm-good' : flash ? 'animate-shake' : ''}`}>
          <p className="gm-pop text-center text-5xl font-black tracking-wide sm:text-6xl" style={{ color: COLOR_HEX[round.ink] }} aria-live="polite"
            aria-label={`A palavra ${COLOR_NAMES[round.word]}, escrita a ${COLOR_NAMES[round.ink].toLowerCase()}`}>
            {COLOR_NAMES[round.word].toUpperCase()}
          </p>
          {flash?.good && <span className="gm-plus absolute -top-1 right-0 text-base font-black text-accent">+1</span>}
        </div>
        <div className="mt-8 grid w-full grid-cols-2 gap-2.5">
          {COLOR_NAMES.map((name, i) => (
            <button key={name} onClick={() => answer(i)} className="gm-btn relative h-14 justify-start gap-3">
              <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: COLOR_HEX[i] }} />
              {name}
              <span className="ml-auto hidden text-[10px] font-bold text-muted lg:inline">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
