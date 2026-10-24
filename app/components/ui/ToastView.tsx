'use client'

import { CheckCircleIcon, InfoIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'

const TONES = {
  info: { cls: 'bg-ink text-white', Icon: InfoIcon },
  danger: { cls: 'bg-danger text-white', Icon: WarningCircleIcon },
  success: { cls: 'bg-brand text-white', Icon: CheckCircleIcon },
}

export default function ToastView() {
  const { toast } = useApp()
  if (!toast) return null
  const { cls, Icon } = TONES[toast.tone]
  return (
    <div
      key={toast.id}
      role="status"
      className={`fixed left-1/2 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold shadow-lg animate-toast-in ${cls}`}
    >
      <Icon size={22} weight="fill" className="shrink-0" />
      <span className="flex-1">{toast.text}</span>
    </div>
  )
}
