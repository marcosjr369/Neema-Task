'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeftIcon, XIcon } from '@phosphor-icons/react'

/**
 * Painel flutuante junto a um elemento (menus de lista e de cartão, escolha de etiquetas…).
 * Fica sempre dentro do ecrã; fecha com Escape ou ao clicar fora.
 */
export default function Popover({
  anchor, title, onClose, onBack, children, width = 300,
}: {
  anchor: DOMRect | null
  title: string
  onClose: () => void
  onBack?: () => void
  children: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(width, vw - 16)
    const h = el.offsetHeight
    let left = anchor ? anchor.left : (vw - w) / 2
    let top = anchor ? anchor.bottom + 6 : 80
    left = Math.max(8, Math.min(left, vw - w - 8))
    if (top + h > vh - 8) top = Math.max(8, anchor ? anchor.top - h - 6 : vh - h - 8)
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posição medida no DOM
    setPos({ top, left })
  }, [anchor, width, children])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // o clique que abriu o painel não o fecha logo
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      className="fixed z-[60] max-h-[80dvh] overflow-y-auto rounded-2xl border-2 border-line bg-white shadow-xl animate-fade-in"
      style={{ width: `min(${width}px, calc(100vw - 16px))`, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-white px-2 pt-2">
        {onBack ? (
          <button onClick={onBack} aria-label="Voltar" className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer"><CaretLeftIcon size={18} /></button>
        ) : <span className="w-8" />}
        <p className="flex-1 text-center text-sm font-black text-ink">{title}</p>
        <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-muted hover:bg-snow cursor-pointer"><XIcon size={18} /></button>
      </div>
      <div className="p-3 pt-2">{children}</div>
    </div>,
    document.body,
  )
}

export function MenuItem({ icon, children, onClick, danger, disabled }: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-danger hover:bg-danger-light' : 'text-body hover:bg-snow'
      }`}
    >
      {icon && <span className="text-muted">{icon}</span>}
      {children}
    </button>
  )
}

export const MenuDivider = () => <hr className="my-2 border-t-2 border-line" />

export const MenuTitle = ({ children }: { children: ReactNode }) => (
  <p className="mb-1 mt-1 px-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted">{children}</p>
)
