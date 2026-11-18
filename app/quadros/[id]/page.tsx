'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArchiveIcon, ArrowCounterClockwiseIcon, CaretLeftIcon, DotsThreeIcon, EyeIcon, GlobeIcon, LockIcon, ShareNetworkIcon,
  SignOutIcon, TrashIcon, UsersThreeIcon,
} from '@phosphor-icons/react'
import { useBoard } from '../../components/boards/useBoard'
import BoardCanvas from '../../components/boards/BoardCanvas'
import CardDialog from '../../components/boards/CardDialog'
import ShareDialog from '../../components/boards/ShareDialog'
import Popover, { MenuDivider, MenuItem } from '../../components/boards/Popover'
import Modal from '../../components/ui/Modal'
import Avatar from '../../components/ui/Avatar'
import Mascot from '../../components/ui/Mascot'
import { api, errorText } from '../../lib/api'
import { boardBackground } from '../../lib/boards'
import BackgroundPicker, { BG_TITLES, type BgView } from '../../components/boards/BackgroundPicker'
import { useAccount } from '../../context/AccountContext'
import { useApp } from '../../context/AppContext'
import type { BoardView } from '../../types'
import { BoardSkeleton, Sk } from '../../components/ui/Skeleton'

function VisibilityBadge({ board, orgName }: { board: BoardView; orgName?: string }) {
  const v = board.sharing.visibility
  const [icon, text] =
    v === 'org' ? [<UsersThreeIcon key="i" size={14} />, orgName ?? 'Empresa'] : v === 'link' ? [<GlobeIcon key="i" size={14} />, 'Público com link'] : [<LockIcon key="i" size={14} />, 'Privado']
  return <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-extrabold text-white">{icon}{text}</span>
}

function ArchiveDialog({ board, onClose, onOpenCard, run }: {
  board: BoardView
  onClose: () => void
  onOpenCard: (id: string) => void
  run: ReturnType<typeof useBoard>['run']
}) {
  const lists = board.lists.filter(l => l.archived)
  const cards = board.cards.filter(c => c.archived || board.lists.find(l => l.id === c.listId)?.archived)
  const archivedCards = cards.filter(c => c.archived)
  return (
    <Modal title="Arquivo" onClose={onClose}>
      <p className="label">Listas</p>
      {lists.length === 0 ? <p className="mb-5 text-sm font-semibold text-muted">Nenhuma lista arquivada.</p> : (
        <ul className="mb-5 divide-y-2 divide-line">
          {lists.map(l => (
            <li key={l.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 truncate font-bold text-ink">{l.title}</span>
              <button className="chip py-1 text-xs" onClick={() => run({ type: 'list.archive', listId: l.id, archived: false })}><ArrowCounterClockwiseIcon size={14} /> Restaurar</button>
              <button className="rounded-lg p-1.5 text-muted hover:bg-snow hover:text-danger cursor-pointer" aria-label={`Apagar ${l.title}`}
                onClick={() => { if (confirm(`Apagar a lista "${l.title}" e os seus cartões? Não dá para desfazer.`)) run({ type: 'list.delete', listId: l.id }) }}>
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="label">Cartões</p>
      {archivedCards.length === 0 ? <p className="text-sm font-semibold text-muted">Nenhum cartão arquivado.</p> : (
        <ul className="divide-y-2 divide-line">
          {archivedCards.map(c => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <button className="min-w-0 flex-1 truncate text-left font-bold text-ink hover:underline cursor-pointer" onClick={() => onOpenCard(c.id)}>{c.title}</button>
              <button className="chip py-1 text-xs" onClick={() => run({ type: 'card.archive', cardId: c.id, archived: false })}><ArrowCounterClockwiseIcon size={14} /> Restaurar</button>
              <button className="rounded-lg p-1.5 text-muted hover:bg-snow hover:text-danger cursor-pointer" aria-label={`Apagar ${c.title}`}
                onClick={() => { if (confirm('Apagar este cartão de vez?')) run({ type: 'card.delete', cardId: c.id }) }}>
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default function BoardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAccount()
  const { showToast } = useApp()
  const { data, error, load, run } = useBoard(id)
  // links directos: ?cartao=<id> abre o cartão; ?partilha=1 abre a partilha (pedidos de acesso)
  const [cardId, setCardId] = useState<string | null>(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('cartao')))
  const [share, setShare] = useState(() => typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('partilha'))
  const [archive, setArchive] = useState(false)
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [bg, setBg] = useState<BgView | null>(null)
  const [title, setTitle] = useState<string | null>(null)

  const setCard = (cid: string | null) => {
    setCardId(cid)
    const url = new URL(window.location.href)
    if (cid) url.searchParams.set('cartao', cid)
    else url.searchParams.delete('cartao')
    url.searchParams.delete('partilha')
    window.history.replaceState(null, '', url)
  }

  const copyCardLink = async (cid: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/quadros/${id}?cartao=${cid}`)
      showToast('Link do cartão copiado', 'success')
    } catch {
      showToast('Não consegui copiar o link', 'danger')
    }
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={100} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">{error.status === 403 ? 'Sem acesso' : error.status === 404 ? 'Quadro não encontrado' : 'Algo correu mal'}</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">{error.text}</p>
        <Link href="/quadros" className="btn btn-primary mt-6">Ver os meus quadros</Link>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex h-[calc(100dvh-84px)] flex-col gap-3 lg:h-dvh" style={{ background: boardBackground('#7B61FF') }}>
        <div className="flex items-center gap-3 px-4 pt-4 lg:px-6"><Sk light className="h-8 w-56" /><Sk light className="h-6 w-24" /></div>
        <div className="min-h-0 flex-1"><BoardSkeleton /></div>
      </div>
    )
  }

  const { board, access, people, orgName, requests } = data
  const readOnly = access === 'view'
  const card = cardId ? board.cards.find(c => c.id === cardId) : undefined
  const archived = board.lists.filter(l => l.archived).length + board.cards.filter(c => c.archived).length

  const leave = async () => {
    if (!confirm('Sair deste quadro? Deixas de o ver até alguém te convidar outra vez.')) return
    try {
      await api(`/api/quadros/${id}/share`, { method: 'DELETE' })
      router.replace('/quadros')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível sair do quadro. Tenta outra vez.'), 'danger')
    }
  }
  const remove = async () => {
    if (!confirm(`Apagar o quadro "${board.title}" com todas as listas e cartões? Não dá para desfazer.`)) return
    try {
      await api(`/api/quadros/${id}`, { method: 'DELETE' })
      showToast('Quadro apagado', 'success')
      router.replace('/quadros')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível apagar o quadro. Tenta outra vez.'), 'danger')
    }
  }

  return (
    <div className="flex h-[calc(100dvh-84px)] flex-col lg:h-dvh" style={{ background: boardBackground(board.color, board.background) }}>
      <header className={`flex flex-wrap items-center gap-2 px-4 py-3 lg:px-6 ${board.background ? 'mb-2 bg-black/30 backdrop-blur-sm' : ''}`}>
        <Link href="/quadros" aria-label="Voltar aos quadros" className="rounded-xl p-2 text-white hover:bg-white/20"><CaretLeftIcon size={20} /></Link>
        {title !== null && !readOnly ? (
          <input
            className="min-w-0 rounded-xl bg-white px-3 py-1.5 text-lg font-black text-ink outline-none"
            value={title}
            autoFocus
            maxLength={80}
            aria-label="Nome do quadro"
            onChange={e => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== board.title) run({ type: 'board.update', title })
              setTitle(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setTitle(null)
            }}
          />
        ) : (
          <h1
            className={`min-w-0 truncate rounded-xl px-2 py-1 text-xl font-black text-white ${readOnly ? '' : 'cursor-text hover:bg-white/20'}`}
            onClick={() => { if (!readOnly) setTitle(board.title) }}
          >
            {board.title}
          </h1>
        )}
        <VisibilityBadge board={board} orgName={orgName} />
        {readOnly && <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-extrabold text-white"><EyeIcon size={14} /> Só ver</span>}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden -space-x-2 sm:flex">
            {people.slice(0, 5).map(p => <span key={p.userId} title={p.name} className="rounded-full ring-2 ring-white/70"><Avatar name={p.name} picture={p.picture} size={30} /></span>)}
            {people.length > 5 && <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-xs font-black text-ink ring-2 ring-white/70">+{people.length - 5}</span>}
          </span>
          {access === 'owner' && (
            <button onClick={() => setShare(true)} className="relative inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-ink hover:bg-snow cursor-pointer">
              <ShareNetworkIcon size={16} /> Partilhar
              {requests > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-danger px-1.5 text-[11px] font-black text-white" aria-label={`${requests} pedidos de acesso`}>{requests}</span>}
            </button>
          )}
          <button onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} aria-label="Menu do quadro" className="rounded-xl bg-white/20 p-2 text-white hover:bg-white/30 cursor-pointer">
            <DotsThreeIcon size={20} weight="bold" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <BoardCanvas board={board} people={people} run={run} readOnly={readOnly} onOpenCard={setCard} onCopyLink={copyCardLink} />
      </div>

      {menu && bg && (
        <Popover anchor={menu} title={BG_TITLES[bg]} onClose={() => { setMenu(null); setBg(null) }} onBack={() => setBg(bg === 'home' ? null : 'home')} width={320}>
          <BackgroundPicker view={bg} setView={setBg} color={board.color} background={board.background}
            onPick={c => run({ type: 'board.update', background: c.background, ...(c.color ? { color: c.color } : {}) })} />
        </Popover>
      )}
      {menu && !bg && (
        <Popover anchor={menu} title="Menu" onClose={() => setMenu(null)}>
          {!readOnly && (
            <>
              <button onClick={() => setBg('home')} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] font-bold text-body hover:bg-snow cursor-pointer">
                <span className="h-6 w-8 shrink-0 rounded-md" style={{ background: boardBackground(board.color, board.background, true) }} />
                Mudar fundo
              </button>
              <MenuDivider />
            </>
          )}
          <MenuItem icon={<ArchiveIcon size={18} />} onClick={() => { setArchive(true); setMenu(null) }}>Itens arquivados{archived ? ` (${archived})` : ''}</MenuItem>
          {access === 'owner' && <MenuItem icon={<ShareNetworkIcon size={18} />} onClick={() => { setShare(true); setMenu(null) }}>Partilhar</MenuItem>}
          {access !== 'owner' && board.sharing.visibility !== 'org' && (
            <MenuItem icon={<SignOutIcon size={18} />} onClick={() => { setMenu(null); leave() }}>Sair do quadro</MenuItem>
          )}
          {access === 'owner' && (
            <>
              <MenuDivider />
              <MenuItem danger icon={<TrashIcon size={18} />} onClick={() => { setMenu(null); remove() }}>Apagar quadro</MenuItem>
            </>
          )}
        </Popover>
      )}

      {archive && <ArchiveDialog board={board} run={run} onClose={() => setArchive(false)} onOpenCard={cid => { setArchive(false); setCard(cid) }} />}
      {share && <ShareDialog endpoint={`/api/quadros/${id}/share`} isOrg={!!board.orgId} orgName={orgName} onClose={() => setShare(false)} onChanged={load} />}
      {card && (
        <CardDialog
          key={card.id}
          board={board}
          card={card}
          people={people}
          run={run}
          readOnly={readOnly}
          userId={user?.id}
          moderator={access === 'owner'}
          onClose={() => setCard(null)}
          onCopyLink={() => copyCardLink(card.id)}
        />
      )}
    </div>
  )
}
