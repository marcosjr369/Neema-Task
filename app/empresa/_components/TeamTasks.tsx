'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarBlankIcon, CheckIcon, MagnifyingGlassIcon, PaperclipIcon, PlusIcon, RepeatIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { useTaskActions } from '../../context/useTaskActions'
import { formatDeadline } from '../../lib/stats'
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

export default function TeamTasks() {
  const org = useOrgRequired()
  const { now, openTaskSheet } = useApp()
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
  const test = FILTERS.find(f => f.id === filter)!.test
  const list = base
    .filter(test)
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
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
          const n = base.filter(f.test).length
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
          {list.map(t => {
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
                    disabled={actions.busy}
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
