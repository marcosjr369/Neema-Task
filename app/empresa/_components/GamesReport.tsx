'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PuzzlePieceIcon } from '@phosphor-icons/react'
import { useOrgRequired } from '../../context/OrgContext'
import { api } from '../../lib/api'
import { topGames, type PlayTotals } from '../../lib/games'
import { formatDuration } from '../../lib/stats'
import { gameMeta } from '../../components/games/meta'
import Avatar from '../../components/ui/Avatar'
import type { GameId, Member } from '../../types'

type Res = { members: ({ memberId: string } & PlayTotals)[]; games: Partial<Record<GameId, number>> }

const when = (t: number) => new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t)

/**
 * Relatórios → tempo nos minijogos: quanto cada pessoa jogou no período e a que jogos.
 * Só a administração vê (o servidor também o garante).
 */
export default function GamesReport({ from, people }: { from: number; people: Member[] }) {
  const org = useOrgRequired()
  const [data, setData] = useState<Res | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api<Res>(`/api/orgs/${org.org.id}/jogos?from=${from}`)
      .then(r => { if (alive) { setData(r); setFailed(false) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [org.org.id, from])

  // só as pessoas do filtro (departamento) e com tempo no período
  const byId = new Map(people.map(m => [m.id, m]))
  const rows = (data?.members ?? []).filter(r => byId.has(r.memberId)).sort((a, b) => b.seconds - a.seconds)
  const total = rows.reduce((a, r) => a + r.seconds, 0)
  const games: Partial<Record<GameId, number>> = {}
  for (const r of rows) for (const [g, s] of topGames(r.games)) games[g] = (games[g] ?? 0) + s
  const ranked = topGames(games)
  const max = ranked[0]?.[1] ?? 0

  return (
    <section className="card p-4" aria-labelledby="games-report">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FCE6F2] text-[#C93F87]">
          <PuzzlePieceIcon size={22} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="games-report" className="font-black text-ink">Tempo nos jogos</h2>
          <p className="text-sm font-semibold text-muted">Pausas feitas com os minijogos, neste período.</p>
        </div>
        {rows.length > 0 && (
          <div className="text-right">
            <p className="text-xl font-black tabular-nums text-ink">{formatDuration(total)}</p>
            <p className="text-xs font-bold text-muted">{rows.length} {rows.length === 1 ? 'pessoa' : 'pessoas'}</p>
          </div>
        )}
      </div>

      {failed ? (
        <p className="mt-4 text-sm font-semibold text-danger">Não foi possível carregar o tempo nos jogos.</p>
      ) : !data ? (
        <div className="mt-4 space-y-2">{[0, 1, 2].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-snow p-4 text-center text-sm font-semibold text-muted">Ninguém jogou neste período.</p>
      ) : (
        <>
          {/* por jogo: barras com o nome e o tempo ao lado (sem legenda à parte) */}
          <ul className="mt-5 space-y-2">
            {ranked.map(([id, s]) => {
              const g = gameMeta(id)
              return (
                <li key={id} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-bold text-body">
                    <g.icon size={16} weight="duotone" style={{ color: g.color }} className="shrink-0" />
                    <span className="truncate">{g.title}</span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-snow">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (s / max) * 100)}%`, background: g.color }} />
                  </span>
                  <span className="text-right font-black tabular-nums text-ink">{formatDuration(s)}</span>
                </li>
              )
            })}
          </ul>

          {/* por pessoa */}
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {rows.map(r => {
              const m = byId.get(r.memberId)!
              return (
                <li key={r.memberId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <Link href={`/empresa/membro/${m.id}`} className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                    <Avatar name={m.name} picture={m.picture} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate font-black text-ink">{m.name}</span>
                      <span className="block text-xs font-semibold text-muted">
                        {r.sessions} {r.sessions === 1 ? 'vez' : 'vezes'} · última {when(r.lastAt)}
                      </span>
                    </span>
                  </Link>
                  <span className="flex flex-wrap gap-1.5">
                    {topGames(r.games).slice(0, 3).map(([id, s]) => {
                      const g = gameMeta(id)
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold" style={{ background: g.light, color: '#4A4763' }}>
                          <g.icon size={13} weight="duotone" style={{ color: g.color }} /> {g.title} · {formatDuration(s)}
                        </span>
                      )
                    })}
                  </span>
                  <span className="w-20 text-right font-black tabular-nums text-ink">{formatDuration(r.seconds)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
