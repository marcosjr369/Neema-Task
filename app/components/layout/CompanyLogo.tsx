'use client'

import Link from 'next/link'
import Mascot from '../ui/Mascot'
import { useOrg } from '../../context/OrgContext'
import { brandImageUrl, useBrand } from './BrandTheme'

/** Topo da barra lateral: o logótipo da empresa (se houver) ou a Udacha */
export function SideLogo() {
  const brand = useBrand()
  const org = useOrg()
  const logo = brand?.theme.logo
  if (!logo || !org) {
    return (
      <Link href="/" className="mb-5 flex items-center gap-2 px-2">
        <Mascot size={38} />
        <span className="text-xl font-black tracking-tight text-brand">udacha</span>
      </Link>
    )
  }
  // o logótipo ocupa o topo todo: uma área fixa (não salta entre páginas), alinhado à esquerda
  return (
    <Link href="/" aria-label={`${org.org.name}: início`}
      className="mb-5 flex h-16 items-center rounded-2xl px-2 transition-colors hover:bg-snow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brandImageUrl(org.org.id, logo)} alt={org.org.name} className="max-h-14 w-auto max-w-full object-contain object-left" />
    </Link>
  )
}

/** No fundo da barra lateral, quando a empresa tem logótipo: a Udacha fica discreta */
export function PoweredBy() {
  const brand = useBrand()
  if (!brand?.theme.logo) return null
  return (
    <Link href="/tutorial" className="flex items-center gap-1.5 px-2 text-[11px] font-bold text-muted transition-colors hover:text-body">
      <Mascot size={16} /> Feito com a <span className="font-black text-brand">udacha</span>
    </Link>
  )
}

/** No telemóvel (sem barra lateral): uma faixa fina com o logótipo, no topo das páginas */
export function CompanyLogoBar() {
  const brand = useBrand()
  const org = useOrg()
  const logo = brand?.theme.logo
  if (!logo || !org) return null
  return (
    <div className="flex h-11 items-center justify-center border-b-2 border-line bg-white/90 px-4 backdrop-blur lg:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brandImageUrl(org.org.id, logo)} alt={org.org.name} className="max-h-7 max-w-[60%] object-contain" />
    </div>
  )
}
