'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { CheckIcon, EyeIcon, GlobeIcon, LockIcon, PlusIcon, UsersThreeIcon } from '@phosphor-icons/react'
import Modal from '../components/ui/Modal'
import Mascot from '../components/ui/Mascot'
import { api, errorText } from '../lib/api'
import { BOARD_COLORS, BOARD_IMAGES, boardBackground } from '../lib/boards'
import { useAccount } from '../context/AccountContext'
import { useApp } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import type { BoardSummary, ShareVisibility } from '../types'
import { CardGridSkeleton, Sk } from '../components/ui/Skeleton'
import { Busy } from '../components/ui/Spinner'

const VIS_ICON = { org: UsersThreeIcon, link: GlobeIcon, private: LockIcon }

function BoardTile({ b }: { b: BoardSummary }) {
  const Icon = VIS_ICON[b.visibility]
  return (
    <Link href={`/quadros/${b.id}`} className="group flex h-28 flex-col justify-between rounded-2xl p-3 text-white transition-transform hover:-translate-y-0.5"
      style={{ background: boardBackground(b.color, b.background, true) }}>
      <span className="flex items-start gap-2">
        <span className="line-clamp-2 flex-1 text-[17px] font-black leading-tight [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">{b.title}</span>
        {b.fresh && <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-danger px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />Novo</span>}
      </span>
      <span className="flex items-center gap-2 text-xs font-extrabold text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
        <Icon size={14} />
        <span className="truncate">{b.cards} cart{b.cards === 1 ? 'ão' : 'ões'}{!b.mine && b.ownerName ? ` · ${b.ownerName}` : ''}</span>
        {b.access === 'view' && <EyeIcon size={14} className="ml-auto" aria-label="Só ver" />}
      </span>
    </Link>
  )
}

function Section({ title, hint, boards, onNew }: { title: string; hint?: string; boards: BoardSummary[]; onNew?: () => void }) {
  if (!boards.length && !onNew) return null
  return (
    <section className="mb-8">
      <h2 className="font-black text-ink">{title}</h2>
      {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {boards.map(b => <BoardTile key={b.id} b={b} />)}
        {onNew && (
          <button onClick={onNew} className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-snow text-sm font-extrabold text-muted hover:border-brand/40 hover:text-brand cursor-pointer">
            <PlusIcon size={22} /> Criar quadro
          </button>
        )}
      </div>
    </section>
  )
}

function CreateDialog({ orgId, orgName, onClose }: { orgId?: string; orgName?: string; onClose: () => void }) {
  const router = useRouter()
  const { showToast } = useApp()
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(BOARD_COLORS[0])
  const [background, setBackground] = useState<string | null>(null)
  const [bgView, setBgView] = useState<'photos' | 'colors'>('photos')
  const [visibility, setVisibility] = useState<ShareVisibility>(orgId ? 'org' : 'private')
  const [busy, setBusy] = useState(false)
  const options: { v: ShareVisibility; icon: typeof LockIcon; title: string; text: string }[] = orgId
    ? [
        { v: 'org', icon: UsersThreeIcon, title: 'Toda a empresa', text: `Todos em ${orgName ?? 'na empresa'} vêem e editam.` },
        { v: 'private', icon: LockIcon, title: 'Privado', text: 'Só tu, os administradores e quem convidares.' },
      ]
    : [
        { v: 'private', icon: LockIcon, title: 'Privado', text: 'Só quem convidares, ou com senha.' },
        { v: 'link', icon: GlobeIcon, title: 'Público com link', text: 'Qualquer pessoa com o link vê, mesmo sem conta.' },
      ]

  const create = async () => {
    setBusy(true)
    try {
      const { id } = await api<{ id: string }>('/api/quadros', { body: { title, color, background, visibility, orgId } })
      router.push(`/quadros/${id}`)
    } catch (err) {
      showToast(errorText(err, 'Não foi possível criar o quadro. Tenta outra vez.'), 'danger')
      setBusy(false)
    }
  }

  return (
    <Modal title="Novo quadro" onClose={onClose}
      footer={<button className="btn btn-primary w-full" disabled={busy || !title.trim()} onClick={create}><Busy busy={busy} text="A criar…">Criar quadro</Busy></button>}>
      <div className="mb-4 flex h-24 items-end rounded-2xl p-3" style={{ background: boardBackground(color, background ?? undefined, true) }}>
        <span className="truncate text-lg font-black text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">{title || 'Nome do quadro'}</span>
      </div>
      <label className="label" htmlFor="board-title">Nome</label>
      <input id="board-title" className="input" autoFocus maxLength={80} value={title} placeholder="Ex.: Lançamento do site"
        onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) create() }} />
      <div className="mt-4 flex items-center gap-1">
        <p className="label mb-0 flex-1">Fundo</p>
        {(['photos', 'colors'] as const).map(v => (
          <button key={v} onClick={() => setBgView(v)} aria-pressed={bgView === v}
            className={`rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer ${bgView === v ? 'bg-brand-light text-brand-dark' : 'text-muted hover:bg-snow'}`}>
            {v === 'photos' ? 'Fotos' : 'Cores'}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {bgView === 'photos'
          ? BOARD_IMAGES.map(img => (
              <button key={img.id} onClick={() => setBackground(img.id)} aria-label={img.label} title={img.label}
                className={`flex h-11 items-center justify-center rounded-lg text-white ring-2 cursor-pointer ${background === img.id ? 'ring-brand' : 'ring-transparent'}`}
                style={{ background: boardBackground('', img.id, true) }}>
                {background === img.id && <span className="rounded-full bg-black/40 p-0.5"><CheckIcon size={14} weight="bold" /></span>}
              </button>
            ))
          : BOARD_COLORS.map(c => (
              <button key={c} onClick={() => { setColor(c); setBackground(null) }} aria-label={`Cor ${c}`}
                className={`flex h-11 items-center justify-center rounded-lg text-white ring-2 cursor-pointer ${!background && color === c ? 'ring-brand' : 'ring-transparent'}`}
                style={{ background: boardBackground(c) }}>
                {!background && color === c && <CheckIcon size={16} weight="bold" />}
              </button>
            ))}
      </div>
      <p className="label mt-4">Visibilidade</p>
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
      <p className="mt-3 text-xs font-semibold text-muted">Podes mudar isto depois em Partilhar.</p>
    </Modal>
  )
}

export default function BoardsPage() {
  const { user } = useAccount()
  const org = useOrg()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setBoards((await api<{ boards: BoardSummary[] }>('/api/quadros')).boards)
    } catch (err) {
      setError(errorText(err, 'Não foi possível carregar os quadros.'))
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
  }, [load])

  const orgBoards = org ? (boards ?? []).filter(b => b.orgId === org.org.id) : []
  const mine = (boards ?? []).filter(b => !b.orgId && b.mine)
  const shared = (boards ?? []).filter(b => !b.mine && (!b.orgId || b.orgId !== org?.org.id))

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Quadros</h1>
          <p className="text-sm font-bold text-muted">
            {org ? 'Organiza o trabalho em listas e cartões, com a equipa ou com quem quiseres' : 'Organiza ideias e projectos em listas e cartões, e partilha-os'}
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary shrink-0 px-4 py-2.5"><PlusIcon size={18} /> <span className="max-sm:hidden">Novo quadro</span></button>
      </header>

      {error && !boards && <p className="rounded-2xl bg-danger-light p-4 font-bold text-danger-dark">{error}</p>}
      {!boards && !error && <><Sk className="mb-3 h-5 w-48" /><CardGridSkeleton count={4} /></>}

      {boards && (
        <>
          {boards.length === 0 && (
            <div className="mb-8 flex flex-col items-center rounded-3xl bg-snow px-6 py-10 text-center">
              <Mascot size={96} />
              <h2 className="mt-3 text-xl font-black text-ink">Ainda não tens quadros</h2>
              <p className="mt-1 max-w-sm font-semibold text-muted">Cria um quadro com listas como “A fazer”, “Em curso” e “Concluído” e arrasta os cartões à medida que avanças.</p>
            </div>
          )}
          {org && (
            <Section title={`Quadros de ${org.org.name}`} hint="Os quadros da empresa: os colegas vêem-nos aqui, salvo os privados."
              boards={orgBoards} onNew={() => setCreating(true)} />
          )}
          {(!org || mine.length > 0) && (
            <Section title="Os meus quadros" hint={org ? 'Quadros pessoais, fora da empresa.' : undefined} boards={mine} onNew={org ? undefined : () => setCreating(true)} />
          )}
          <Section title="Partilhados comigo" boards={shared} />
        </>
      )}

      {creating && user && <CreateDialog orgId={org?.org.id} orgName={org?.org.name} onClose={() => setCreating(false)} />}
    </div>
  )
}
