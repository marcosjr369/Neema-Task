'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import TaskItem from '../components/tasks/TaskItem'
import Mascot from '../components/ui/Mascot'
import { CATEGORIES, CATEGORY_CONFIG, STATUS_LABEL, Task, TaskCategory, TaskStatus } from '../types'
import { CategoryGlyph } from '../components/ui/icons'

const TABS: TaskStatus[] = ['todo', 'doing', 'done']
const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 }
const STATUS_COLOR: Record<TaskStatus, string> = { todo: '#12B5A6', doing: '#FF8A3D', done: '#7B61FF' }

function sortFor(status: TaskStatus) {
  return (a: Task, b: Task) =>
    status === 'done'
      ? (b.completedAt ?? 0) - (a.completedAt ?? 0)
      : PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt
}

/** Coluna do quadro Kanban (desktop) com arrastar-e-largar */
function KanbanColumn({
  status, tasks, dragging, setDragging, onDrop,
}: {
  status: TaskStatus
  tasks: Task[]
  dragging: string | null
  setDragging: (id: string | null) => void
  onDrop: (status: TaskStatus) => void
}) {
  const { openTaskSheet } = useApp()
  const [over, setOver] = useState(false)
  const color = STATUS_COLOR[status]

  return (
    <section
      onDragOver={e => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false)
        onDrop(status)
      }}
      className="flex min-h-[60vh] flex-col rounded-2xl border-2 p-3 transition-colors"
      style={{
        borderColor: over ? color : dragging ? '#D3D0E0' : '#E9E7F2',
        borderStyle: dragging ? 'dashed' : 'solid',
        background: over ? `${color}10` : '#F7F6FC',
      }}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <h2 className="font-black uppercase tracking-wide text-ink">{STATUS_LABEL[status]}</h2>
        <span className="rounded-lg bg-white px-2 text-sm font-bold text-muted">{tasks.length}</span>
        {status === 'todo' && (
          <button onClick={() => openTaskSheet()} className="ml-auto rounded-lg p-1 text-muted hover:bg-white hover:text-brand cursor-pointer" aria-label="Nova tarefa">
            <PlusIcon size={20} />
          </button>
        )}
      </header>
      <div className="flex-1 space-y-3">
        {tasks.map(t => <DraggableTask key={t.id} task={t} setDragging={setDragging} />)}
        {tasks.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-line p-6 text-center text-sm font-bold text-muted">
            Arrasta tarefas para aqui
          </p>
        )}
      </div>
    </section>
  )
}


function DraggableTask({ task, setDragging }: { task: Task; setDragging: (id: string | null) => void }) {
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        setDragging(task.id)
      }}
      onDragEnd={() => setDragging(null)}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskItem task={task} />
    </div>
  )
}

export default function TasksPage() {
  const { tasks, openTaskSheet, setStatus } = useApp()
  const [tab, setTab] = useState<TaskStatus>('todo')
  const [category, setCategory] = useState<TaskCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const matches = tasks.filter(
    t =>
      (category === 'all' || t.category === category) &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))),
  )
  const byStatus = (s: TaskStatus) => matches.filter(t => t.status === s).sort(sortFor(s))
  const list = byStatus(tab)

  const usedCategories = CATEGORIES.filter(c => tasks.some(t => t.category === c))

  const handleDrop = (status: TaskStatus) => {
    if (dragging) setStatus(dragging, status)
    setDragging(null)
  }

  return (
    <div>
      <header className="sticky top-0 z-20 space-y-3 border-b-2 border-line bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:px-0 lg:pt-6">
        <div className="space-y-3 lg:flex lg:items-center lg:gap-4 lg:space-y-0">
          <h1 className="text-2xl font-black text-ink lg:text-3xl">Tarefas</h1>
          <div className="relative lg:ml-auto lg:w-80">
            <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input py-2.5 pl-10"
              placeholder="Pesquisar tarefas ou #etiquetas"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Pesquisar"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted cursor-pointer" aria-label="Limpar">
                <XIcon size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Segmentos de estado (mobile) */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-snow p-1 lg:hidden" role="tablist">
          {TABS.map(s => (
            <button
              key={s}
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={`rounded-xl py-2 text-sm font-extrabold transition-colors cursor-pointer ${
                tab === s ? 'bg-white text-brand shadow-[0_2px_0_#E9E7F2]' : 'text-muted hover:text-body'
              }`}
            >
              {STATUS_LABEL[s]} <span className="opacity-70">{matches.filter(t => t.status === s).length}</span>
            </button>
          ))}
        </div>

        {usedCategories.length > 1 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <button
              onClick={() => setCategory('all')}
              className={`chip ${category === 'all' ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}
            >
              Todas
            </button>
            {usedCategories.map(c => {
              const cfg = CATEGORY_CONFIG[c]
              const sel = category === c
              return (
                <button
                  key={c}
                  onClick={() => setCategory(sel ? 'all' : c)}
                  className="chip"
                  style={sel ? { borderColor: cfg.color, background: cfg.light, color: cfg.dark } : undefined}
                >
                  <CategoryGlyph category={c} size={16} color={sel ? cfg.dark : undefined} /> {cfg.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* Desktop: quadro Kanban */}
      <div className="hidden gap-4 pt-5 lg:grid lg:grid-cols-3">
        {TABS.map(s => (
          <KanbanColumn key={s} status={s} tasks={byStatus(s)} dragging={dragging} setDragging={setDragging} onDrop={handleDrop} />
        ))}
      </div>

      {/* Mobile: lista por separador */}
      <div className="space-y-3 px-4 pt-4 lg:hidden">
        {list.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <Mascot size={96} mood={tab === 'done' ? 'happy' : 'sleepy'} />
            <p className="mt-4 text-lg font-black text-ink">
              {q || category !== 'all'
                ? 'Nada encontrado'
                : tab === 'todo'
                  ? 'Sem tarefas por fazer'
                  : tab === 'doing'
                    ? 'Nada em curso'
                    : 'Ainda nada concluído'}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {tab === 'doing' ? 'Carrega no botão play de uma tarefa para começar a contar o tempo.' : 'Adiciona uma tarefa com o botão +'}
            </p>
            {tab === 'todo' && !q && (
              <button onClick={() => openTaskSheet()} className="btn btn-accent mt-5">
                Nova tarefa
              </button>
            )}
          </div>
        ) : (
          list.map(t => <TaskItem key={t.id} task={t} />)
        )}
      </div>
    </div>
  )
}
