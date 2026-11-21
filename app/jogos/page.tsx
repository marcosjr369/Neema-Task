'use client'

import '../components/games/games.css'
import Link from 'next/link'
import { EyeIcon, PlayIcon } from '@phosphor-icons/react'
import { useAccount } from '../context/AccountContext'
import { useOrg } from '../context/OrgContext'
import { GAMES, GROUPS, gameDark, gameMeta, type GameMeta } from '../components/games/meta'
import GamePreview from '../components/games/Preview'
import { useRestSuggestion } from '../components/games/RestSuggestion'
import { formatScore } from '../lib/games'
import { formatDuration } from '../lib/stats'
import type { GameStats } from '../types'
import { FeatureGate } from '../components/layout/useCan'

/** O jogo em destaque: grande, na cor do jogo, com a animação a correr */
function Featured({ g, stats, reason }: { g: GameMeta; stats?: GameStats; reason: string }) {
  return (
    <Link
      href={`/jogos/${g.id}`}
      className="gm-in group relative flex flex-col overflow-hidden rounded-3xl sm:flex-row sm:items-stretch"
      style={{ background: g.light, ['--gm-cta' as string]: gameDark(g.id) }}
    >
      <div className="flex flex-1 flex-col justify-center p-6 sm:p-8">
        <p className="text-sm font-bold" style={{ color: gameDark(g.id) }}>{reason}</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-ink">{g.title}</h2>
        <p className="mt-2 max-w-sm font-semibold text-body">{g.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="gm-cta h-11 px-5 transition-transform group-hover:scale-[1.03]"><PlayIcon size={16} weight="fill" /> Jogar</span>
          <span className="text-sm font-bold text-body/70">
            {g.minutes}{stats && g.id !== 'respirar' ? ` · recorde ${formatScore(g.id, stats.best)}` : ''}
          </span>
        </div>
      </div>
      <div className="-mt-2 flex items-center justify-center pb-5 sm:mt-0 sm:w-[46%] sm:pb-0">
        <GamePreview id={g.id} bare className="h-24 sm:h-full" scale={1.3} />
      </div>
    </Link>
  )
}

/** Cartão da prateleira: a ilustração do jogo (ganha vida ao passar o rato), nome e recorde */
function Tile({ g, stats, i }: { g: GameMeta; stats?: GameStats; i: number }) {
  const line = stats && g.id !== 'respirar' ? `Recorde ${formatScore(g.id, stats.best)}` : stats ? `${stats.plays}× jogado` : g.minutes
  return (
    <li className="gm-in" style={{ ['--d' as string]: `${0.1 + i * 0.04}s` }}>
      <Link href={`/jogos/${g.id}`} className="group block">
        <div className="overflow-hidden rounded-2xl transition-transform duration-300 group-hover:-translate-y-1 group-active:translate-y-0">
          <GamePreview id={g.id} still className="h-32 rounded-2xl transition-[filter] duration-300 group-hover:brightness-[0.97]" scale={0.85} />
        </div>
        <p className="mt-2.5 font-black text-ink">{g.title}</p>
        <p className="text-sm font-semibold text-muted">{g.tag} · {line}</p>
      </Link>
    </li>
  )
}

function GamesPageContent() {
  const { user } = useAccount()
  const org = useOrg()
  const { today, onBreak, show, game } = useRestSuggestion()
  const first = user?.name.split(' ')[0]

  const featured = gameMeta(game)
  const reason = onBreak ? 'Para a tua pausa' : show ? `Já focaste ${formatDuration(today)} hoje` : 'Sugestão de hoje'
  const title = onBreak ? 'Hora de desligar um bocadinho' : show ? `Mereces uma pausa${first ? `, ${first}` : ''}` : `Uma pausa${first ? `, ${first}` : ''}?`

  let n = 0
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="gm-in mb-5">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
        {org && !org.isCompany && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <EyeIcon size={14} /> A administração da {org.org.name} vê o tempo que passas nos jogos.
          </p>
        )}
      </header>

      <Featured g={featured} stats={user?.games?.[featured.id]} reason={reason} />

      {GROUPS.map(group => {
        const list = GAMES.filter(x => x.group === group.id && x.id !== featured.id)
        if (!list.length) return null
        return (
          <section key={group.id} className="mt-10">
            <h2 className="gm-in text-lg font-black text-ink" style={{ ['--d' as string]: `${0.08 + n * 0.04}s` }}>{group.title}</h2>
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
              {list.map(g => <Tile key={g.id} g={g} stats={user?.games?.[g.id]} i={n++} />)}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** A empresa pode tirar esta página a algumas pessoas (Definições → Permissões) */
export default function GamesPage() {
  return <FeatureGate feature="jogos"><GamesPageContent /></FeatureGate>
}
