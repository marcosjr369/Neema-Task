'use client'

import { Bell, BellOff, X } from 'lucide-react'

type Props = {
  isOpen: boolean
  onAllow: () => void
  onDeny: () => void
}

export default function NotificationModal({ isOpen, onAllow, onDeny }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Bell size={26} className="text-pink-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Ativar notificações
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Quer ser avisado automaticamente quando o prazo de uma tarefa estiver chegando ou expirar?
          </p>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={onAllow}
            className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors font-medium text-sm"
          >
            <Bell size={17} />
            Sim, ativar notificações
          </button>
          <button
            onClick={onDeny}
            className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            <BellOff size={17} />
            Agora não
          </button>
        </div>

        <button
          onClick={onDeny}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
