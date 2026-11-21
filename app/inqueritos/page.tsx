'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRightIcon, ChatCircleTextIcon, CheckCircleIcon, ClockIcon, EyeIcon, GlobeIcon, LockIcon, PlusIcon, SparkleIcon, UsersThreeIcon } from '@phosphor-icons/react'
import Modal from '../components/ui/Modal'
import Mascot from '../components/ui/Mascot'
import { CardGridSkeleton } from '../components/ui/Skeleton'
import { Busy } from '../components/ui/Spinner'
import { TYPE_LOOK, ago, closesText } from '../components/polls/look'
import StatusPill from '../components/polls/StatusPill'
import { api, errorText } from '../lib/api'
import { POLL_TYPES, TYPE_INFO } from '../lib/polls'
import { useApp } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import { CreateLocked, useCan } from '../components/layout/useCan'
import type { PollSummary, PollType, ShareVisibility } from '../types'

const VIS_ICON = { org: UsersThreeIcon, link: GlobeIcon, private: LockIcon }

function Card({ p, i }: { p: PollSummary; i: number }) {
  const look = TYPE_LOOK[p.type]
  const Vis = VIS_ICON[p.visibility]
  const todo = p.status === 'open' && !p.answered && p.access === 'view'
  return (
    <li className="animate-dg-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
      <Link href={`/inqueritos/${p.id}`}
        className="group relative flex h-full min-h-[210px] flex-col rounded-3xl border-2 border-line bg-white p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_-16px_rgb(43_40_64/0.4)] active:translate-y-0"
        onMouseEnter={e => (e.currentTarget.style.borderColor = look.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = '')}>
        <span className="flex items-start justify-between gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110" style={{ background: look.light, color: look.color }}>
            <look.icon size={26} weight="duotone" />
          </span>
          <span className="flex flex-col items-end gap-1">
            <StatusPill status={p.status} />
            {p.fresh && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-extrabold leading-none text-white">Novo</span>}
          </span>
        </span>

        <span className="mt-4 line-clamp-2 text-[17px] font-black leading-snug text-ink group-hover:text-brand-dark">{p.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs font-bold text-muted">
          <span style={{ color: look.color }}>{TYPE_INFO[p.type].name}</span>
          {!p.mine && p.ownerName && <span>· {p.ownerName}</span>}
        </span>
        {p.closesAt && p.status === 'open' && (
          <span className="mt-2 inline-flex items-center gap-1 self-start rounded-lg bg-snow px-2 py-1 text-xs font-bold text-body"><ClockIcon size={13} /> {closesText(p.closesAt)}</span>
        )}

        <span className="min-h-4 flex-1" />
        {todo ? (
          <span className="mb-3 inline-flex items-center justify-center gap-1.5 rounded-2xl py-2 text-sm font-extrabold text-white transition-[filter] group-hover:brightness-105" style={{ background: look.color }}>
            Responder <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : p.answered ? (
          <span className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full bg-accent-light px-2.5 py-1 text-xs font-extrabold text-accent-dark">
            <CheckCircleIcon size={15} weight="fill" /> Respondido
          </span>
        ) : null}
        <span className="flex items-center gap-3 border-t border-line pt-3 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-1"><Vis size={14} /> {ago(p.updatedAt)}</span>
          {p.access !== 'view' && <span className="inline-flex items-center gap-1"><ChatCircleTextIcon size={14} /> {p.count === 1 ? '1 resposta' : `${p.count} respostas`}</span>}
        </span>
      </Link>
    </li>
  )
}

function Section({ title, hint, polls }: { title: string; hint?: string; polls: PollSummary[] }) {
  if (!polls.length) return null
  return (
    <section className="mb-7">
      <h2 className="font-black text-ink">{title}</h2>
      {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      <ul className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">{polls.map((p, i) => <Card key={p.id} p={p} i={i} />)}</ul>
    </section>
  )
}

function CreateDialog({ orgId, orgName, onClose, initial }: { orgId?: string; orgName?: string; onClose: () => void; initial?: PollType }) {
  const router = useRouter()
  const { showToast } = useApp()
  const [type, setType] = useState<PollType | null>(initial ?? null)
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<ShareVisibility>(orgId ? 'org' : 'private')
  const [busy, setBusy] = useState<'blank' | 'sample' | null>(null)

  const create = async (sample: boolean, t = type) => {
    if (!t) return
    setBusy(sample ? 'sample' : 'blank')
    try {
      const { id } = await api<{ id: string }>('/api/inqueritos', { body: { type: t, title: sample && !title.trim() ? undefined : title, visibility, orgId, sample } })
      router.push(`/inqueritos/${id}`)
    } catch (err) {
      showToast(errorText(err, 'Não foi possível criar o inquérito. Tenta outra vez.'), 'danger')
      setBusy(null)
    }
  }

  const options: { v: ShareVisibility; icon: typeof LockIcon; title: string; text: string }[] = orgId
    ? [
        { v: 'org', icon: UsersThreeIcon, title: 'Toda a empresa', text: `Todos em ${orgName ?? 'na empresa'} podem responder.` },
        { v: 'private', icon: LockIcon, title: 'Só convidados', text: 'Só quem convidares (e os administradores).' },
      ]
    : [
        { v: 'private', icon: LockIcon, title: 'Só convidados', text: 'Só quem convidares, ou com senha.' },
        { v: 'link', icon: GlobeIcon, title: 'Qualquer pessoa com o link', text: 'Respondem mesmo sem conta na Udacha.' },
      ]

  return (
    <Modal title={type ? `Novo: ${TYPE_INFO[type].name}` : 'O que queres criar?'} onClose={onClose} wide
      footer={type ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button className="btn btn-primary flex-1" disabled={!!busy || !title.trim()} onClick={() => create(false)}><Busy busy={busy === 'blank'} text="A criar…">Criar</Busy></button>
          <button className="btn btn-ghost flex-1" disabled={!!busy} onClick={() => create(true)}><Busy busy={busy === 'sample'} text="A criar…"><SparkleIcon size={16} /> Usar o exemplo</Busy></button>
        </div>
      ) : undefined}>
      {!type ? (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {POLL_TYPES.map((t, i) => {
            const look = TYPE_LOOK[t]
            const info = TYPE_INFO[t]
            return (
              <li key={t} className="animate-dg-rise" style={{ animationDelay: `${i * 45}ms` }}>
                <button onClick={() => setType(t)}
                  className="group flex h-full w-full flex-col items-start rounded-3xl border-2 border-line p-4 text-left transition-[transform,border-color,background] duration-200 hover:-translate-y-0.5 hover:bg-snow active:scale-[0.98] cursor-pointer"
                  onMouseEnter={e => (e.currentTarget.style.borderColor = look.color)} onMouseLeave={e => (e.currentTarget.style.borderColor = '')}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ background: look.light, color: look.color }}>
                    <look.icon size={26} weight="duotone" />
                  </span>
                  <span className="mt-3 text-lg font-black text-ink">{info.name}</span>
                  <span className="mt-0.5 text-sm font-semibold leading-relaxed text-body">{info.text}</span>
                  <span className="mt-2 text-xs font-semibold italic text-muted">«{info.example}»</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="animate-dg-rise">
          <button className="mb-3 text-sm font-extrabold text-muted hover:text-ink cursor-pointer" onClick={() => setType(null)}>← Outro tipo</button>
          <div className="mb-4 flex items-center gap-3 rounded-2xl p-3" style={{ background: TYPE_LOOK[type].light }}>
            {(() => { const L = TYPE_LOOK[type]; return <L.icon size={28} weight="duotone" style={{ color: L.color }} /> })()}
            <p className="text-sm font-bold text-body">{TYPE_INFO[type].text}</p>
          </div>
          <label className="label" htmlFor="poll-title">Nome</label>
          <input id="poll-title" className="input" autoFocus maxLength={120} value={title} placeholder={`Ex.: ${TYPE_INFO[type].example}`}
            onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) create(false) }} />
          <p className="label mt-4">Quem responde</p>
          <div className="space-y-2">
            {options.map(o => (
              <button key={o.v} onClick={() => setVisibility(o.v)} aria-pressed={visibility === o.v}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left cursor-pointer ${visibility === o.v ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}>
                <o.icon size={22} className={visibility === o.v ? 'text-brand' : 'text-muted'} />
                <span>
                  <span className="block font-black text-ink">{o.title}</span>
                  <span className="block text-sm font-semibold text-muted">{o.text}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-muted">Começa como rascunho: preparas as perguntas com calma e publicas quando estiver pronto.</p>
        </div>
      )}
    </Modal>
  )
}

export default function PollsPage() {
  // no espaço da empresa, criar pode estar reservado a algumas pessoas (Definições → Permissões)
  const canCreate = useCan('inqueritos')
  const org = useOrg()
  const [polls, setPolls] = useState<PollSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setPolls((await api<{ polls: PollSummary[] }>('/api/inqueritos')).polls)
    } catch (err) {
      setError(errorText(err, 'Não foi possível carregar os inquéritos.'))
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
  }, [load])

  const all = polls ?? []
  const todo = all.filter(p => p.status === 'open' && !p.answered && p.access === 'view')
  const rest = all.filter(p => !todo.includes(p))
  const orgPolls = org ? rest.filter(p => p.orgId === org.org.id) : []
  const mine = rest.filter(p => !p.orgId && p.mine)
  const shared = rest.filter(p => !p.mine && (!p.orgId || p.orgId !== org?.org.id))

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Inquéritos</h1>
          <p className="text-sm font-bold text-muted">Votações, eleições, formulários, concursos, ideias e datas, tudo num só sítio</p>
        </div>
        {canCreate && <button onClick={() => setCreating(true)} className="btn btn-primary shrink-0 px-4 py-2.5"><PlusIcon size={18} /> <span className="max-sm:hidden">Novo inquérito</span></button>}
      </header>

      <CreateLocked feature="inqueritos" />

      {error && !polls && <p className="rounded-2xl bg-danger-light p-4 font-bold text-danger-dark">{error}</p>}
      {!polls && !error && <CardGridSkeleton count={6} height={140} />}

      {polls && all.length === 0 && (
        <div className="mb-8 flex flex-col items-center rounded-3xl bg-snow px-6 py-10 text-center">
          <Mascot size={96} />
          <h2 className="mt-3 text-xl font-black text-ink">Ainda não há inquéritos</h2>
          <p className="mt-1 max-w-md font-semibold text-muted">Pergunta à equipa onde fazer o jantar, elege um representante, recolhe pedidos com um formulário ou encontra o melhor dia para a reunião.</p>
          {canCreate && <button onClick={() => setCreating(true)} className="btn btn-primary mt-5"><PlusIcon size={18} /> Novo inquérito</button>}
        </div>
      )}

      {todo.length > 0 && (
        <section className="mb-7 rounded-3xl bg-brand-light/50 p-4">
          <h2 className="flex items-center gap-2 font-black text-ink"><EyeIcon size={18} className="text-brand" /> À espera da tua resposta</h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">{todo.map((p, i) => <Card key={p.id} p={p} i={i} />)}</ul>
        </section>
      )}
      {org && <Section title={`Inquéritos de ${org.org.name}`} hint="Os colegas vêem-nos aqui, salvo os privados." polls={orgPolls} />}
      <Section title="Os meus inquéritos" hint={org ? 'Inquéritos pessoais, fora da empresa.' : undefined} polls={mine} />
      <Section title="Partilhados comigo" polls={shared} />

      {creating && <CreateDialog orgId={org?.org.id} orgName={org?.org.name} onClose={() => setCreating(false)} />}
    </div>
  )
}
