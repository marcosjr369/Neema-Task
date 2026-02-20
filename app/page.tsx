'use client'

import { useState } from 'react'
import { columns } from './data/columns'
import KanbanColumn from './components/KanbanColumn'
import AddTaskModal from './components/AddTaskModal'
import { useLocalStorage } from './hook/useLocalStorage'
import { Task } from './types'
import { LayoutGrid } from 'lucide-react'

export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('neema-tasks', [])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleAddTask = (newTask: Task) => {
    setTasks([...tasks, newTask])
  }

  const handleStatusChange = (taskId: string, newStatus: 'todo' | 'doing' | 'done') => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ))
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId))
  }

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status)
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                <LayoutGrid size={18} className="text-white" />
              </div>
              <h1 className="text-xl text-gray-900">Neema Tasks</h1>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium"
            >
              Nova tarefa
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getTasksByStatus(column.id)}
              onAddTask={() => setIsModalOpen(true)}
              onStatusChange={handleStatusChange}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutGrid size={24} className="text-pink-400" />
            </div>
            <h3 className="text-gray-900 font-medium mb-2">Nenhuma tarefa criada</h3>
            <p className="text-gray-500 text-sm mb-6">Comece criando sua primeira tarefa</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium"
            >
              Criar tarefa
            </button>
          </div>
        )}
      </main>

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddTask}
      />
    </div>
  )
}