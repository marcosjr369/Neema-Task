import {
  BuildingsIcon, ChartBarIcon, ChartLineUpIcon, ClipboardTextIcon, GearSixIcon, HouseIcon, ListChecksIcon,
  SquaresFourIcon, TimerIcon, TreeStructureIcon, TrophyIcon, UserIcon, UsersThreeIcon, type Icon,
} from '@phosphor-icons/react'

export type NavItem = {
  href: string
  label: string
  icon: Icon
  color: string
  /** só fica activo no endereço exacto (ex.: a visão geral, que tem sub-páginas) */
  exact?: boolean
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

// ─── Secções do painel da empresa (cada uma com o seu endereço) ─────────────

export type SectionId = 'geral' | 'tarefas' | 'relatorios' | 'pessoas' | 'departamentos' | 'definicoes'

export const sectionHref = (id: SectionId) => (id === 'geral' ? '/empresa' : `/empresa/${id}`)

export const SECTIONS: (NavItem & { id: SectionId; admin?: boolean })[] = [
  { id: 'geral', href: '/empresa', label: 'Visão geral', icon: SquaresFourIcon, color: '#4C7DFF', exact: true },
  { id: 'tarefas', href: '/empresa/tarefas', label: 'Tarefas da equipa', icon: ClipboardTextIcon, color: '#12B5A6' },
  { id: 'relatorios', href: '/empresa/relatorios', label: 'Relatórios', icon: ChartLineUpIcon, color: '#EC5BA6' },
  { id: 'pessoas', href: '/empresa/pessoas', label: 'Funcionários', icon: UsersThreeIcon, color: '#7B61FF' },
  { id: 'departamentos', href: '/empresa/departamentos', label: 'Departamentos', icon: TreeStructureIcon, color: '#FF8A3D', admin: true },
  { id: 'definicoes', href: '/empresa/definicoes', label: 'Definições', icon: GearSixIcon, color: '#86829B', admin: true },
]

const section = (id: SectionId) => SECTIONS.find(s => s.id === id)!

/** Secções que o membro vê (departamentos e definições só para administradores) */
export const visibleSections = (isAdmin: boolean) => SECTIONS.filter(s => !s.admin || isAdmin)

/**
 * Quem está a usar a app: uma pessoa (funcionário ou conta pessoal), quem gere (supervisor),
 * um administrador, ou a conta da empresa
 */
export type NavMode = 'person' | 'manager' | 'admin' | 'company'

/** Páginas de trabalho próprio que a conta da empresa não usa (reencaminham para o painel) */
export const PERSONAL_ONLY_PATHS = ['/', '/tarefas', '/foco', '/estatisticas']

/** Navegação lateral (desktop), agrupada por secções. "Equipa" só para supervisores e admins. */
export function navGroups(mode: NavMode): NavGroup[] {
  // a conta da empresa não tem trabalho próprio: a sidebar é o painel
  if (mode === 'company') {
    return [
      { title: 'Empresa', items: [section('geral'), section('tarefas'), section('relatorios')] },
      { title: 'Equipa', items: [section('pessoas'), section('departamentos'), ITEMS.ranking] },
      { title: 'Gestão', items: [section('definicoes')] },
    ]
  }
  const groups: NavGroup[] = [
    { title: 'Hoje', items: [ITEMS.inicio, ITEMS.tarefas, ITEMS.foco] },
    { title: 'Progresso', items: [ITEMS.estatisticas, ITEMS.ranking] },
  ]
  if (mode === 'manager' || mode === 'admin') {
    groups.push({ title: 'Equipa', items: visibleSections(mode === 'admin').map(s => (s.id === 'geral' ? { ...s, label: 'Painel da equipa' } : s)) })
  }
  return groups
}

/** Barra de baixo (mobile); as estatísticas abrem a partir do Início e do topo */
export function mobileNav(mode: NavMode): NavItem[] {
  if (mode === 'company') {
    return [
      { ...section('geral'), label: 'Painel' },
      { ...section('tarefas'), label: 'Tarefas' },
      section('pessoas'),
      ITEMS.ranking,
      ITEMS.perfil,
    ]
  }
  return [ITEMS.inicio, ITEMS.tarefas, ITEMS.foco, ITEMS.ranking, ...(mode === 'person' ? [] : [ITEMS.empresa]), ITEMS.perfil]
}

export const navModeOf = (org: { isCompany: boolean; isAdmin: boolean; isManager: boolean } | null): NavMode =>
  org?.isCompany ? 'company' : org?.isAdmin ? 'admin' : org?.isManager ? 'manager' : 'person'

export const isActivePath = (pathname: string, href: string, exact = false) =>
  href === '/' || exact ? pathname === href : pathname.startsWith(href)
