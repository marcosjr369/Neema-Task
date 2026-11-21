'use client'

import { LockSimpleIcon } from '@phosphor-icons/react'
import { useOrg } from '../../context/OrgContext'
import { FEATURES, canUse } from '../../lib/permissions'
import type { FeatureKey } from '../../types'

/** No espaço da empresa: esta pessoa pode usar a funcionalidade? (no espaço pessoal, sempre) */
export function useCan(key: FeatureKey) {
  const org = useOrg()
  if (!org || !org.loaded) return true
  return canUse(org.org.permissions, org.departments, org.me, key)
}

/** Links do menu escondidos a esta pessoa (ex.: Jogos e Ranking sem permissão) */
export function useHiddenNav(): Set<string> {
  const org = useOrg()
  const out = new Set<string>()
  if (!org || !org.loaded) return out
  for (const [key, f] of Object.entries(FEATURES) as [FeatureKey, (typeof FEATURES)[FeatureKey]][]) {
    if (f.href && !canUse(org.org.permissions, org.departments, org.me, key)) out.add(f.href)
  }
  return out
}

/** Aviso discreto quando a pessoa não pode criar aqui */
export function CreateLocked({ feature }: { feature: FeatureKey }) {
  const can = useCan(feature)
  if (can) return null
  return (
    <p className="mb-5 flex items-center gap-2 rounded-2xl bg-snow px-3 py-2 text-sm font-bold text-muted">
      <LockSimpleIcon size={16} className="shrink-0" /> Na tua empresa, só algumas pessoas podem {FEATURES[feature].action}. Continuas a ver o que partilham contigo.
    </p>
  )
}

/** Página inteira bloqueada (Jogos, Ranking) */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const can = useCan(feature)
  if (can) return <>{children}</>
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-snow text-muted"><LockSimpleIcon size={32} /></span>
      <h1 className="mt-4 text-2xl font-black text-ink">{FEATURES[feature].name} desligado</h1>
      <p className="mt-1 max-w-sm font-semibold text-muted">A tua empresa não te deu permissão para {FEATURES[feature].action}. Se precisares, fala com um administrador.</p>
    </div>
  )
}
