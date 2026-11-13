'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarBlankIcon, CheckIcon, MagnifyingGlassIcon, PaperclipIcon, PlusIcon, RepeatIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { useApp, useMinute } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { useTaskActions } from '../../context/useTaskActions'
import { formatDeadline } from '../../lib/stats'
import { groupKey } from '../../lib/org'
import { isCompleted } from '../../lib/points'
import { PRIORITY_CONFIG, type Task } from '../../types'
import Avatar from '../../components/ui/Avatar'
import Mascot from '../../components/ui/Mascot'
import { ReviewBadge } from '../../components/tasks/ReviewBadge'
import { CategoryBadge } from '../../components/ui/icons'

type Filter = 'rever' | 'curso' | 'fazer' | 'feitas' | 'todas'
const FILTERS: { id: Filter; label: string; test: (t: Task) => boolean }[] = [
  { id: 'rever', label: 'Por rever', test: t => t.status === 'done' && t.review?.status === 'pending' },
  { id: 'curso', label: 'Em curso', test: t => t.status === 'doing' },
  { id: 'fazer', label: 'A fazer', test: t => t.status === 'todo' },
  { id: 'feitas', label: 'Concluídas', test: t => t.status === 'done' && t.review?.status !== 'pending' },
  { id: 'todas', label: 'Todas', test: () => true },
]

function GroupRow({ copies, now }: { copies: Task[]; now: number }) {
  const org = useOrgRequired()
  const t = copies[0]
  const pending = copies.filter(FILTERS[0].test)
  const done = copies.filter(isCompleted).length
  const deadline = t.deadline ? formatDeadline(t.deadline, now) : null
  const open = copies.some(c => c.status !== 'done')
  const target = pending[0] ?? t
  const shown = copies.slice(0, 5)

  return (
    <li className="card flex items-center gap-3 border-b-4 p-3">
      <Link href={`/tarefas/${target.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryBadge category={t.category} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-bold text-ink">
            {t.priority === 'alta' && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_CONFIG.alta.color }} />}
            <span className="truncate">{t.title}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-muted">
            <span className="flex items-center">
              {shown.map((c, i) => {
                const m = org.memberById(c.assigneeId)
                return (
                  <span key={c.id} className={`rounded-full ring-2 ring-white ${i ? '-ml-1.5' : ''}`} title={m?.name}>
                    <Avatar name={m?.name ?? '?'} picture={m?.picture} size={18} />
                  </span>
                )
              })}
              {copies.length > shown.length && <span className="ml-1">+{copies.length - shown.length}</span>}
            </span>
            <span className="flex items-center gap-1"><UsersThreeIcon size={12} /> {done}/{copies.length} concluídas</span>
            {pending.length > 0 && <span className="rounded-md bg-warm-light px-1.5 text-warm-dark">{pending.length} por rever</span>}
            {deadline && open && (
              <span className={`flex items-center gap-1 ${deadline.late ? 'text-danger' : ''}`}>
                <CalendarBlankIcon size={12} /> {deadline.text}
              </span>
            )}
            {t.recurrence && <RepeatIcon size={12} />}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(done / copies.length) * 100}%` }} />
          </span>
        </span>
      </Link>
    </li>
  )
}

export default function TeamTasks() {
  const org = useOrgRequired()
  const { openTaskSheet } = useApp()
  const now = useMinute()
  const actions = useTaskActions()
  const [filter, setFilter] = useState<Filter>(() =>
    org.teamTasks.some(FILTERS[0].test) ? 'rever' : 'todas',
  )
  const [member, setMember] = useState('all')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const base = org.teamTasks.filter(
    t => (member === 'all' || t.assigneeId === member) && (!q || t.title.toLowerCase().includes(q)),
  )
  // tarefas de grupo aparecem uma vez (com todas as cópias); filtrando por pessoa, vê-se só a cópia dela
  const groups = new Map<string, Task[]>()
  for (const t of base) {
    const key = member === 'all' ? groupKey(t) : t.id
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const items = [...groups.values()]
  const test = FILTERS.find(f => f.id === filter)!.test
  const updated = (copies: Task[]) => Math.max(...copies.map(t => t.updatedAt ?? t.createdAt))
  const list = items
    .filter(copies => copies.some(test))
    .sort((a, b) => updated(b) - updated(a))
  const people = org.assignable.filter(m => m.status === 'activo' || m.status === 'pendente')

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input py-2.5 pl-10" placeholder="Pesquisar tarefas da equipa" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select value={member} onChange={e => setMember(e.target.value)} className="input py-2.5 lg:w-56" aria-label="Funcionário">
          <option value="all">Toda a equipa</option>
          {people.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button onClick={() => openTaskSheet()} className="btn btn-primary">
          <PlusIcon size={18} /> Atribuir tarefa
        </button>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map(f => {
          const n = items.filter(copies => copies.some(f.test)).length
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`chip ${filter === f.id ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
              {f.label}
              <span className={`rounded-md px-1.5 text-xs ${f.id === 'rever' && n > 0 ? 'bg-danger text-white' : 'bg-snow text-muted'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Mascot size={88} mood={filter === 'rever' ? 'happy' : 'sleepy'} />
          <p className="mt-3 font-black text-ink">{filter === 'rever' ? 'Nada para rever' : 'Sem tarefas aqui'}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Atribui tarefas à equipa com o botão acima.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map(copies => {
            if (copies.length > 1) return <GroupRow key={groupKey(copies[0])} copies={copies} now={now} />
            const t = copies[0]
            const who = org.memberById(t.assigneeId)
            const deadline = t.deadline ? formatDeadline(t.deadline, now) : null
            const pending = t.status === 'done' && t.review?.status === 'pending'
            return (
              <li key={t.id} className="card flex items-center gap-3 border-b-4 p-3">
                <Link href={`/tarefas/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <CategoryBadge category={t.category} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-bold text-ink">
                      {t.priority === 'alta' && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_CONFIG.alta.color }} />}
                      <span className="truncate">{t.title}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-muted">
                      <span className="flex items-center gap-1">
                        <Avatar name={who?.name ?? '?'} picture={who?.picture} size={16} /> {who?.name ?? 'Removido'}
                      </span>
                      <ReviewBadge task={t} />
                      {deadline && t.status !== 'done' && (
                        <span className={`flex items-center gap-1 ${deadline.late ? 'text-danger' : ''}`}>
                          <CalendarBlankIcon size={12} /> {deadline.text}
                        </span>
                      )}
                      {!!t.attachments?.length && <span className="flex items-center gap-1"><PaperclipIcon size={12} /> {t.attachments.length}</span>}
                      {t.recurrence && <RepeatIcon size={12} />}
                    </span>
                  </span>
                </Link>
                {pending && (
                  <button
                    onClick={() => actions.approve(t.id)}
                    disabled={actions.busy} aria-busy={actions.busy}
                    className="btn btn-accent h-10 shrink-0 px-3 text-xs"
                    aria-label={`Aprovar ${t.title}`}
                  >
                    <CheckIcon size={16} /> <span className="hidden sm:inline">Aprovar</span>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
