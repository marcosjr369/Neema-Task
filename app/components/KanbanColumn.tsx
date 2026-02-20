'use client'

import { Task } from '../types'
import TaskCard from './TaskCard'
import { Plus, Circle, CheckCircle2, Clock } from 'lucide-react'

type Props = {
  column: { id: string; title: string }
  tasks: Task[]
  onAddTask: () => void
  onStatusChange: (taskId: string, newStatus: 'todo' | 'doing' | 'done') => void
  onDeleteTask: (taskId: string) => void
}

const columnIcons = {
  todo: Circle,
  doing: Clock,
  done: CheckCircle2
}

const columnColors = {
  todo: 'text-pink-500',
  doing: 'text-amber-500',
  done: 'text-emerald-500'
}

export default function KanbanColumn({ column, tasks, onAddTask, onStatusChange, onDeleteTask }: Props) {
  const Icon = columnIcons[column.id as keyof typeof columnIcons]
  const color = columnColors[column.id as keyof typeof columnColors]

  return (
    <div className="flex-1 min-w-[320px] bg-gray-50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Icon size={20} className={color} />
          <h2 className="font-medium text-gray-900">{column.title}</h2>
          <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>

        {column.id === 'todo' && (
          <button
            onClick={onAddTask}
            className="text-gray-400 cursor-pointer hover:text-pink-500 transition-colors"
            title="Adicionar tarefa"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onStatusChange={onStatusChange}
            onDelete={onDeleteTask}
          />
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">
              {column.id === 'todo' ? 'Nenhuma tarefa pendente' :
               column.id === 'doing' ? 'Nenhuma tarefa em andamento' :
               'Nenhuma tarefa concluída'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}