'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { useOrg } from '../../context/OrgContext'
import { BRAND_FONTS, DEFAULT_COLORS, TEXT_SIZES, backgroundCss, backgroundFor, paletteVars, resolveBrand } from '../../lib/brand'
import type { BrandTheme } from '../../types'

/*
 * Aparência da empresa na app inteira: cores (variáveis do Tailwind), tipo de letra, tamanho do
 * texto, logótipo e fundos das páginas. Só no espaço da empresa: o espaço pessoal fica igual.
 * A página "Aparência" pode pôr uma pré-visualização por cima, que se vê logo em toda a app.
 */

let preview: BrandTheme | null = null
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Pré-visualização (Empresa → Aparência): null volta ao que está gravado */
export function setBrandPreview(t: BrandTheme | null) {
  preview = t
  listeners.forEach(l => l())
}

export const brandImageUrl = (orgId: string, id: string) => `/api/proxy/orgs/${orgId}/marca/imagem?f=${encodeURIComponent(id)}`

/** A aparência que esta pessoa vê agora (gravada, ou a pré-visualização) */
export function useBrand(): { theme: BrandTheme; orgId: string } | null {
  const org = useOrg()
  const shown = useSyncExternalStore(subscribe, () => preview, () => null)
  const saved = useMemo(
    () => (org ? resolveBrand(org.org.brand, org.departments, org.me.departmentId) : null),
    [org],
  )
  if (!org || !saved) return null
  return { theme: shown ?? saved, orgId: org.org.id }
}

/** O fundo da página actual (CSS), se houver */
export function useBrandBackground(): string | undefined {
  const brand = useBrand()
  const pathname = usePathname()
  if (!brand) return undefined
  const bg = backgroundFor(brand.theme, pathname)
  return bg ? backgroundCss(bg, brand.theme.primary ?? DEFAULT_COLORS.primary, id => brandImageUrl(brand.orgId, id)) : undefined
}

/** Descarrega uma família do Google Fonts (uma vez) */
function loadFont(id: string | undefined) {
  const font = id ? BRAND_FONTS[id] : undefined
  if (!font?.google || typeof document === 'undefined') return
  const linkId = `brand-font-${id}`
  if (document.getElementById(linkId)) return
  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

/** Põe as variáveis no <html>; ao sair do espaço da empresa (ou mudar), tira-as */
export default function BrandTheme() {
  const brand = useBrand()
  const theme = brand?.theme
  const key = JSON.stringify(theme ? { p: theme.primary, s: theme.secondary, x: theme.text, f: theme.font, t: theme.textSize } : null)

  useEffect(() => {
    if (!theme) return
    const root = document.documentElement
    const vars: Record<string, string> = { ...paletteVars(theme) }
    if (theme.font && theme.font !== 'nunito' && BRAND_FONTS[theme.font]) {
      loadFont(theme.font)
      vars['--app-font'] = BRAND_FONTS[theme.font].css
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    const size = theme.textSize && theme.textSize !== 'normal' ? TEXT_SIZES[theme.textSize].scale : ''
    root.style.fontSize = size
    // a barra do browser no telemóvel também fica com a cor da empresa
    const meta = document.querySelector('meta[name="theme-color"]')
    const before = meta?.getAttribute('content')
    if (meta && theme.primary) meta.setAttribute('content', theme.primary)
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k)
      root.style.fontSize = ''
      if (meta && before) meta.setAttribute('content', before)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "key" resume o que interessa do tema
  }, [key])

  return null
}
