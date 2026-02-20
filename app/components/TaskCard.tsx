'use client'

import { useState } from 'react'
import { Clock, Tag, ArrowRight, Check, RotateCcw, MoreVertical, Trash2} from 'lucide-react'
import { Task } from '../types'

type Props = {
  task: Task
  onStatusChange: (taskId: string, newStatus: 'todo' | 'doing' | 'done') => void
  onDelete: (taskId: string) => void
}

export default function TaskCard({ task, onStatusChange, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const statusConfig = {
    todo: {
      next: { status: 'doing' as const, icon: ArrowRight, label: 'Iniciar', color: 'text-pink-600' },
      border: 'border-l-pink-400'
    },
    doing: {
      next: { status: 'done' as const, icon: Check, label: 'Concluir', color: 'text-green-600' },
      border: 'border-l-amber-400'
    },
    done: {
      next: { status: 'todo' as const, icon: RotateCcw, label: 'Reabrir', color: 'text-gray-500' },
      border: 'border-l-emerald-400'
    }
  }

  const config = statusConfig[task.status]
  const NextIcon = config.next.icon

  const handleDelete = () => {
    onDelete(task.id)
    setShowMenu(false)
    setShowConfirm(false)
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${config.border} shadow-sm hover:shadow-md transition-all relative`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-medium text-gray-900 leading-tight">{task.title}</h3>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 cursor-pointer hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div className="absolute right-0 top-6 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setShowConfirm(true)
                      setShowMenu(false)
                    }}
                    className="w-full cursor-pointer px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Eliminar tarefa
                  </button>
                </div>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
              </>
            )}

            {showConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Eliminar tarefa</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Tem certeza que deseja eliminar {task.title}? Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={14} className="text-gray-400" />
            <span>{task.period}</span>
          </div>
        </div>

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {task.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                <Tag size={12} className="text-gray-500" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => onStatusChange(task.id, config.next.status)}
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.next.color} hover:opacity-80 transition-opacity`}
        >
          <NextIcon size={16} />
          <span>{config.next.label}</span>
        </button>
      </div>
    </div>
  )
}