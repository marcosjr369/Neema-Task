'use client'

import {
  BookOpenIcon, BriefcaseIcon, CalendarCheckIcon, CoffeeIcon, ForkKnifeIcon, GameControllerIcon,
  GraduationCapIcon, LaptopIcon, MoonIcon, PersonSimpleWalkIcon, PlantIcon, PowerIcon, PushPinIcon,
  UsersThreeIcon, type Icon, type IconWeight,
} from '@phosphor-icons/react'
import { CATEGORY_CONFIG, PRESENCE_CONFIG, type PresenceStatus, type TaskCategory } from '../../types'

/** Um ícone por categoria e por estado: substituem os emojis em toda a app */
export const CATEGORY_ICON: Record<TaskCategory, Icon> = {
  trabalho: BriefcaseIcon,
  estudo: BookOpenIcon,
  pessoal: PlantIcon,
  alocacao: CalendarCheckIcon,
  descanso: MoonIcon,
  lazer: GameControllerIcon,
  outro: PushPinIcon,
}

export const PRESENCE_ICON: Record<PresenceStatus, Icon> = {
  trabalho: LaptopIcon,
  reuniao: UsersThreeIcon,
  formacao: GraduationCapIcon,
  pausa: CoffeeIcon,
  almoco: ForkKnifeIcon,
  ausente: PersonSimpleWalkIcon,
  offline: PowerIcon,
}

/** Quadrado arredondado com o ícone da categoria (listas, cartões) */
export function CategoryBadge({ category, size = 44, className = '' }: { category: TaskCategory; size?: number; className?: string }) {
  const cfg = CATEGORY_CONFIG[category]
  const Glyph = CATEGORY_ICON[category]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size, background: cfg.light, color: cfg.dark }}
    >
      <Glyph size={Math.round(size * 0.55)} weight="duotone" />
    </span>
  )
}

/** Só o ícone da categoria, na cor da categoria */
export function CategoryGlyph({ category, size = 18, weight = 'duotone', color }: { category: TaskCategory; size?: number; weight?: IconWeight; color?: string }) {
  const Glyph = CATEGORY_ICON[category]
  return <Glyph size={size} weight={weight} color={color ?? CATEGORY_CONFIG[category].dark} />
}

/** Ícone do estado de presença */
export function PresenceGlyph({ status, size = 18, weight = 'duotone', color }: { status: PresenceStatus; size?: number; weight?: IconWeight; color?: string }) {
  const Glyph = PRESENCE_ICON[status]
  const c = PRESENCE_CONFIG[status].color
  return <Glyph size={size} weight={weight} color={color ?? (c === '#D3D0E0' ? '#A3A0B8' : c)} />
}
