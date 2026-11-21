import type { BrandBackground, BrandTheme, Department } from '../types'
import { THEME_BACKGROUNDS } from './polls'

/**
 * Aparência da empresa: cores, logótipo, tipo de letra, tamanho do texto e fundos das páginas.
 * A empresa define a base; cada departamento pode mudar só uma parte (o resto herda de cima).
 * Regras puras, partilhadas pelo browser e pelo servidor.
 */

export class BrandError extends Error {}
const bad = (m: string): never => { throw new BrandError(m) }

/** Cores da Udacha (quando a empresa não escolhe outras) */
export const DEFAULT_COLORS = { primary: '#7B61FF', secondary: '#12B5A6', text: '#2B2840' }

export const BRAND_SWATCHES = ['#7B61FF', '#4C7DFF', '#1F6FEB', '#22A6CF', '#0E9F6E', '#12B5A6', '#2E7D32', '#E0A419', '#F97316', '#F2545B', '#DB2777', '#8E44AD', '#B45309', '#334155', '#111827']

/** Tipos de letra: os do Google Fonts só se descarregam quando a empresa os escolhe */
export const BRAND_FONTS: Record<string, { name: string; css: string; google?: string; kind: 'sans' | 'serif' }> = {
  nunito: { name: 'Nunito (Udacha, predefinida)', css: 'var(--font-nunito), system-ui, sans-serif', kind: 'sans' },
  inter: { name: 'Inter', css: '"Inter", system-ui, sans-serif', google: 'Inter:wght@400;600;700;800;900', kind: 'sans' },
  poppins: { name: 'Poppins', css: '"Poppins", system-ui, sans-serif', google: 'Poppins:wght@400;600;700;800;900', kind: 'sans' },
  montserrat: { name: 'Montserrat', css: '"Montserrat", system-ui, sans-serif', google: 'Montserrat:wght@400;600;700;800;900', kind: 'sans' },
  roboto: { name: 'Roboto', css: '"Roboto", system-ui, sans-serif', google: 'Roboto:wght@400;500;700;900', kind: 'sans' },
  opensans: { name: 'Open Sans', css: '"Open Sans", system-ui, sans-serif', google: 'Open+Sans:wght@400;600;700;800', kind: 'sans' },
  lato: { name: 'Lato', css: '"Lato", system-ui, sans-serif', google: 'Lato:wght@400;700;900', kind: 'sans' },
  raleway: { name: 'Raleway', css: '"Raleway", system-ui, sans-serif', google: 'Raleway:wght@400;600;700;800;900', kind: 'sans' },
  worksans: { name: 'Work Sans', css: '"Work Sans", system-ui, sans-serif', google: 'Work+Sans:wght@400;600;700;800;900', kind: 'sans' },
  merriweather: { name: 'Merriweather', css: '"Merriweather", Georgia, serif', google: 'Merriweather:wght@400;700;900', kind: 'serif' },
  playfair: { name: 'Playfair Display', css: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;600;700;800;900', kind: 'serif' },
  system: { name: 'Do sistema', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', kind: 'sans' },
}

export const TEXT_SIZES = {
  small: { name: 'Pequeno', scale: '93.75%' },
  normal: { name: 'Normal', scale: '100%' },
  large: { name: 'Grande', scale: '106.25%' },
  xlarge: { name: 'Muito grande', scale: '112.5%' },
} as const

/** Páginas que podem ter um fundo próprio. exact: só a página da lista (não os editores, que têm o seu fundo). */
export const BRAND_PAGES: { key: string; name: string; path: string; exact?: boolean }[] = [
  { key: 'inicio', name: 'Início', path: '/', exact: true },
  { key: 'tarefas', name: 'Tarefas', path: '/tarefas' },
  { key: 'calendario', name: 'Calendário', path: '/calendario' },
  { key: 'mapa', name: 'Mapa', path: '/mapa' },
  { key: 'quadros', name: 'Quadros', path: '/quadros', exact: true },
  { key: 'planilhas', name: 'Planilhas', path: '/planilhas', exact: true },
  { key: 'diagramas', name: 'Diagramas', path: '/diagramas', exact: true },
  { key: 'inqueritos', name: 'Inquéritos', path: '/inqueritos', exact: true },
  { key: 'estatisticas', name: 'Estatísticas', path: '/estatisticas' },
  { key: 'ranking', name: 'Ranking', path: '/ranking' },
  { key: 'jogos', name: 'Jogos', path: '/jogos', exact: true },
  { key: 'empresa', name: 'Empresa', path: '/empresa' },
  { key: 'perfil', name: 'Perfil', path: '/perfil' },
  { key: 'tutorial', name: 'Tutorial', path: '/tutorial' },
]

export const pageKeyOf = (pathname: string) =>
  BRAND_PAGES.find(p => (p.exact ? pathname === p.path : pathname === p.path || pathname.startsWith(`${p.path}/`)))?.key

/* ─── Cores ───────────────────────────────────────────────────────────── */

const HEX = /^#[0-9a-fA-F]{6}$/
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const toHex = (c: number[]) => `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

/** Mistura duas cores (t = quanto da segunda) */
export function mix(a: string, b: string, t: number) {
  const x = rgb(a), y = rgb(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste (WCAG) entre duas cores: 1 a 21 */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** O texto branco dos botões lê-se bem nesta cor? (3:1 serve para texto grande e negrito) */
export const readableOnWhiteText = (hex: string) => contrast(hex, '#FFFFFF') >= 3

/** Variáveis CSS das cores da app (ver globals.css): cor, versão escura (bordas dos botões) e clara (fundos) */
export function paletteVars(t: BrandTheme): Record<string, string> {
  const out: Record<string, string> = {}
  const set = (name: 'brand' | 'accent', hex?: string) => {
    if (!isHex(hex)) return
    const p = palette(hex)
    out[`--color-${name}`] = hex
    out[`--color-${name}-dark`] = p.dark
    out[`--color-${name}-light`] = p.light
    out[`--color-on-${name}`] = p.on
  }
  set('brand', t.primary)
  set('accent', t.secondary)
  if (isHex(t.text)) {
    out['--color-ink'] = t.text
    out['--color-body'] = mix(t.text, '#FFFFFF', 0.18)
  }
  return out
}

/**
 * Tons derivados de uma cor:
 * - dark: bordas dos botões e textos na cor da marca; escurece até se ler bem em fundo branco;
 * - light: fundos suaves (etiquetas, menu activo);
 * - on: cor das letras por cima da cor (branco, ou escuro quando a cor é clara).
 */
export function palette(hex: string) {
  let dark = mix(hex, '#000000', 0.2)
  for (let t = 0.3; contrast(dark, '#FFFFFF') < 4.5 && t <= 0.9; t += 0.1) dark = mix(hex, '#000000', t)
  return { dark, light: mix(hex, '#FFFFFF', 0.88), on: readableOnWhiteText(hex) ? '#FFFFFF' : '#2B2840' }
}

/* ─── Herança empresa → departamentos ─────────────────────────────────── */

/** Junta duas aparências: o que "top" define ganha; as páginas juntam-se uma a uma */
export function mergeBrand(base: BrandTheme, top: BrandTheme | undefined): BrandTheme {
  if (!top) return base
  const out: BrandTheme = { ...base }
  for (const k of ['primary', 'secondary', 'text', 'font', 'textSize'] as const) if (top[k] !== undefined) (out as Record<string, unknown>)[k] = top[k]
  if (top.background !== undefined) out.background = top.background
  if (top.pages) out.pages = { ...(base.pages ?? {}), ...top.pages }
  return out
}

/** Os departamentos de cima para baixo até ao dado (empresa → … → departamento) */
export function deptChain(departments: Department[], deptId?: string): Department[] {
  const chain: Department[] = []
  const seen = new Set<string>()
  let d = departments.find(x => x.id === deptId)
  while (d && !seen.has(d.id)) {
    seen.add(d.id)
    chain.unshift(d)
    d = departments.find(x => x.id === d!.parentId)
  }
  return chain
}

/** A aparência que uma pessoa vê: a da empresa, com a de cada departamento acima do seu por cima */
export function resolveBrand(orgBrand: BrandTheme | undefined, departments: Department[], deptId?: string): BrandTheme {
  let out: BrandTheme = { ...(orgBrand ?? {}) }
  for (const d of deptChain(departments, deptId)) out = mergeBrand(out, d.brand)
  // o logótipo é sempre o da empresa
  out.logo = orgBrand?.logo
  return out
}

/** O fundo desta página: o da página, se houver (null = nenhum), senão o geral */
export function backgroundFor(t: BrandTheme, pathname: string): BrandBackground | null {
  const key = pageKeyOf(pathname)
  if (!key) return null
  if (t.pages && key in t.pages) return t.pages[key] ?? null
  return t.background ?? null
}

/** CSS do fundo (a camada branca "suavizar" por cima mantém o texto legível) */
export function backgroundCss(bg: BrandBackground, primary: string, imageSrc: (id: string) => string): string {
  const soften = Math.max(0, Math.min(90, bg.soften ?? 0)) / 100
  const veil = soften ? `linear-gradient(rgb(255 255 255 / ${soften}), rgb(255 255 255 / ${soften})), ` : ''
  if (bg.kind === 'image' && bg.image) return `${veil}center / cover no-repeat url("${imageSrc(bg.image)}")`
  if (bg.kind === 'color' && isHex(bg.value)) return `${veil}${bg.value}`
  const preset = THEME_BACKGROUNDS.find(b => b.id === bg.value)
  return preset ? `${veil}${preset.css(primary)}` : '#ffffff'
}

/** Imagens que a aparência usa (para apagar as que deixaram de ser usadas) */
export const brandImages = (t: BrandTheme | undefined) =>
  t ? [t.logo, t.background?.image, ...Object.values(t.pages ?? {}).map(b => b?.image)].filter((x): x is string => !!x) : []

/* ─── Validar o que chega ao servidor ─────────────────────────────────── */

const IMAGE_ID = /^brand-[A-Za-z0-9-]{8,80}$/

function cleanBackground(v: unknown): BrandBackground | null {
  if (v === null) return null
  const b = (v && typeof v === 'object' ? v : {}) as Partial<BrandBackground>
  const soften = Math.max(0, Math.min(90, Math.round(Number(b.soften) || 0)))
  if (b.kind === 'color') return isHex(b.value) ? { kind: 'color', value: b.value.toUpperCase(), soften } : bad('Cor de fundo inválida')
  if (b.kind === 'preset') return THEME_BACKGROUNDS.some(x => x.id === b.value) ? { kind: 'preset', value: b.value, soften } : bad('Fundo inválido')
  if (b.kind === 'image') return typeof b.image === 'string' && IMAGE_ID.test(b.image) ? { kind: 'image', image: b.image, soften } : bad('Imagem de fundo inválida')
  return bad('Fundo inválido')
}

/** forOrg: só a empresa tem logótipo */
export function cleanBrand(v: unknown, forOrg: boolean): BrandTheme {
  const i = (v && typeof v === 'object' ? v : {}) as Partial<BrandTheme>
  const out: BrandTheme = {}
  if (i.primary !== undefined && i.primary !== null) out.primary = isHex(i.primary) ? i.primary.toUpperCase() : bad('Cor principal inválida')
  if (i.secondary !== undefined && i.secondary !== null) out.secondary = isHex(i.secondary) ? i.secondary.toUpperCase() : bad('Cor secundária inválida')
  if (i.text !== undefined && i.text !== null) out.text = isHex(i.text) ? i.text.toUpperCase() : bad('Cor do texto inválida')
  if (i.font !== undefined && i.font !== null) out.font = Object.hasOwn(BRAND_FONTS, i.font) ? i.font : bad('Tipo de letra inválido')
  if (i.textSize !== undefined && i.textSize !== null) out.textSize = Object.hasOwn(TEXT_SIZES, i.textSize) ? i.textSize : bad('Tamanho do texto inválido')
  if (forOrg && i.logo) out.logo = IMAGE_ID.test(i.logo) ? i.logo : bad('Logótipo inválido')
  if (i.background !== undefined) out.background = cleanBackground(i.background)
  if (i.pages && typeof i.pages === 'object') {
    const pages: Record<string, BrandBackground | null> = {}
    for (const [k, b] of Object.entries(i.pages)) if (BRAND_PAGES.some(p => p.key === k)) pages[k] = cleanBackground(b)
    if (Object.keys(pages).length) out.pages = pages
  }
  return out
}

/** Departamentos cuja aparência esta pessoa pode mudar (administradores: todos; chefias: os que gerem) */
export function editableDepartments(departments: Department[], scope: Set<string> | 'all') {
  return departments.filter(d => scope === 'all' || scope.has(d.id))
}
