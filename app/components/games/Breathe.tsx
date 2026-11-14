'use client'

import { useEffect, useRef, useState } from 'react'
import { breathAt } from '../../lib/games'
import { GameFrame, Intro, OptionCards, ResultCard, useGameResult } from './GameFrame'
import { gameMeta } from './meta'

const DURATIONS = [
  { value: 1, title: '1 min', hint: 'Pausa rápida' },
  { value: 2, title: '2 min', hint: 'Para acalmar' },
  { value: 3, title: '3 min', hint: 'Relaxar a fundo' },
]
const g = gameMeta('respirar')

/** Respiração guiada: o círculo cresce ao inspirar, pára ao segurar e encolhe ao expirar */
export default function Breathe() {
  const [minutes, setMinutes] = useState(1)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const { result, finish, reset } = useGameResult('respirar')
  const total = minutes * 60
  const done = useRef(finish)
  useEffect(() => { done.current = finish })

  useEffect(() => {
    if (!running) return
    const start = performance.now()
    const id = window.setInterval(() => {
      const s = (performance.now() - start) / 1000
      if (s >= total) {
        window.clearInterval(id)
        setRunning(false)
        done.current(total)
        return
      }
      setElapsed(s)
    }, 200)
    return () => window.clearInterval(id)
  }, [running, total])

  const stop = () => {
    setRunning(false)
    if (elapsed >= 10) finish(Math.round(elapsed))
    else setElapsed(0)
  }

  if (result) {
    return (
      <GameFrame id="respirar">
        <ResultCard id="respirar" result={{ ...result, record: false, best: undefined }} title="Respiraste durante" onAgain={() => { reset(); setElapsed(0) }}>
          <p className="max-w-xs text-sm font-semibold text-muted">Ombros soltos, cabeça mais leve. Bebe um copo de água antes de voltar.</p>
        </ResultCard>
      </GameFrame>
    )
  }

  if (!running) {
    return (
      <GameFrame id="respirar">
        <Intro
          id="respirar"
          onStart={() => { setElapsed(0); setRunning(true) }}
          options={
            <OptionCards id="respirar" label="Duração" value={minutes} onChange={setMinutes} items={DURATIONS} />
          }
        />
      </GameFrame>
    )
  }

  const { phase, left, index } = breathAt(elapsed)
  const remaining = Math.max(0, Math.ceil(total - elapsed))
  const transition = `transform ${phase.seconds}s cubic-bezier(0.45, 0, 0.55, 1)`

  return (
    <GameFrame id="respirar" stat={<span className="gm-pill">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}>
      <div className="my-auto flex flex-col items-center py-8">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <span className="absolute inset-0 rounded-full opacity-10" style={{ background: g.color, transform: `scale(${phase.scale * 1.15})`, transition }} />
          <span className="absolute inset-4 rounded-full opacity-25" style={{ background: g.color, transform: `scale(${phase.scale})`, transition }} />
          <span className="absolute inset-10 rounded-full" style={{ background: g.color, transform: `scale(${phase.scale})`, transition }} />
          <span className="relative text-4xl font-black tabular-nums text-white">{left}</span>
        </div>
        <p key={index} className="gm-in mt-8 text-2xl font-black text-ink" aria-live="polite">{phase.label}</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          {index === 0 ? 'pelo nariz, devagar' : index === 1 ? 'sem esforço' : 'pela boca, a soltar os ombros'}
        </p>
        <button onClick={stop} className="gm-btn mt-10 w-full max-w-xs">Terminar</button>
      </div>
    </GameFrame>
  )
}
