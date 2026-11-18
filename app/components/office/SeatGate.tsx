'use client'

import { useState } from 'react'
import { ArmchairIcon, ArrowsLeftRightIcon, HouseLineIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { useOrg } from '../../context/OrgContext'
import { findSeat, hasSeats, mustChoose, whereIs } from '../../lib/office'
import dynamic from 'next/dynamic'
import Spinner from '../ui/Spinner'

// a janela tem o mapa em 3D (three.js, ~0,5 MB): só é descarregada quando abre, não em todas as páginas
const SeatChooser = dynamic(() => import('./SeatChooser'), { ssr: false, loading: () => <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 text-white"><Spinner size={32} /></div> })

/**
 * Ao entrar na plataforma, quem é da empresa tem de dizer onde está sentado (ou que está em
 * remoto) antes de continuar. Só aparece quando o mapa do escritório já tem cadeiras.
 */
export default function SeatGate() {
  const org = useOrg()
  if (!org || org.isCompany || !org.me.consentAt || !org.loaded) return null
  if (!mustChoose(org.me, org.org.office)) return null
  return <SeatChooser required />
}

/** Onde estou agora, sempre à vista, com o botão para trocar de sala ou de cadeira */
export function SeatButton({ compact = false }: { compact?: boolean }) {
  const org = useOrg()
  const [open, setOpen] = useState(false)
  if (!org || org.isCompany || !hasSeats(org.org.office)) return null
  const map = org.org.office
  const w = whereIs({ ...org.me, presence: org.presence === 'offline' ? 'trabalho' : org.presence }, map)
  const at = w.kind === 'seat' ? w.at : findSeat(map, org.me.seatId)
  const text = w.kind === 'meeting'
    ? `Em reunião · ${w.room.name}`
    : w.kind === 'remote' ? 'Trabalho remoto' : at ? `${at.room?.name ?? 'Escritório'} · ${at.seat.label}` : 'Escolhe o teu lugar'
  const Icon = w.kind === 'meeting' ? UsersThreeIcon : w.kind === 'remote' ? HouseLineIcon : ArmchairIcon
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 rounded-xl border-2 border-line bg-white font-bold text-ink hover:bg-snow cursor-pointer ${compact ? 'px-2 py-1 text-xs' : 'w-full px-3 py-2 text-sm'}`}
        title={`${text} · trocar de sala ou de cadeira`}
        aria-label={`${text}. Trocar de sala ou de cadeira`}
      >
        <Icon size={compact ? 16 : 18} className="shrink-0 text-accent" />
        <span className={`min-w-0 truncate text-left ${compact ? 'max-w-28 max-sm:hidden' : 'flex-1'}`}>{text}</span>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-extrabold text-brand-dark">
          <ArrowsLeftRightIcon size={14} /> {!compact && 'Trocar'}
        </span>
      </button>
      {open && <SeatChooser onClose={() => setOpen(false)} />}
    </>
  )
}
