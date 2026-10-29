'use client'

import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, PlayIcon, SignOutIcon } from '@phosphor-icons/react'
import { useOrg } from '../../context/OrgContext'
import { PRESENCE_CONFIG, PRESENCE_STATUSES } from '../../types'
import { PresenceGlyph } from '../ui/icons'

/** Começar e terminar o trabalho; durante o dia, o estado rápido (a trabalhar, pausa, almoço, reunião…) */
export default function PresencePicker({ compact = false }: { compact?: boolean }) {
  const org = useOrg()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!org || org.isCompany) return null
  const cfg = PRESENCE_CONFIG[org.presence]

  if (!org.workStart) {
    return (
      <button
        onClick={org.startWork}
        className={`btn btn-accent ${compact ? 'gap-1.5 px-3 py-1.5 text-sm' : 'w-full'}`}
      >
        <PlayIcon size={compact ? 16 : 18} weight="fill" /> {compact ? 'Começar' : 'Começar a trabalhar'}
      </button>
    )
  }
  const since = new Date(org.workStart).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-xl border-2 font-extrabold transition-colors cursor-pointer ${
          compact ? 'px-2 py-1 text-sm' : 'w-full px-3 py-2.5'
        }`}
        style={{ borderColor: cfg.color, background: cfg.light, color: '#2B2840' }}
      >
        <PresenceGlyph status={org.presence} size={18} weight="fill" />
        {!compact && <span className="truncate">{cfg.label}</span>}
        <CaretDownIcon size={16} className="ml-auto shrink-0 text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-2 w-60 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-xl animate-fade-in ${
            compact ? 'right-0' : 'left-0'
          }`}
        >
          <p className="flex items-center justify-between px-4 pb-1 pt-3 text-xs font-extrabold uppercase tracking-wider text-muted">
            O meu estado <span className="normal-case tracking-normal">Desde {since}</span>
          </p>
          {PRESENCE_STATUSES.filter(s => s !== 'offline').map(s => {
            const c = PRESENCE_CONFIG[s]
            const sel = s === org.presence
            return (
              <button
                key={s}
                role="menuitemradio"
                aria-checked={sel}
                onClick={() => {
                  org.setPresence(s)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left font-bold hover:bg-snow cursor-pointer ${sel ? 'bg-snow' : ''}`}
              >
                <PresenceGlyph status={s} size={20} />
                <span className="flex-1 text-ink">{c.label}</span>
                {sel && <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />}
              </button>
            )
          })}
          <button
            role="menuitem"
            onClick={() => {
              org.endWork()
              setOpen(false)
            }}
            className="flex w-full items-center gap-3 border-t-2 border-line px-4 py-3 text-left font-bold text-danger hover:bg-danger-light cursor-pointer"
          >
            <SignOutIcon size={18} /> Terminar o trabalho
          </button>
        </div>
      )}
    </div>
  )
}
