'use client'

import dynamic from 'next/dynamic'
import { useAccount } from '../../context/AccountContext'
import { useOrg } from '../../context/OrgContext'

/**
 * Decide se as boas-vindas aparecem. A janela (com o leitor e as cenas animadas) só é
 * descarregada quando é mesmo para mostrar: quase toda a gente já a viu, e assim não pesa
 * em todas as páginas.
 */
const WelcomeModal = dynamic(() => import('./WelcomeModal'), { ssr: false })

export default function WelcomeTour() {
  const { user, invites } = useAccount()
  const org = useOrg()
  // espera pelo consentimento da empresa e pelos convites pendentes
  const waiting = (org && !org.me.consentAt) || invites.length > 0
  if (!user || user.tutorial?.seenAt || waiting) return null
  return <WelcomeModal />
}
