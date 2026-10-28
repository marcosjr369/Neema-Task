'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BuildingsIcon, CrownIcon, UserPlusIcon } from '@phosphor-icons/react'
import { useAccount } from '../context/AccountContext'
import { useOrgRequired } from '../context/OrgContext'
import { api, errorText } from '../lib/api'
import { achievementsFrom, isUnlocked } from '../lib/achievements'
import { formatShort } from '../lib/stats'
import { COMPANY_ACCOUNT_LABEL, type TeamProgress } from '../types'
import Avatar from '../components/ui/Avatar'
import Mascot from '../components/ui/Mascot'
import LogoutButton from '../components/account/LogoutButton'
import AccountSection from './AccountSection'

type Tab = 'equipa' | 'conta'
const TABS: { id: Tab; label: string }[] = [
  { id: 'equipa', label: 'Equipa' },
  { id: 'conta', label: 'Conta' },
]

const MEDALS = ['#FFC53D', '#C0C0C0', '#CD7F32']

function useTeamProgress() {
  const org = useOrgRequired()
  const [people, setPeople] = useState<TeamProgress[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ people: TeamProgress[] }>(`${org.base}/equipa`)
      .then(r => setPeople(r.people))
      .catch(err => setError(errorText(err)))
  }, [org.base])
  return { people, error }
}

/** Avatares sobrepostos (no máximo "max", com "+n") */
function Faces({ people, max = 5 }: { people: TeamProgress[]; max?: number }) {
  if (people.length === 0) return <span className="text-xs font-bold text-muted">Ninguém ainda</span>
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map(p => (
        <span key={p.id} className="rounded-full ring-2 ring-white" title={p.name}><Avatar name={p.name} picture={p.picture} size={26} /></span>
      ))}
      {people.length > max && (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-snow text-[11px] font-black text-muted ring-2 ring-white">+{people.length - max}</span>
      )}
    </span>
  )
}

function Team() {
  const org = useOrgRequired()
  const { people, error } = useTeamProgress()

  if (error) return <p className="card p-4 text-center font-bold text-danger">{error}</p>
  if (people === null) return <div className="flex justify-center py-16"><Mascot size={80} className="animate-bounce-soft" /></div>
  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <Mascot size={96} mood="sleepy" />
        <p className="mt-4 text-lg font-black text-ink">Ainda sem equipa</p>
        <Link href="/empresa/pessoas" className="btn btn-primary mt-6"><UserPlusIcon size={18} /> Adicionar funcionários</Link>
      </div>
    )
  }

  const withAchievements = people.map(p => ({ person: p, list: achievementsFrom(p.progress) }))
  const definitions = withAchievements[0].list
  const totals = {
    seconds: people.reduce((a, p) => a + p.seconds, 0),
    done: people.reduce((a, p) => a + p.progress.done, 0),
    unlocked: withAchievements.reduce((a, x) => a + x.list.filter(isUnlocked).length, 0),
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: 'Horas da equipa', value: formatShort(totals.seconds), color: '#12B5A6' },
          { label: 'Concluídas', value: String(totals.done), color: '#7B61FF' },
          { label: 'Conquistas', value: String(totals.unlocked), color: '#E0A419' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] font-extrabold uppercase text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-black text-ink">Conquistas da equipa</h2>
          <span className="text-sm font-bold text-muted">{people.length} pessoa{people.length === 1 ? '' : 's'}</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {definitions.map((a, i) => {
            const winners = withAchievements.filter(x => isUnlocked(x.list[i])).map(x => x.person)
            const pct = winners.length / people.length
            const AIcon = a.icon
            const any = winners.length > 0
            return (
              <li key={a.id} className="card flex items-center gap-4 p-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: any ? a.color : '#E9E7F2', boxShadow: `0 4px 0 ${any ? '#0002' : '#D3D0E0'}`, color: any ? '#fff' : '#B9B6CC' }}
                >
                  <AIcon size={30} weight={any ? 'fill' : 'duotone'} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-ink">{a.title}</div>
                  <div className="mb-1.5 text-xs font-semibold text-muted">{a.desc}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct * 100}%`, background: a.color }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-muted">{winners.length}/{people.length}</span>
                  </div>
                  <div className="mt-2"><Faces people={winners} /></div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black text-ink">Pessoas</h2>
        <ol className="card divide-y-2 divide-line">
          {withAchievements.map(({ person: p, list }, i) => {
            const d = org.deptById(p.departmentId)
            const unlocked = list.filter(isUnlocked)
            return (
              <li key={p.id}>
                <Link href={`/empresa/membro/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-snow">
                  <span className="w-6 text-center font-black" style={{ color: MEDALS[i] ?? '#A3A0B8' }}>
                    {i === 0 && p.xp > 0 ? <CrownIcon size={20} weight="fill" color="#FFC53D" className="mx-auto" /> : i + 1}
                  </span>
                  <span className="relative">
                    <Avatar name={p.name} picture={p.picture} size={44} />
                    <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-lg border-2 border-white bg-brand px-1 text-[11px] font-black text-white">
                      {p.level}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-ink">{p.name}</span>
                    <span className="block truncate text-xs font-semibold text-muted">
                      {[p.jobTitle, d?.name].filter(Boolean).join(' · ') || 'Sem departamento'}
                    </span>
                    <span className="mt-1 flex gap-1">
                      {unlocked.map(a => {
                        const AIcon = a.icon
                        return (
                          <span key={a.id} title={a.title} className="flex h-6 w-6 items-center justify-center rounded-lg text-white" style={{ background: a.color }}>
                            <AIcon size={14} weight="fill" />
                          </span>
                        )
                      })}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-black text-ink">{p.xp} XP</span>
                    <span className="block text-[11px] font-extrabold uppercase text-muted">Nível {p.level}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

/** Perfil da conta da empresa: a equipa no centro, em vez de estatísticas pessoais */
export default function CompanyProfile() {
  const { user } = useAccount()
  const org = useOrgRequired()
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    return t && TABS.some(x => x.id === t) ? t : 'equipa'
  })
  const active = org.members.filter(m => m.status === 'activo').length

  return (
    <div>
      <header className="px-4 pb-5 pt-6 lg:px-0">
        <div className="flex items-start gap-4">
          {user?.picture ? (
            <Avatar name={org.org.name} picture={user.picture} size={76} />
          ) : (
            <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-3xl bg-accent-light text-accent-dark">
              <BuildingsIcon size={38} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black text-ink">{org.org.name}</h1>
            <p className="truncate text-sm font-semibold text-muted">
              {COMPANY_ACCOUNT_LABEL}{org.org.sector ? ` · ${org.org.sector}` : ''} · {active} pessoa{active === 1 ? '' : 's'} activa{active === 1 ? '' : 's'}
            </p>
            <p className="truncate text-sm font-semibold text-muted">
              Desde {new Date(org.org.createdAt).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <LogoutButton variant="icon" />
        </div>
      </header>
      <nav className="sticky top-0 z-20 flex gap-1 border-b-2 border-line bg-white/95 px-4 backdrop-blur lg:px-0" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-4 px-3 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors cursor-pointer sm:flex-none ${
              tab === t.id ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-body'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div key={tab} className="px-4 pb-6 pt-5 animate-fade-in lg:px-0">
        {tab === 'equipa' && <Team />}
        {tab === 'conta' && <AccountSection />}
      </div>
    </div>
  )
}
