'use client'

import Link from 'next/link'
import { CalendarBlankIcon, CheckIcon, ClockIcon, ListChecksIcon, PaperclipIcon, PauseIcon, PlayIcon, UserCircleIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { ReviewBadge } from './ReviewBadge'
import { CATEGORY_CONFIG, PRIORITY_CONFIG, Task } from '../../types'
import { formatDeadline, formatDuration, taskSeconds } from '../../lib/stats'
import { CategoryBadge } from '../ui/icons'

export default function TaskItem({ task }: { task: Task }) {
  const { allSessions, timer, now, startTimer, pauseTimer, setStatus } = useApp()
  const org = useOrg()
  const assignedBy = org && task.createdBy && task.createdBy !== org.me.id ? org.memberById(task.createdBy) : undefined
  const locked = task.review?.status === 'approved' || (task.status === 'done' && task.review?.status === 'pending')
  const checklist = task.checklist ?? []
  const cat = CATEGORY_CONFIG[task.category]
  const secs = taskSeconds(allSessions, task.id)
  const isActive = timer?.taskId === task.id
  const isRunning = isActive && !!timer?.segmentStart
  const done = task.status === 'done'
  const deadline = task.deadline ? formatDeadline(task.deadline, now) : null

  return (
    <div
      className={`card flex items-center gap-3 border-b-4 p-3 transition-colors ${isActive ? '' : 'hover:bg-snow'}`}
      style={isActive ? { borderColor: cat.color, background: cat.light } : undefined}
    >
      <button
        onClick={() => !locked && setStatus(task.id, done ? 'todo' : 'done')}
        disabled={locked}
        aria-label={locked ? 'Em revisão ou aprovada' : done ? 'Marcar como por fazer' : task.requiresApproval ? 'Enviar para revisão' : 'Concluir tarefa'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors cursor-pointer ${
          done ? 'border-brand bg-brand text-white' : 'border-line text-transparent hover:border-brand hover:text-brand'
        }`}
      >
        <CheckIcon size={16} />
      </button>

      <Link href={`/tarefas/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryBadge category={task.category} size={44} />
        <span className="min-w-0 flex-1">
          <span className={`flex items-center gap-1.5 truncate font-bold ${done ? 'text-muted line-through' : 'text-ink'}`}>
            {task.priority === 'alta' && !done && (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_CONFIG.alta.color }} aria-label="Prioridade alta" />
            )}
            <span className="truncate">{task.title}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-muted">
            <span className="flex items-center gap-1" style={isRunning ? { color: cat.dark } : undefined}>
              <ClockIcon size={12} /> {formatDuration(secs)}
            </span>
            {deadline && !done && (
              <span className={`flex items-center gap-1 ${deadline.late ? 'text-danger' : ''}`}>
                <CalendarBlankIcon size={12} /> {deadline.text}
              </span>
            )}
            <ReviewBadge task={task} />
            {assignedBy && (
              <span className="flex items-center gap-1"><UserCircleIcon size={12} /> {assignedBy.name.split(' ')[0]}</span>
            )}
            {checklist.length > 0 && (
              <span className="flex items-center gap-1"><ListChecksIcon size={12} /> {checklist.filter(c => c.done).length}/{checklist.length}</span>
            )}
            {!!task.attachments?.length && (
              <span className="flex items-center gap-1"><PaperclipIcon size={12} /> {task.attachments.length}</span>
            )}
            {task.tags.slice(0, 2).map(t => (
              <span key={t} className="text-accent">#{t}</span>
            ))}
          </span>
        </span>
      </Link>

      {!done && (
        <button
          onClick={() => (isRunning ? pauseTimer() : startTimer(task.id))}
          aria-label={isRunning ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
          className={`btn h-11 w-11 shrink-0 rounded-full p-0 ${isRunning ? 'btn-ghost text-body' : 'btn-primary'}`}
        >
          {isRunning ? <PauseIcon size={18} weight="fill" /> : <PlayIcon size={18} weight="fill" className="ml-0.5" />}
        </button>
      )}
    </div>
  )
}
