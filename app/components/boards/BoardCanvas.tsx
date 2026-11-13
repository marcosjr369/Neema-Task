'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatCircleIcon, CheckSquareIcon, ClockIcon, DotsThreeIcon, PencilSimpleIcon, PlusIcon, PushPinIcon, TextAlignLeftIcon, XIcon } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import { CardMenu, ListMenu } from './Menus'
import { DUE_STYLE } from './CardDialog'
import { cardsOf, dueState, shortDate, shownLists } from '../../lib/boards'
import type { BoardCard, BoardList, BoardPerson, BoardView } from '../../types'
import type { RunOp } from './useBoard'

type Drag = { kind: 'card' | 'list'; id: string } | null
type Drop = { listId: string; index: number } | null

type CanvasProps = {
  board: BoardView
  people: BoardPerson[]
  run: RunOp
  readOnly: boolean
  onOpenCard: (id: string) => void
  onCopyLink?: (id: string) => void
}

/* ─── Cartão ──────────────────────────────────────────────────────────── */

function CardTile({ board, card, people, readOnly, dragging, onOpen, onQuick, onDragStart, onDragOverCard }: {
  board: BoardView
  card: BoardCard
  people: BoardPerson[]
  readOnly: boolean
  dragging: boolean
  onOpen: () => void
  onQuick: (rect: DOMRect) => void
  onDragStart: () => void
  onDragOverCard: (after: boolean) => void
}) {
  const labels = board.labels.filter(l => card.labelIds.includes(l.id))
  const members = card.memberIds.map(id => people.find(p => p.userId === id)).filter((p): p is BoardPerson => !!p)
  const checklist = card.checklist ?? []
  const done = checklist.filter(i => i.done).length
  const due = dueState(card)
  const comments = card.comments?.length ?? 0

  return (
    <div
      draggable={!readOnly}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', card.id)
        onDragStart()
      }}
      onDragOver={e => {
        const r = e.currentTarget.getBoundingClientRect()
        onDragOverCard(e.clientY > r.top + r.height / 2)
      }}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      role="button"
      tabIndex={0}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-b-4 border-line bg-white text-left transition-opacity hover:border-brand/40 focus-visible:border-brand focus-visible:outline-none ${dragging ? 'opacity-40' : ''}`}
    >
      {card.cover && <div className="h-8" style={{ background: card.cover }} />}
      <div className="px-3 py-2">
        {labels.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {labels.map(l => (
              <span key={l.id} title={l.name || undefined} className="h-2 min-w-10 rounded-full px-0 text-[0px] data-[named=true]:h-auto data-[named=true]:px-2 data-[named=true]:py-0.5 data-[named=true]:text-[11px] data-[named=true]:font-black data-[named=true]:text-white"
                data-named={!!l.name} style={{ background: l.color }}>{l.name}</span>
            ))}
          </div>
        )}
        <p className="break-words pr-6 text-[14px] font-bold leading-snug text-ink">{card.title}</p>
        {(due || card.description || checklist.length > 0 || comments > 0 || members.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-extrabold text-muted">
            {due && card.due && (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ background: DUE_STYLE[due].bg, color: DUE_STYLE[due].fg }}>
                <ClockIcon size={13} /> {shortDate(card.due)}
              </span>
            )}
            {card.description && <span title="Tem descrição"><TextAlignLeftIcon size={14} /></span>}
            {comments > 0 && <span className="inline-flex items-center gap-0.5"><ChatCircleIcon size={14} /> {comments}</span>}
            {checklist.length > 0 && (
              <span className={`inline-flex items-center gap-0.5 rounded-md px-1 ${done === checklist.length ? 'bg-accent text-white' : ''}`}>
                <CheckSquareIcon size={14} /> {done}/{checklist.length}
              </span>
            )}
            {members.length > 0 && (
              <span className="ml-auto flex -space-x-1.5">
                {members.slice(0, 4).map(m => <span key={m.userId} title={m.name} className="rounded-full ring-2 ring-white"><Avatar name={m.name} picture={m.picture} size={24} /></span>)}
                {members.length > 4 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-snow text-[10px] font-black text-body ring-2 ring-white">+{members.length - 4}</span>}
              </span>
            )}
          </div>
        )}
      </div>
      {!readOnly && (
        <button
          onClick={e => { e.stopPropagation(); onQuick(e.currentTarget.getBoundingClientRect()) }}
          aria-label="Acções do cartão"
          className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-muted opacity-0 shadow-sm transition-opacity hover:bg-snow hover:text-ink group-hover:opacity-100 focus:opacity-100 max-lg:opacity-100 cursor-pointer"
          style={card.cover ? { top: 38 } : undefined}
        >
          <PencilSimpleIcon size={14} />
        </button>
      )}
    </div>
  )
}

/* ─── Compositor (adicionar cartão / lista) ───────────────────────────── */

function Composer({ placeholder, button, onAdd, onCancel, multiline }: {
  placeholder: string; button: string; onAdd: (t: string) => void; onCancel: () => void; multiline?: boolean
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const submit = () => {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
    ref.current?.focus()
  }
  const common = {
    ref,
    value,
    placeholder,
    maxLength: 200,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setValue(e.target.value.replace(/\n/g, '')),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); submit() }
      if (e.key === 'Escape') onCancel()
    },
    className: 'w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-[14px] font-semibold text-ink outline-none focus:border-accent',
  }
  return (
    <div className="space-y-2">
      {multiline ? <textarea rows={2} {...common} /> : <input {...common} />}
      <div className="flex items-center gap-1">
        <button onClick={submit} className="btn btn-primary px-4 py-2 text-xs">{button}</button>
        <button onClick={onCancel} aria-label="Cancelar" className="rounded-lg p-2 text-muted hover:bg-white cursor-pointer"><XIcon size={18} /></button>
      </div>
    </div>
  )
}

/* ─── Lista ───────────────────────────────────────────────────────────── */

function ListColumn({ list, cards, canvas, drag, setDrag, drop, setDrop, onDropHere }: {
  list: BoardList
  cards: BoardCard[]
  canvas: CanvasProps
  drag: Drag
  setDrag: (d: Drag) => void
  drop: Drop
  setDrop: (d: Drop) => void
  onDropHere: () => void
}) {
  const { board, people, run, readOnly, onOpenCard, onCopyLink } = canvas
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [quick, setQuick] = useState<{ id: string; rect: DOMRect } | null>(null)
  const [adding, setAdding] = useState<'top' | 'bottom' | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(list.title)
  const bodyRef = useRef<HTMLDivElement>(null)

  const indicator = drag?.kind === 'card' && drop?.listId === list.id ? drop.index : null
  const quickCard = quick ? board.cards.find(c => c.id === quick.id) : undefined

  const line = <div className="h-1 rounded-full bg-brand" />

  return (
    <section
      className={`flex max-h-full w-[272px] shrink-0 flex-col rounded-2xl bg-snow/95 shadow-sm ${drag?.kind === 'list' && drag.id === list.id ? 'opacity-40' : ''}`}
      style={list.color ? { boxShadow: `inset 0 4px 0 ${list.color}` } : undefined}
      onDragOver={e => {
        if (!drag) return
        e.preventDefault()
        if (drag.kind === 'list') {
          const r = e.currentTarget.getBoundingClientRect()
          setDrop({ listId: list.id, index: e.clientX > r.left + r.width / 2 ? 1 : 0 })
        }
      }}
      onDrop={e => { e.preventDefault(); onDropHere() }}
      aria-label={list.title}
    >
      <header
        draggable={!readOnly && !renaming}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', list.id); setDrag({ kind: 'list', id: list.id }) }}
        onDragEnd={() => { setDrag(null); setDrop(null) }}
        className="flex items-center gap-1 px-2 pb-1 pt-3"
      >
        {list.pinned && <PushPinIcon size={14} weight="fill" className="ml-1 shrink-0 text-brand" aria-label="Lista fixada" />}
        {renaming ? (
          <input
            className="min-w-0 flex-1 rounded-lg border-2 border-accent bg-white px-2 py-1 text-[15px] font-black text-ink outline-none"
            value={title}
            autoFocus
            maxLength={200}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => {
              setRenaming(false)
              if (title.trim() && title.trim() !== list.title) run({ type: 'list.update', listId: list.id, title })
              else setTitle(list.title)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') { setTitle(list.title); setRenaming(false) }
            }}
          />
        ) : (
          <h2
            className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-[15px] font-black text-ink ${readOnly ? '' : 'cursor-text hover:bg-white'}`}
            onClick={() => { if (!readOnly) { setTitle(list.title); setRenaming(true) } }}
          >
            {list.title}
          </h2>
        )}
        <span className="rounded-md px-1.5 text-xs font-black text-muted">{cards.length}</span>
        {!readOnly && (
          <button onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} aria-label={`Acções da lista ${list.title}`}
            className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-ink cursor-pointer">
            <DotsThreeIcon size={20} weight="bold" />
          </button>
        )}
      </header>

      <div
        ref={bodyRef}
        className="flex min-h-2 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-1 pt-1"
        onDragOver={e => {
          if (drag?.kind !== 'card') return
          e.preventDefault()
          // por baixo do último cartão: vai para o fim
          if (e.target === e.currentTarget) setDrop({ listId: list.id, index: cards.filter(c => c.id !== drag.id).length })
        }}
      >
        {adding === 'top' && (
          <Composer placeholder="Título do cartão" button="Adicionar" multiline
            onAdd={t => run({ type: 'card.add', listId: list.id, title: t, top: true })} onCancel={() => setAdding(null)} />
        )}
        {(() => {
          const visible = cards.filter(c => c.id !== drag?.id)
          return cards.map(card => {
            const idx = visible.indexOf(card)
            return (
              <div key={card.id} className="flex flex-col gap-2">
                {indicator !== null && idx === indicator && line}
                <CardTile
                  board={board}
                  card={card}
                  people={people}
                  readOnly={readOnly}
                  dragging={drag?.kind === 'card' && drag.id === card.id}
                  onOpen={() => onOpenCard(card.id)}
                  onQuick={rect => setQuick({ id: card.id, rect })}
                  onDragStart={() => setDrag({ kind: 'card', id: card.id })}
                  onDragOverCard={after => {
                    if (drag?.kind !== 'card' || card.id === drag.id) return
                    setDrop({ listId: list.id, index: idx + (after ? 1 : 0) })
                  }}
                />
              </div>
            )
          })
        })()}
        {indicator !== null && indicator >= cards.filter(c => c.id !== drag?.id).length && line}
      </div>

      {!readOnly && (
        <div className="px-2 pb-2 pt-1">
          {adding === 'bottom' ? (
            <Composer placeholder="Título do cartão" button="Adicionar" multiline
              onAdd={t => {
                run({ type: 'card.add', listId: list.id, title: t })
                setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }), 50)
              }}
              onCancel={() => setAdding(null)} />
          ) : (
            <button onClick={() => setAdding('bottom')} className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-muted hover:bg-white hover:text-ink cursor-pointer">
              <PlusIcon size={16} /> Adicionar cartão
            </button>
          )}
        </div>
      )}

      {menu && (
        <ListMenu board={board} list={list} run={run} anchor={menu} onClose={() => setMenu(null)} onAddCard={() => setAdding('top')} />
      )}
      {quick && quickCard && (
        <CardMenu
          board={board}
          card={quickCard}
          people={people}
          run={run}
          anchor={quick.rect}
          onClose={() => setQuick(null)}
          onOpen={() => { setQuick(null); onOpenCard(quickCard.id) }}
          onCopyLink={() => onCopyLink?.(quickCard.id)}
        />
      )}
    </section>
  )
}

/* ─── Quadro ──────────────────────────────────────────────────────────── */

export default function BoardCanvas(props: CanvasProps) {
  const { board, run, readOnly } = props
  const [drag, setDrag] = useState<Drag>(null)
  const [drop, setDrop] = useState<Drop>(null)
  const [addingList, setAddingList] = useState(false)
  const lists = shownLists(board)

  const finish = () => {
    if (drag && drop) {
      if (drag.kind === 'card') {
        const card = board.cards.find(c => c.id === drag.id)
        // largado no sítio onde já estava: nada a fazer
        const same = card?.listId === drop.listId && cardsOf(board, card.listId).findIndex(c => c.id === card.id) === drop.index
        if (card && !same) run({ type: 'card.move', cardId: card.id, listId: drop.listId, index: drop.index })
      } else if (drop.listId !== drag.id) {
        // posição entre as listas abertas (sem a que se move)
        const open = board.lists.filter(l => !l.archived && l.id !== drag.id)
        const target = open.findIndex(l => l.id === drop.listId)
        if (target >= 0) run({ type: 'list.move', listId: drag.id, index: target + drop.index })
      }
    }
    setDrag(null)
    setDrop(null)
  }

  return (
    <div
      className="flex h-full items-start gap-3 overflow-x-auto px-4 pb-4 pt-1 lg:px-6"
      onDragEnd={() => { setDrag(null); setDrop(null) }}
    >
      {lists.map(list => (
        <ListColumn
          key={list.id}
          list={list}
          cards={cardsOf(board, list.id)}
          canvas={props}
          drag={drag}
          setDrag={setDrag}
          drop={drop}
          setDrop={setDrop}
          onDropHere={finish}
        />
      ))}
      {!readOnly && (
        <div className="w-[272px] shrink-0">
          {addingList ? (
            <div className="rounded-2xl bg-snow p-2">
              <Composer placeholder="Nome da lista" button="Adicionar lista"
                onAdd={t => run({ type: 'list.add', title: t })} onCancel={() => setAddingList(false)} />
            </div>
          ) : (
            <button onClick={() => setAddingList(true)} className="flex w-full items-center gap-2 rounded-2xl bg-black/25 px-4 py-3 text-sm font-extrabold text-white backdrop-blur hover:bg-black/35 cursor-pointer">
              <PlusIcon size={18} /> Adicionar outra lista
            </button>
          )}
        </div>
      )}
      {lists.length === 0 && readOnly && <p className="rounded-2xl bg-white/80 px-4 py-3 font-bold text-body">Este quadro ainda não tem listas.</p>}
    </div>
  )
}
