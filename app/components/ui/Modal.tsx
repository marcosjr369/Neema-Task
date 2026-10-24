'use client'

import { useEffect, type ReactNode } from 'react'
import { XIcon } from '@phosphor-icons/react'

/** Folha inferior no mobile, diálogo centrado no desktop */
export default function Modal({
  title, onClose, children, footer, wide = false,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white sm:rounded-3xl animate-slide-up ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-3 pt-2 sm:pt-4">
          <h2 className="text-xl font-black text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer">
            <XIcon size={24} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t-2 border-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">{footer}</div>}
      </div>
    </div>
  )
}
