'use client'

import { CheckIcon } from '@phosphor-icons/react'
import { BOARD_COLORS, BOARD_IMAGES, boardBackground } from '../../lib/boards'

export type BgView = 'home' | 'photos' | 'colors'
export type BgChoice = { color?: string; background: string | null }

export const BG_TITLES: Record<BgView, string> = { home: 'Mudar fundo', photos: 'Fotos', colors: 'Cores' }

/**
 * Escolha do fundo de um quadro: entrada com "Fotos" e "Cores" e uma grelha para cada.
 * A vista é controlada por fora (para o botão "voltar" do painel).
 */
export default function BackgroundPicker({ view, setView, color, background, onPick }: {
  view: BgView
  setView: (v: BgView) => void
  color: string
  background?: string
  onPick: (c: BgChoice) => void
}) {
  if (view === 'home') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setView('photos')} className="group text-center cursor-pointer">
          <span className="grid h-24 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl ring-2 ring-transparent transition group-hover:ring-brand/40">
            {BOARD_IMAGES.slice(0, 4).map(img => <span key={img.id} style={{ background: boardBackground('', img.id, true) }} />)}
          </span>
          <span className="mt-1.5 block text-sm font-bold text-body">Fotos</span>
        </button>
        <button onClick={() => setView('colors')} className="group text-center cursor-pointer">
          <span className="flex h-24 flex-col justify-center gap-2 rounded-xl px-4 ring-2 ring-transparent transition group-hover:ring-brand/40" style={{ background: boardBackground('#22A6CF') }}>
            <span className="h-5 rounded-md" style={{ background: boardBackground('#7B61FF') }} />
            <span className="h-5 rounded-md" style={{ background: boardBackground('#EC5BA6') }} />
          </span>
          <span className="mt-1.5 block text-sm font-bold text-body">Cores</span>
        </button>
      </div>
    )
  }

  if (view === 'photos') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {BOARD_IMAGES.map(img => {
          const on = background === img.id
          return (
            <button key={img.id} onClick={() => onPick({ background: img.id })} aria-label={img.label} aria-pressed={on} title={img.label}
              className={`relative flex h-20 items-center justify-center rounded-xl text-white ring-2 transition cursor-pointer ${on ? 'ring-brand' : 'ring-transparent hover:ring-brand/40'}`}
              style={{ background: boardBackground('', img.id, true) }}>
              {on && <span className="rounded-full bg-black/40 p-1"><CheckIcon size={16} weight="bold" /></span>}
            </button>
          )
        })}
        <p className="col-span-2 mt-1 text-[11px] font-semibold text-muted">Fotos do Unsplash.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {BOARD_COLORS.map(c => {
        const on = !background && color === c
        return (
          <button key={c} onClick={() => onPick({ color: c, background: null })} aria-label={`Cor ${c}`} aria-pressed={on}
            className={`flex h-16 items-center justify-center rounded-xl text-white ring-2 transition cursor-pointer ${on ? 'ring-brand' : 'ring-transparent hover:ring-brand/40'}`}
            style={{ background: boardBackground(c) }}>
            {on && <CheckIcon size={18} weight="bold" />}
          </button>
        )
      })}
    </div>
  )
}
