'use client'

import { useState } from 'react'
import { X, Tag, Calendar, Plus } from 'lucide-react'
import { Task } from '../types'

type Props = {
  isOpen: boolean
  onClose: () => void
  onAdd: (task: Task) => void
}

export default function AddTaskModal({ isOpen, onClose, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  if (!isOpen) return null

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd({
      id: Date.now().toString(),
      title,
      description,
      period: deadline
        ? new Date(deadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Sem prazo definido',
      deadline: deadline || undefined,
      tags,
      status: 'todo',
      createdAt: Date.now(),
    })
    setTitle('')
    setDescription('')
    setDeadline('')
    setTags([])
    onClose()
  }

  const minDatetime = new Date()
  minDatetime.setSeconds(0, 0)
  const minDatetimeStr = minDatetime.toISOString().slice(0, 16)

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-pink-100">
          <h2 className="text-lg font-medium text-gray-900">Nova tarefa</h2>
          <button onClick={onClose} className="text-gray-400 cursor-pointer hover:text-pink-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Título</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              placeholder="Ex: Implementar autenticação"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 resize-none"
              placeholder="Descreva os detalhes da tarefa..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Prazo de conclusão
            </label>
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={minDatetimeStr}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              />
            </div>
            {deadline && (
              <p className="text-xs text-gray-400 mt-1.5">
                🔔 Será notificado quando o prazo estiver próximo e ao expirar
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Adicionar tag"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2.5 cursor-pointer bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg text-sm">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-pink-900 cursor-pointer">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 cursor-pointer px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 cursor-pointer px-4 py-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors">
              Criar tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
