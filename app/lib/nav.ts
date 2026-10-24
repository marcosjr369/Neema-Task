import {
  BuildingsIcon, ChartBarIcon, HouseIcon, ListChecksIcon, TimerIcon, TrophyIcon, UserIcon, type Icon,
} from '@phosphor-icons/react'

export type NavItem = {
  href: string
  label: string
  icon: Icon
  color: string
}

export type NavGroup = { title: string; items: NavItem[] }

const ITEMS = {
  inicio: { href: '/', label: 'Início', icon: HouseIcon, color: '#7B61FF' },
  tarefas: { href: '/tarefas', label: 'Tarefas', icon: ListChecksIcon, color: '#12B5A6' },
  foco: { href: '/foco', label: 'Foco', icon: TimerIcon, color: '#F2545B' },
  estatisticas: { href: '/estatisticas', label: 'Estatísticas', icon: ChartBarIcon, color: '#EC5BA6' },
  ranking: { href: '/ranking', label: 'Ranking', icon: TrophyIcon, color: '#E0A419' },
  empresa: { href: '/empresa', label: 'Empresa', icon: BuildingsIcon, color: '#4C7DFF' },
  perfil: { href: '/perfil', label: 'Perfil', icon: UserIcon, color: '#FF8A3D' },
} satisfies Record<string, NavItem>

/** Navegação lateral (desktop), agrupada por secções. "Equipa" só para supervisores e admins. */
export function navGroups(isManager: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    { title: 'Hoje', items: [ITEMS.inicio, ITEMS.tarefas, ITEMS.foco] },
    { title: 'Progresso', items: [ITEMS.estatisticas, ITEMS.ranking] },
  ]
  if (isManager) groups.push({ title: 'Equipa', items: [ITEMS.empresa] })
  return groups
}

/** Barra de baixo (mobile); as estatísticas abrem a partir do Início e do topo */
export function mobileNav(isManager: boolean): NavItem[] {
  return [ITEMS.inicio, ITEMS.tarefas, ITEMS.foco, ITEMS.ranking, ...(isManager ? [ITEMS.empresa] : []), ITEMS.perfil]
}

export const isActivePath = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)
