'use client'

import { useState } from 'react'
import { CheckIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import { LABEL_COLORS, cardsOf, shownLists } from '../../lib/boards'
import type { BoardCard, BoardPerson, BoardView } from '../../types'
import type { RunOp } from './useBoard'

type Props = { board: BoardView; card: BoardCard; run: RunOp; onDone?: () => void }

/* ─── Etiquetas ───────────────────────────────────────────────────────── */

export function LabelsPanel({ board, card, run }: Props) {
  const [editing, setEditing] = useState<{ id?: string; name: string; color: string } | null>(null)

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="h-8 rounded-lg" style={{ background: editing.color }} />
        <div>
          <label className="label" htmlFor="label-name">Nome</label>
          <input id="label-name" className="input py-2" maxLength={40} value={editing.name} autoFocus
            onChange={e => setEditing({ ...editing, name: e.target.value })} />
        </div>
        <div>
          <p className="label">Cor</p>
          <div className="grid grid-cols-5 gap-2">
            {LABEL_COLORS.map(c => (
              <button key={c} onClick={() => setEditing({ ...editing, color: c })} aria-label={`Cor ${c}`}
                className="flex h-8 items-center justify-center rounded-lg text-white cursor-pointer" style={{ background: c }}>
                {editing.color === c && <CheckIcon size={16} weight="bold" />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1 py-2 text-sm" onClick={() => {
            if (editing.id) run({ type: 'label.update', labelId: editing.id, name: editing.name, color: editing.color })
            else run({ type: 'label.add', name: editing.name, color: editing.color })
            setEditing(null)
          }}>{editing.id ? 'Guardar' : 'Criar'}</button>
          {editing.id && (
            <button className="btn btn-danger py-2 text-sm" aria-label="Apagar etiqueta" onClick={() => {
              run({ type: 'label.delete', labelId: editing.id! })
              setEditing(null)
            }}><TrashIcon size={16} /></button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {board.labels.map(l => {
        const on = card.labelIds.includes(l.id)
        return (
          <div key={l.id} className="flex items-center gap-2">
            <button
              onClick={() => run({ type: 'card.update', cardId: card.id, patch: { labelIds: on ? card.labelIds.filter(x => x !== l.id) : [...card.labelIds, l.id] } })}
              className="flex flex-1 items-center gap-2 cursor-pointer"
              aria-pressed={on}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${on ? 'border-brand bg-brand text-white' : 'border-line'}`}>
                {on && <CheckIcon size={12} weight="bold" />}
              </span>
              <span className="h-8 flex-1 truncate rounded-lg px-3 text-left text-sm font-extrabold leading-8 text-white" style={{ background: l.color }}>{l.name}</span>
            </button>
            <button onClick={() => setEditing({ id: l.id, name: l.name, color: l.color })} aria-label="Editar etiqueta" className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer">
              <PencilSimpleIcon size={16} />
            </button>
          </div>
        )
      })}
      <button onClick={() => setEditing({ name: '', color: LABEL_COLORS[0] })} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-snow py-2 text-sm font-extrabold text-body hover:bg-line cursor-pointer">
        <PlusIcon size={16} /> Criar etiqueta
      </button>
    </div>
  )
}

/* ─── Membros ─────────────────────────────────────────────────────────── */

export function MembersPanel({ card, run, people }: Props & { people: BoardPerson[] }) {
  const [q, setQ] = useState('')
  const shown = people.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="space-y-2">
      {people.length > 6 && <input className="input py-2" placeholder="Procurar pessoas" value={q} onChange={e => setQ(e.target.value)} autoFocus />}
      {people.length === 0 && <p className="text-sm font-semibold text-muted">Partilha o quadro com alguém para o poderes juntar aos cartões.</p>}
      <ul className="space-y-1">
        {shown.map(p => {
          const on = card.memberIds.includes(p.userId)
          return (
            <li key={p.userId}>
              <button
                onClick={() => run({ type: 'card.update', cardId: card.id, patch: { memberIds: on ? card.memberIds.filter(x => x !== p.userId) : [...card.memberIds, p.userId] } })}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-snow cursor-pointer"
                aria-pressed={on}
              >
                <Avatar name={p.name} picture={p.picture} size={30} />
                <span className="flex-1 truncate text-left text-sm font-bold text-ink">{p.name}</span>
                {on && <CheckIcon size={16} className="text-brand" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ─── Datas ───────────────────────────────────────────────────────────── */

export function DatesPanel({ card, run, onDone }: Props) {
  const [start, setStart] = useState(card.start ?? '')
  const [due, setDue] = useState(card.due ?? '')
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="card-start">Início</label>
        <input id="card-start" type="date" className="input py-2" value={start} max={due || undefined} onChange={e => setStart(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="card-due">Entrega</label>
        <input id="card-due" type="date" className="input py-2" value={due} min={start || undefined} onChange={e => setDue(e.target.value)} />
      </div>
      <button className="btn btn-primary w-full py-2 text-sm" onClick={() => {
        run({ type: 'card.update', cardId: card.id, patch: { start: start || null, due: due || null } })
        onDone?.()
      }}>Guardar</button>
      {(card.start || card.due) && (
        <button className="w-full rounded-xl py-2 text-sm font-extrabold text-muted hover:bg-snow cursor-pointer" onClick={() => {
          run({ type: 'card.update', cardId: card.id, patch: { start: null, due: null, dueDone: false } })
          onDone?.()
        }}>Remover datas</button>
      )}
    </div>
  )
}

/* ─── Capa ────────────────────────────────────────────────────────────── */

export function CoverPanel({ card, run }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {LABEL_COLORS.map(c => (
          <button key={c} onClick={() => run({ type: 'card.update', cardId: card.id, patch: { cover: c } })} aria-label={`Capa ${c}`}
            className="flex h-10 items-center justify-center rounded-lg text-white cursor-pointer" style={{ background: c }}>
            {card.cover === c && <CheckIcon size={16} weight="bold" />}
          </button>
        ))}
      </div>
      {card.cover && (
        <button className="w-full rounded-xl bg-snow py-2 text-sm font-extrabold text-body hover:bg-line cursor-pointer"
          onClick={() => run({ type: 'card.update', cardId: card.id, patch: { cover: null } })}>Remover capa</button>
      )}
    </div>
  )
}

/* ─── Mover / copiar ──────────────────────────────────────────────────── */

function ListAndPosition({ board, card, listId, setListId, index, setIndex }: {
  board: BoardView; card: BoardCard; listId: string; setListId: (id: string) => void; index: number; setIndex: (i: number) => void
}) {
  const others = cardsOf(board, listId).filter(c => c.id !== card.id)
  return (
    <>
      <div>
        <label className="label" htmlFor="move-list">Lista</label>
        <select id="move-list" className="input py-2" value={listId} onChange={e => {
          setListId(e.target.value)
          setIndex(cardsOf(board, e.target.value).filter(c => c.id !== card.id).length)
        }}>
          {shownLists(board).map(l => <option key={l.id} value={l.id}>{l.title}{l.id === card.listId ? ' (actual)' : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="move-pos">Posição</label>
        <select id="move-pos" className="input py-2" value={index} onChange={e => setIndex(Number(e.target.value))}>
          {Array.from({ length: others.length + 1 }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
        </select>
      </div>
    </>
  )
}

export function MovePanel({ board, card, run, onDone }: Props) {
  const [listId, setListId] = useState(card.listId)
  const [index, setIndex] = useState(() => Math.max(0, cardsOf(board, card.listId).findIndex(c => c.id === card.id)))
  return (
    <div className="space-y-3">
      <ListAndPosition {...{ board, card, listId, setListId, index, setIndex }} />
      <button className="btn btn-primary w-full py-2 text-sm" onClick={() => {
        run({ type: 'card.move', cardId: card.id, listId, index })
        onDone?.()
      }}>Mover</button>
    </div>
  )
}

export function CopyPanel({ board, card, run, onDone }: Props) {
  const [title, setTitle] = useState(card.title)
  const [listId, setListId] = useState(card.listId)
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="copy-title">Título</label>
        <textarea id="copy-title" className="input py-2" rows={2} value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="copy-list">Para a lista</label>
        <select id="copy-list" className="input py-2" value={listId} onChange={e => setListId(e.target.value)}>
          {shownLists(board).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </div>
      <button className="btn btn-primary w-full py-2 text-sm" disabled={!title.trim()} onClick={() => {
        run({ type: 'card.copy', cardId: card.id, listId, title })
        onDone?.()
      }}>Criar cópia</button>
    </div>
  )
}
