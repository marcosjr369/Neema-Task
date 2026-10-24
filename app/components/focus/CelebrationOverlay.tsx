'use client'

import { CheckCircleIcon, ClockIcon, LightningIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { formatDuration } from '../../lib/stats'
import Mascot from '../ui/Mascot'

export default function CelebrationOverlay() {
  const { celebration, dismissCelebration } = useApp()
  if (!celebration) return null

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-white animate-fade-in">
      <div className="flex w-full max-w-lg flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="relative">
            <Mascot size={150} mood="excited" className="animate-bounce-soft" />
            <span
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-5xl font-black uppercase italic animate-pop-in"
              style={{
                color: '#FFC53D',
                WebkitTextStroke: '2px #FF8A3D',
                textShadow: '0 4px 0 #DB6A1F',
              }}
            >
              {celebration.title}
            </span>
          </div>
          <p className="mt-6 text-lg font-bold text-body">
            {celebration.pending ? 'Enviaste para revisão' : 'Concluíste'} <span className="text-ink">“{celebration.subtitle}”</span>
          </p>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-2xl border-2 border-gold">
              <div className="bg-gold py-1 text-xs font-extrabold uppercase text-white">{celebration.pending ? 'XP ao aprovar' : 'XP ganho'}</div>
              <div className="flex items-center justify-center gap-1 py-3 text-xl font-black text-gold-dark">
                <LightningIcon size={20} weight="fill" /> {celebration.xp}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border-2 border-accent">
              <div className="bg-accent py-1 text-xs font-extrabold uppercase text-white">Tempo</div>
              <div className="flex items-center justify-center gap-1 py-3 text-xl font-black text-accent-dark">
                <ClockIcon size={20} /> {formatDuration(celebration.seconds)}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-brand-light px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <p className="mb-3 flex items-center gap-2 text-xl font-black text-brand-dark">
            <CheckCircleIcon size={26} weight="fill" /> {celebration.pending ? 'O supervisor vai rever' : 'Excelente!'}
          </p>
          <button onClick={dismissCelebration} className="btn btn-primary w-full" autoFocus>
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
