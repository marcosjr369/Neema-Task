'use client'

import './games.css'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftIcon, CheckIcon, CoffeeIcon, PlayIcon, TrophyIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import { useApp, useClock } from '../../context/AppContext'
import { formatClock, phaseElapsed } from '../../lib/stats'
import { formatScore } from '../../lib/games'
import { sounds } from '../../lib/sounds'
import type { GameId } from '../../types'
import Confetti from '../ui/Confetti'
import GamePreview from './Preview'
import { gameDark, gameMeta } from './meta'

/** Durante a pausa do cronómetro: quanto falta, com atalho para voltar ao foco */
function BreakChip() {
  const { timer } = useApp()
  const { now } = useClock()
  if (!timer || timer.phase !== 'break') return null
  const left = Math.max(0, timer.breakSeconds - phaseElapsed(timer, now))
  return (
    <Link href="/foco" className="gm-pill bg-accent-light! text-accent-dark! hover:brightness-95" title="Voltar ao foco">
      <CoffeeIcon size={13} weight="fill" /> {formatClock(left)}
    </Link>
  )
}

/** Moldura de cada jogo: voltar, nome e os números do jogo (à direita) */
export function GameFrame({ id, stat, children }: { id: GameId; stat?: ReactNode; children: ReactNode }) {
  const g = gameMeta(id)
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-lg flex-col px-4 pb-8 pt-4 lg:min-h-[calc(100dvh-3rem)]" style={{ ['--gm-cta' as string]: gameDark(id) }}>
      <header className="flex h-10 items-center gap-2">
        <Link href="/jogos" aria-label="Voltar aos jogos" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-snow hover:text-ink">
          <ArrowLeftIcon size={20} />
        </Link>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.color }} />
        <h1 className="min-w-0 flex-1 truncate text-base font-black text-ink">{g.title}</h1>
        <BreakChip />
        {stat}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}

/**
 * Ecrã de início: a animação do jogo, como se joga e, por etapas, como ajuda a descontrair.
 * As etapas entram uma a uma e o destaque passa de uma para a outra (também dá para tocar).
 */
export function Intro({ id, onStart, options, startLabel = 'Começar' }: { id: GameId; onStart: () => void; options?: ReactNode; startLabel?: string }) {
  const g = gameMeta(id)
  const [step, setStep] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto) return
    const t = window.setInterval(() => setStep(s => (s + 1) % g.relax.length), 3800)
    return () => window.clearInterval(t)
  }, [auto, g.relax.length])

  return (
    <div className="my-auto py-4">
      <div className="gm-in"><GamePreview id={id} /></div>

      <p className="gm-in mt-5 text-[15px] font-semibold leading-relaxed text-body" style={{ ['--d' as string]: '0.08s' }}>{g.howTo}</p>

      <section className="mt-6" aria-label="Como te ajuda a descontrair">
        <h2 className="gm-in text-xs font-black uppercase tracking-[0.12em] text-muted" style={{ ['--d' as string]: '0.15s' }}>Como te ajuda a descontrair</h2>
        <ol className="mt-3 space-y-1.5">
          {g.relax.map((r, i) => {
            const on = i === step
            return (
              <li key={r.title} className="gm-in" style={{ ['--d' as string]: `${0.25 + i * 0.15}s` }}>
                <button
                  onClick={() => { setStep(i); setAuto(false) }}
                  aria-current={on ? 'step' : undefined}
                  className="flex w-full cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-300"
                  style={{ background: on ? g.light : 'transparent' }}
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black transition-colors duration-300"
                    style={on ? { background: g.color, color: '#fff' } : { background: '#F7F6FC', color: '#A3A0B8' }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-black transition-colors ${on ? 'text-ink' : 'text-body'}`}>{r.title}</span>
                    {/* o texto abre só na etapa em destaque: lê-se uma de cada vez */}
                    <span className={`grid transition-[grid-template-rows,opacity] duration-300 ${on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <span className="overflow-hidden text-sm font-semibold leading-snug text-body">{r.text}</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {g.relax.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === step ? 18 : 6, background: i === step ? g.color : '#E9E7F2' }} />
          ))}
        </div>
      </section>

      {options && <div className="gm-in mt-6" style={{ ['--d' as string]: '0.7s' }}>{options}</div>}
      <button onClick={onStart} className="gm-cta gm-in mt-5 h-14 w-full text-base" style={{ ['--d' as string]: '0.75s' }}>
        <PlayIcon size={18} weight="fill" /> {startLabel}
      </button>
    </div>
  )
}

/**
 * Escolha antes de começar (duração, dificuldade): cartões grandes com título e uma linha a
 * explicar, em vez de uma barra pequena. O escolhido fica na cor do jogo, com um visto.
 */
export function OptionCards<T extends string | number>({ id, label, value, onChange, items }: {
  id: GameId
  label: string
  value: T
  onChange: (v: T) => void
  items: { value: T; title: string; hint: string }[]
}) {
  const g = gameMeta(id)
  return (
    <fieldset>
      <legend className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</legend>
      <div className="mt-2.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {items.map(item => {
          const on = item.value === value
          return (
            <button
              key={String(item.value)}
              role="radio"
              aria-checked={on}
              onClick={() => onChange(item.value)}
              className="relative flex cursor-pointer flex-col justify-start rounded-2xl border-2 px-3 py-3 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.97]"
              style={on ? { borderColor: g.color, background: g.light } : { borderColor: '#E9E7F2', background: '#fff' }}
            >
              <span
                className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200"
                style={on ? { borderColor: g.color, background: g.color, color: '#fff' } : { borderColor: '#E9E7F2', color: 'transparent' }}
              >
                <CheckIcon size={11} weight="bold" />
              </span>
              <span className="block pr-6 text-base font-black text-ink">{item.title}</span>
              <span className="mt-0.5 block text-xs font-semibold leading-snug text-muted">{item.hint}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export type GameResult = { score: number; record: boolean; best?: number }

/** Guarda o resultado (servidor) e diz se foi recorde */
export function useGameResult(id: GameId) {
  const account = useAccount()
  const [result, setResult] = useState<GameResult | null>(null)
  // a conta muda (ex.: ao guardar o resultado): `finish` fica estável e só guarda uma vez por jogo
  const latest = useRef(account)
  useEffect(() => { latest.current = account })
  const saved = useRef(false)
  const finish = useCallback((score: number) => {
    if (saved.current) return
    saved.current = true
    const { recordGame, user, settings } = latest.current
    const best = user?.games?.[id]?.best
    const record = recordGame(id, score)
    if (record && best !== undefined && settings.sound) sounds.success()
    setResult({ score, record: record && best !== undefined, best })
  }, [id])
  const reset = useCallback(() => { saved.current = false; setResult(null) }, [])
  return { result, finish, reset }
}

/** Ecrã do fim: o resultado em grande, o recorde e jogar outra vez */
export function ResultCard({ id, result, title, children, onAgain }: { id: GameId; result: GameResult; title: string; children?: ReactNode; onAgain: () => void }) {
  const g = gameMeta(id)
  const again = useRef<HTMLButtonElement>(null)
  useEffect(() => { again.current?.focus() }, [])
  return (
    <div className="my-auto flex flex-col items-center py-8 text-center">
      {result.record && <Confetti count={40} />}
      <span className="gm-pop flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: g.light, color: g.color }}>
        <g.icon size={28} weight="duotone" />
      </span>
      <p className="gm-in mt-4 text-sm font-bold text-muted" style={{ ['--d' as string]: '0.1s' }}>{title}</p>
      <p className="gm-in mt-1 text-5xl font-black tabular-nums tracking-tight text-ink" style={{ ['--d' as string]: '0.2s' }}>{formatScore(id, result.score)}</p>
      {result.record ? (
        <p className="gm-pop mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFF4D6] px-3 py-1 text-sm font-black text-gold-dark" style={{ ['--d' as string]: '0.45s' }}>
          <TrophyIcon size={15} weight="fill" /> Novo recorde
        </p>
      ) : result.best !== undefined ? (
        <p className="gm-in mt-3 text-sm font-semibold text-muted" style={{ ['--d' as string]: '0.35s' }}>Recorde: {formatScore(id, result.best)}</p>
      ) : null}
      {children && <div className="gm-in mt-2" style={{ ['--d' as string]: '0.4s' }}>{children}</div>}
      <div className="gm-in mt-8 grid w-full max-w-xs gap-2" style={{ ['--d' as string]: '0.5s' }}>
        <button ref={again} onClick={onAgain} className="gm-cta w-full">Jogar outra vez</button>
        <Link href="/jogos" className="gm-btn w-full">Outros jogos</Link>
      </div>
    </div>
  )
}

/** Contagem decrescente (segundos que faltam), só enquanto `running` */
export function useCountdown(seconds: number, running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(seconds)
  const end = useRef(onEnd)
  useEffect(() => { end.current = onEnd })
  useEffect(() => {
    if (!running) return
    const start = performance.now()
    const id = window.setInterval(() => {
      const l = Math.max(0, seconds - (performance.now() - start) / 1000)
      setLeft(l)
      if (l <= 0) {
        window.clearInterval(id)
        end.current()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [running, seconds])
  return running ? left : seconds
}

/** Barra fina do tempo que falta (fica vermelha nos últimos segundos) */
export function TimeBar({ left, total, color }: { left: number; total: number; color: string }) {
  const k = left / total
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-snow" role="progressbar" aria-label="Tempo" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.ceil(left)}>
      <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${k * 100}%`, background: k < 0.15 ? '#F2545B' : color }} />
    </div>
  )
}

/** Segundos que passam (para os jogos sem limite de tempo) */
export function useStopwatch(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const start = useRef(0)
  useEffect(() => {
    if (!running) return
    start.current = performance.now() - seconds * 1000
    const id = window.setInterval(() => setSeconds(Math.floor((performance.now() - start.current) / 1000)), 500)
    return () => window.clearInterval(id)
    // só arranca/pára com `running`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  return { seconds, reset: () => setSeconds(0) }
}
