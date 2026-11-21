import {
  ArmchairIcon, BuildingsIcon, CalendarBlankIcon, CheckSquareIcon, FlowArrowIcon, GraduationCapIcon, KanbanIcon, TableIcon, ChartBarIcon, ChartLineUpIcon, ClipboardTextIcon, GearSixIcon, HouseIcon, ListChecksIcon, MedalIcon,
  PuzzlePieceIcon, SquaresFourIcon, TimerIcon, TreeStructureIcon, TrophyIcon, UserIcon, UsersThreeIcon, type Icon,
} from '@phosphor-icons/react'

export type NavItem = {
  href: string
  label: string
  icon: Icon
  color: string
  exact?: boolean
}

export type NavGroup = { title: string; items: NavItem[] }

const ITEMS = {
  inicio: { href: '/', label: 'Início', icon: HouseIcon, color: '#7B61FF' },
  tarefas: { href: '/tarefas', label: 'Tarefas', icon: ListChecksIcon, color: '#12B5A6' },
  foco: { href: '/foco', label: 'Foco', icon: TimerIcon, color: '#F2545B' },
  calendario: { href: '/calendario', label: 'Calendário', icon: CalendarBlankIcon, color: '#22A6CF' },
  quadros: { href: '/quadros', label: 'Quadros', icon: KanbanIcon, color: '#7B61FF' },
  planilhas: { href: '/planilhas', label: 'Planilhas', icon: TableIcon, color: '#12B5A6' },
  diagramas: { href: '/diagramas', label: 'Diagramas', icon: FlowArrowIcon, color: '#FF8A3D' },
  inqueritos: { href: '/inqueritos', label: 'Inquéritos', icon: CheckSquareIcon, color: '#4C7DFF' },
  estatisticas: { href: '/estatisticas', label: 'Estatísticas', icon: ChartBarIcon, color: '#EC5BA6' },
  ranking: { href: '/ranking', label: 'Ranking', icon: TrophyIcon, color: '#E0A419' },
  empresa: { href: '/empresa', label: 'Empresa', icon: BuildingsIcon, color: '#4C7DFF' },
  perfil: { href: '/perfil', label: 'Perfil', icon: UserIcon, color: '#FF8A3D' },
  tutorial: { href: '/tutorial', label: 'Tutorial', icon: GraduationCapIcon, color: '#7B61FF' },
  jogos: { href: '/jogos', label: 'Jogos', icon: PuzzlePieceIcon, color: '#EC5BA6' },
  mapa: { href: '/mapa', label: 'Mapa', icon: ArmchairIcon, color: '#12B5A6' },
} satisfies Record<string, NavItem>

export type SectionId = 'geral' | 'tarefas' | 'relatorios' | 'recordes' | 'pessoas' | 'departamentos' | 'definicoes'

export const sectionHref = (id: SectionId) => (id === 'geral' ? '/empresa' : `/empresa/${id}`)

export const SECTIONS: (NavItem & { id: SectionId; admin?: boolean })[] = [
  { id: 'geral', href: '/empresa', label: 'Visão geral', icon: SquaresFourIcon, color: '#4C7DFF', exact: true },
  { id: 'tarefas', href: '/empresa/tarefas', label: 'Tarefas da equipa', icon: ClipboardTextIcon, color: '#12B5A6' },
  { id: 'relatorios', href: '/empresa/relatorios', label: 'Relatórios', icon: ChartLineUpIcon, color: '#EC5BA6' },
  { id: 'recordes', href: '/empresa/recordes', label: 'Recordes', icon: MedalIcon, color: '#E0A419' },
  { id: 'pessoas', href: '/empresa/pessoas', label: 'Funcionários', icon: UsersThreeIcon, color: '#7B61FF' },
  { id: 'departamentos', href: '/empresa/departamentos', label: 'Departamentos', icon: TreeStructureIcon, color: '#FF8A3D', admin: true },
  { id: 'definicoes', href: '/empresa/definicoes', label: 'Definições', icon: GearSixIcon, color: '#86829B' },
]

const section = (id: SectionId) => SECTIONS.find(s => s.id === id)!

export const visibleSections = (isAdmin: boolean) => SECTIONS.filter(s => !s.admin || isAdmin)

export type NavMode = 'person' | 'manager' | 'admin' | 'company'

export const PERSONAL_ONLY_PATHS = ['/', '/tarefas', '/foco', '/estatisticas']

/** "inOrg": pertence a uma empresa (os funcionários sem chefia também usam o modo "person") */
export function navGroups(mode: NavMode, inOrg = mode !== 'person'): NavGroup[] {
  if (mode === 'company') {
    return [
      { title: 'Empresa', items: [section('geral'), ITEMS.mapa, ITEMS.calendario, ITEMS.quadros, ITEMS.planilhas, ITEMS.diagramas, ITEMS.inqueritos, section('tarefas'), section('relatorios'), section('recordes')] },
      { title: 'Equipa', items: [section('pessoas'), section('departamentos'), ITEMS.ranking] },
      { title: 'Gestão', items: [section('definicoes')] },
      { title: 'Ajuda', items: [ITEMS.tutorial] },
    ]
  }
  const groups: NavGroup[] = [
    { title: 'Hoje', items: [ITEMS.inicio, ITEMS.tarefas, ITEMS.foco, ITEMS.calendario, ...(inOrg ? [ITEMS.mapa] : [])] },
    { title: 'Colaborar', items: [ITEMS.quadros, ITEMS.planilhas, ITEMS.diagramas, ITEMS.inqueritos] },
    { title: 'Progresso', items: [ITEMS.estatisticas, ITEMS.ranking] },
    { title: 'Descontrair', items: [ITEMS.jogos] },
  ]
  if (mode === 'manager' || mode === 'admin') {
    groups.push({ title: 'Equipa', items: visibleSections(mode === 'admin').map(s => (s.id === 'geral' ? { ...s, label: 'Painel da equipa' } : s)) })
  }
  groups.push({ title: 'Ajuda', items: [ITEMS.tutorial] })
  return groups
}

export function mobileNav(mode: NavMode): NavItem[] {
  if (mode === 'company') {
    return [
      { ...section('geral'), label: 'Painel' },
      { ...section('tarefas'), label: 'Tarefas' },
      section('pessoas'),
      ITEMS.ranking,
    ]
  }
  return [ITEMS.inicio, ITEMS.tarefas, ITEMS.foco, ITEMS.ranking, ...(mode === 'person' ? [] : [ITEMS.empresa])]
}

/** O resto do menu no telemóvel (botão "Mais"): o que não cabe na barra de baixo, por grupos */
export function mobileMore(mode: NavMode, inOrg = mode !== 'person'): NavGroup[] {
  const inBar = new Set(mobileNav(mode).map(i => i.href))
  const groups = navGroups(mode, inOrg)
    .map(g => ({ ...g, items: g.items.filter(i => !inBar.has(i.href)) }))
    .filter(g => g.items.length)
  groups.push({ title: 'Conta', items: [ITEMS.perfil] })
  return groups
}

export const navModeOf = (org: { isCompany: boolean; isAdmin: boolean; isManager: boolean } | null): NavMode =>
  org?.isCompany ? 'company' : org?.isAdmin ? 'admin' : org?.isManager ? 'manager' : 'person'

export const isActivePath = (pathname: string, href: string, exact = false) =>
  href === '/' || exact ? pathname === href : pathname.startsWith(href)
