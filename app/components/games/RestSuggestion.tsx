'use client'

import './games.css'
import Link from 'next/link'
import { useState } from 'react'
import { XIcon } from '@phosphor-icons/react'
import { useApp, useMinute } from '../../context/AppContext'
import { SUGGEST_AFTER_SECONDS, suggestedGame } from '../../lib/games'
import { formatDuration, todaySeconds } from '../../lib/stats'
import { gameMeta } from './meta'

/** Fechado nesta visita (sem guardar no browser: volta a aparecer noutro dia ou ao recarregar) */
let dismissedAt = 0

/**
 * Quando sugerir um jogo: na pausa do cronómetro, ou depois de muito foco no dia (sem estar a
 * meio de um bloco: aí quem avisa é o "Hora de pausar").
 */
export function useRestSuggestion() {
  const { sessions, timer } = useApp()
  const now = useMinute()
  const today = todaySeconds(sessions, now)
  const onBreak = timer?.phase === 'break'
  const focusing = timer?.phase === 'focus' && !!timer.segmentStart
  const tired = today >= SUGGEST_AFTER_SECONDS
  return { today, onBreak, show: onBreak || (tired && !focusing), game: onBreak ? 'respirar' as const : suggestedGame(today, now) }
}

export default function RestSuggestion({ className = '' }: { className?: string }) {
  const { today, onBreak, show, game } = useRestSuggestion()
  const [hidden, setHidden] = useState(() => Date.now() - dismissedAt < 2 * 60 * 60 * 1000)
  if (!show || hidden) return null
  const g = gameMeta(game)
  const text = onBreak ? 'Estás em pausa. Desliga a cabeça um bocadinho.' : `Já focaste ${formatDuration(today)} hoje. Mereces uma pausa.`

  return (
    <div className={`gm-in relative rounded-2xl border border-line bg-white p-4 ${className}`}>
      <button
        onClick={() => { dismissedAt = Date.now(); setHidden(true) }}
        aria-label="Agora não"
        className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-snow hover:text-body"
      >
        <XIcon size={15} />
      </button>
      <p className="pr-8 text-sm font-bold text-body">{text}</p>
      <Link href={`/jogos/${game}`} className="group mt-3 flex items-center gap-3 rounded-xl p-2 transition-colors" style={{ background: g.light }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white transition-transform group-hover:scale-105" style={{ color: g.color }}>
          <g.icon size={22} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-ink">{g.title}</span>
          <span className="block text-xs font-semibold text-body">{g.tag} · {g.minutes}</span>
        </span>
        <span className="pr-1 text-sm font-black" style={{ color: g.color }}>Jogar</span>
      </Link>
      <Link href="/jogos" className="mt-2 block text-center text-xs font-bold text-muted hover:text-body">Ver todos os jogos</Link>
    </div>
  )
}
