'use client'

import { useEffect, useState } from 'react'
import { MATH_SECONDS, mathLevel, mathQuestion, type MathQuestion } from '../../lib/games'
import { GameFrame, Intro, ResultCard, TimeBar, useCountdown, useGameResult } from './GameFrame'
import { gameMeta } from './meta'

const LEVELS = ['Aquecer', 'A subir', 'Rápido', 'Mestre']
const g = gameMeta('contas')

/** Contas rápidas: um minuto, quatro respostas, fica mais difícil a cada 4 certas seguidas */
export default function QuickMath() {
  const [state, setState] = useState<'ready' | 'playing'>('ready')
  const [q, setQ] = useState<MathQuestion>(() => mathQuestion(0))
  const [right, setRight] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [streak, setStreak] = useState(0)
  const [flash, setFlash] = useState<{ key: number; good: boolean } | null>(null)
  const { result, finish, reset } = useGameResult('contas')
  const left = useCountdown(MATH_SECONDS, state === 'playing' && !result, () => finish(right))

  const answer = (n: number) => {
    if (state !== 'playing') return
    const good = n === q.answer
    const nextStreak = good ? streak + 1 : 0
    setStreak(nextStreak)
    if (good) setRight(r => r + 1)
    else setWrong(w => w + 1)
    setFlash({ key: Date.now(), good })
    setQ(mathQuestion(mathLevel(nextStreak)))
  }

  // teclas 1–4 (no computador é mais rápido)
  useEffect(() => {
    if (state !== 'playing' || result) return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < q.options.length) answer(q.options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const start = () => {
    reset()
    setRight(0); setWrong(0); setStreak(0); setFlash(null)
    setQ(mathQuestion(0))
    setState('playing')
  }

  if (result) {
    return (
      <GameFrame id="contas">
        <ResultCard id="contas" result={result} title={result.score >= 25 ? 'Calculadora humana' : result.score >= 12 ? 'Boa cabeça' : 'Bom aquecimento'} onAgain={start}>
          <p className="text-sm font-semibold text-muted">{wrong} {wrong === 1 ? 'errada' : 'erradas'} num minuto</p>
        </ResultCard>
      </GameFrame>
    )
  }

  if (state === 'ready') return <GameFrame id="contas"><Intro id="contas" onStart={start} /></GameFrame>

  const level = mathLevel(streak)
  return (
    <GameFrame id="contas" stat={<span className="gm-pill">{right} certas</span>}>
      <TimeBar left={left} total={MATH_SECONDS} color={g.color} />
      <div className="my-auto flex flex-col items-center py-8">
        <span key={level} className="gm-pop text-xs font-black uppercase tracking-[0.14em]" style={{ color: g.color }}>{LEVELS[level]}</span>
        <div key={flash?.key ?? 0} className={`relative mt-3 rounded-3xl px-8 py-5 ${flash?.good ? 'gm-good' : flash ? 'animate-shake' : ''}`}>
          <p className="gm-in text-center font-mono text-5xl font-black tabular-nums text-ink sm:text-6xl" aria-live="polite">{q.text}</p>
          {flash?.good && <span className="gm-plus absolute -top-2 right-0 text-base font-black text-accent">+1</span>}
        </div>
        <div className="mt-8 grid w-full grid-cols-2 gap-2.5">
          {q.options.map((n, i) => (
            <button key={`${q.text}-${n}`} onClick={() => answer(n)} className="gm-btn gm-pop relative h-16 font-mono text-2xl font-black tabular-nums" style={{ ['--d' as string]: `${i * 0.03}s` }}>
              <span className="absolute left-3 top-2 hidden text-[10px] font-bold text-muted lg:block">{i + 1}</span>
              {n}
            </button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
