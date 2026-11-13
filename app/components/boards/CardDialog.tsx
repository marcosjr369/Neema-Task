'use client'

import { useState, type ReactNode } from 'react'
import {
  ArchiveIcon, ArrowCounterClockwiseIcon, ArrowRightIcon, ChatCircleIcon, CheckSquareIcon, ClockIcon, CopyIcon, ImageIcon, LinkIcon,
  PlusIcon, TagIcon, TextAlignLeftIcon, TrashIcon, UserIcon, XIcon,
} from '@phosphor-icons/react'
import Modal from '../ui/Modal'
import Avatar from '../ui/Avatar'
import Popover from './Popover'
import { CopyPanel, CoverPanel, DatesPanel, LabelsPanel, MembersPanel, MovePanel } from './CardPanels'
import { dueState, shortDate } from '../../lib/boards'
import type { BoardCard, BoardPerson, BoardView, ChecklistItem } from '../../types'
import type { RunOp } from './useBoard'

type Panel = 'labels' | 'members' | 'dates' | 'cover' | 'move' | 'copy'
const PANEL_TITLES: Record<Panel, string> = { labels: 'Etiquetas', members: 'Membros', dates: 'Datas', cover: 'Capa', move: 'Mover cartão', copy: 'Copiar cartão' }

export const DUE_STYLE = {
  done: { bg: '#DCF7F3', fg: '#0D9488', label: 'Concluído' },
  late: { bg: '#FDE4E5', fg: '#CF3540', label: 'Atrasado' },
  soon: { bg: '#FFF4D6', fg: '#B07D00', label: 'Entrega em breve' },
  ok: { bg: '#F1F0F6', fg: '#4A4763', label: '' },
}

const fmtWhen = (at: number) =>
  new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at)

function Section({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted">{icon}</span>
        <h3 className="flex-1 font-black text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function CardDialog({ board, card, people, run, readOnly, userId, moderator, onClose, onCopyLink }: {
  board: BoardView
  card: BoardCard
  people: BoardPerson[]
  run: RunOp
  readOnly: boolean
  userId?: string
  moderator?: boolean
  onClose: () => void
  onCopyLink?: () => void
}) {
  const [panel, setPanel] = useState<{ kind: Panel; anchor: DOMRect } | null>(null)
  const [title, setTitle] = useState(card.title)
  const [desc, setDesc] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const [comment, setComment] = useState('')
  const list = board.lists.find(l => l.id === card.listId)
  const labels = board.labels.filter(l => card.labelIds.includes(l.id))
  const members = card.memberIds.map(id => people.find(p => p.userId === id)).filter((p): p is BoardPerson => !!p)
  const checklist = card.checklist ?? []
  const done = checklist.filter(i => i.done).length
  const due = dueState(card)

  const open = (kind: Panel) => (e: React.MouseEvent) => setPanel({ kind, anchor: e.currentTarget.getBoundingClientRect() })
  const setChecklist = (next: ChecklistItem[]) => run({ type: 'card.update', cardId: card.id, patch: { checklist: next } })
  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== card.title) run({ type: 'card.update', cardId: card.id, patch: { title: t } })
    else setTitle(card.title)
  }

  const action = (icon: ReactNode, label: string, onClick: (e: React.MouseEvent) => void, danger = false) => (
    <button onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-extrabold transition-colors cursor-pointer ${danger ? 'bg-danger-light text-danger-dark hover:brightness-95' : 'bg-snow text-body hover:bg-line'}`}>
      {icon}{label}
    </button>
  )

  return (
    <Modal title={readOnly ? card.title : 'Cartão'} onClose={onClose} wide>
      {card.cover && <div className="-mx-5 mb-4 h-16" style={{ background: card.cover }} />}
      {card.archived && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-gold/20 px-3 py-2 text-sm font-bold text-ink">
          <ArchiveIcon size={18} /> Este cartão está arquivado.
        </p>
      )}

      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="min-w-0 flex-1">
          {!readOnly && (
            <textarea
              aria-label="Título do cartão"
              className="w-full resize-none rounded-xl border-2 border-transparent bg-transparent px-2 py-1 text-xl font-black text-ink outline-none hover:bg-snow focus:border-accent focus:bg-white"
              rows={Math.min(4, Math.ceil(title.length / 40) || 1)}
              value={title}
              maxLength={200}
              onChange={e => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
            />
          )}
          <p className="px-2 text-sm font-semibold text-muted">na lista <span className="font-extrabold text-body">{list?.title ?? '—'}</span></p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 px-2">
            {members.length > 0 && (
              <div>
                <p className="label mb-1">Membros</p>
                <div className="flex -space-x-1.5">
                  {members.map(m => <span key={m.userId} title={m.name} className="rounded-full ring-2 ring-white"><Avatar name={m.name} picture={m.picture} size={32} /></span>)}
                </div>
              </div>
            )}
            {labels.length > 0 && (
              <div>
                <p className="label mb-1">Etiquetas</p>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map(l => <span key={l.id} className="h-8 min-w-12 rounded-lg px-3 text-sm font-extrabold leading-8 text-white" style={{ background: l.color }}>{l.name}</span>)}
                </div>
              </div>
            )}
            {(card.start || card.due) && (
              <div>
                <p className="label mb-1">Datas</p>
                <div className="flex items-center gap-2">
                  {card.due && !readOnly && (
                    <input type="checkbox" aria-label="Entrega concluída" className="h-5 w-5 accent-accent cursor-pointer" checked={!!card.dueDone}
                      onChange={e => run({ type: 'card.update', cardId: card.id, patch: { dueDone: e.target.checked } })} />
                  )}
                  <span className="rounded-lg px-2.5 py-1 text-sm font-extrabold" style={{ background: due ? DUE_STYLE[due].bg : '#F1F0F6', color: due ? DUE_STYLE[due].fg : '#4A4763' }}>
                    {card.start && `${shortDate(card.start)} – `}{card.due ? shortDate(card.due) : 'sem entrega'}
                    {due && DUE_STYLE[due].label && ` · ${DUE_STYLE[due].label}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Section icon={<TextAlignLeftIcon size={20} />} title="Descrição"
            action={!readOnly && desc === null && card.description ? <button className="chip py-1 text-xs" onClick={() => setDesc(card.description ?? '')}>Editar</button> : undefined}>
            {desc !== null ? (
              <div className="space-y-2">
                <textarea className="input min-h-32" autoFocus value={desc} maxLength={5000} onChange={e => setDesc(e.target.value)} placeholder="Acrescenta mais detalhes…" />
                <div className="flex gap-2">
                  <button className="btn btn-primary py-2 text-sm" onClick={() => {
                    run({ type: 'card.update', cardId: card.id, patch: { description: desc } })
                    setDesc(null)
                  }}>Guardar</button>
                  <button className="rounded-xl px-3 text-sm font-extrabold text-muted hover:bg-snow cursor-pointer" onClick={() => setDesc(null)}>Cancelar</button>
                </div>
              </div>
            ) : card.description ? (
              <p className="whitespace-pre-wrap break-words rounded-xl px-2 text-[15px] font-semibold text-body">{card.description}</p>
            ) : readOnly ? (
              <p className="px-2 text-sm font-semibold text-muted">Sem descrição.</p>
            ) : (
              <button onClick={() => setDesc('')} className="w-full rounded-xl bg-snow px-3 py-3 text-left text-sm font-bold text-muted hover:bg-line cursor-pointer">
                Acrescenta uma descrição mais detalhada…
              </button>
            )}
          </Section>

          {(checklist.length > 0 || !readOnly) && (
            <Section icon={<CheckSquareIcon size={20} />} title="Checklist">
              {checklist.length > 0 && (
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="w-9 text-xs font-black text-muted">{Math.round((done / checklist.length) * 100)}%</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / checklist.length) * 100}%` }} />
                  </div>
                </div>
              )}
              <ul className="space-y-1">
                {checklist.map(item => (
                  <li key={item.id} className="group flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-snow">
                    <input type="checkbox" className="h-5 w-5 shrink-0 accent-accent cursor-pointer" checked={item.done} disabled={readOnly}
                      aria-label={item.text}
                      onChange={() => setChecklist(checklist.map(i => (i.id === item.id ? { ...i, done: !i.done } : i)))} />
                    <span className={`flex-1 break-words text-sm font-semibold ${item.done ? 'text-muted line-through' : 'text-body'}`}>{item.text}</span>
                    {!readOnly && (
                      <button onClick={() => setChecklist(checklist.filter(i => i.id !== item.id))} aria-label="Remover item"
                        className="rounded-lg p-1 text-muted opacity-0 hover:bg-white group-hover:opacity-100 focus:opacity-100 cursor-pointer">
                        <XIcon size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!readOnly && (
                <form className="mt-2 flex gap-2" onSubmit={e => {
                  e.preventDefault()
                  const t = newItem.trim()
                  if (!t) return
                  setChecklist([...checklist, { id: crypto.randomUUID(), text: t, done: false }])
                  setNewItem('')
                }}>
                  <input className="input py-2" placeholder="Adicionar um item" value={newItem} maxLength={200} onChange={e => setNewItem(e.target.value)} />
                  <button className="btn btn-ghost px-3 py-2" aria-label="Adicionar item" disabled={!newItem.trim()}><PlusIcon size={18} /></button>
                </form>
              )}
            </Section>
          )}

          <Section icon={<ChatCircleIcon size={20} />} title="Comentários">
            {!readOnly && (
              <form className="mb-3 flex gap-2" onSubmit={e => {
                e.preventDefault()
                if (!comment.trim()) return
                run({ type: 'card.comment', cardId: card.id, text: comment })
                setComment('')
              }}>
                <input className="input py-2" placeholder="Escreve um comentário…" value={comment} maxLength={2000} onChange={e => setComment(e.target.value)} />
                <button className="btn btn-primary px-4 py-2 text-sm" disabled={!comment.trim()}>Enviar</button>
              </form>
            )}
            {(card.comments ?? []).length === 0 && <p className="px-2 text-sm font-semibold text-muted">Ainda sem comentários.</p>}
            <ul className="space-y-3">
              {[...(card.comments ?? [])].reverse().map(c => {
                const p = people.find(x => x.userId === c.userId)
                return (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar name={c.name} picture={p?.picture} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-black text-ink">{c.name}</span> <span className="font-semibold text-muted">{fmtWhen(c.at)}</span></p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words rounded-xl border-2 border-line px-3 py-2 text-sm font-semibold text-body">{c.text}</p>
                      {!readOnly && (c.userId === userId || moderator) && (
                        <button onClick={() => run({ type: 'card.uncomment', cardId: card.id, commentId: c.id })} className="mt-0.5 text-xs font-bold text-muted underline hover:text-danger cursor-pointer">Apagar</button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        </div>

        {!readOnly && (
          <aside className="flex shrink-0 flex-col gap-1.5 sm:w-44">
            <p className="label mb-0.5">Adicionar ao cartão</p>
            {action(<UserIcon size={16} />, 'Membros', open('members'))}
            {action(<TagIcon size={16} />, 'Etiquetas', open('labels'))}
            {action(<ClockIcon size={16} />, 'Datas', open('dates'))}
            {action(<ImageIcon size={16} />, 'Capa', open('cover'))}
            <p className="label mb-0.5 mt-3">Acções</p>
            {action(<ArrowRightIcon size={16} />, 'Mover', open('move'))}
            {action(<CopyIcon size={16} />, 'Copiar', open('copy'))}
            {onCopyLink && action(<LinkIcon size={16} />, 'Copiar link', () => onCopyLink())}
            {card.archived ? (
              <>
                {action(<ArrowCounterClockwiseIcon size={16} />, 'Restaurar', () => run({ type: 'card.archive', cardId: card.id, archived: false }))}
                {action(<TrashIcon size={16} />, 'Apagar', () => {
                  if (!confirm('Apagar este cartão de vez? Não dá para desfazer.')) return
                  run({ type: 'card.delete', cardId: card.id })
                  onClose()
                }, true)}
              </>
            ) : action(<ArchiveIcon size={16} />, 'Arquivar', () => run({ type: 'card.archive', cardId: card.id, archived: true }))}
          </aside>
        )}
      </div>

      {panel && (
        <Popover anchor={panel.anchor} title={PANEL_TITLES[panel.kind]} onClose={() => setPanel(null)}>
          {(() => {
            const props = { board, card, run, onDone: () => setPanel(null) }
            switch (panel.kind) {
              case 'labels': return <LabelsPanel {...props} />
              case 'members': return <MembersPanel {...props} people={people} />
              case 'dates': return <DatesPanel {...props} />
              case 'cover': return <CoverPanel {...props} />
              case 'move': return <MovePanel {...props} />
              case 'copy': return <CopyPanel {...props} />
            }
          })()}
        </Popover>
      )}
    </Modal>
  )
}
