'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { SECTIONS } from '../../lib/nav'
import CompanyPage from '../_components/CompanyPage'

export default function CompanySectionPage() {
  const { secao } = useParams<{ secao: string }>()
  const router = useRouter()
  const section = SECTIONS.find(s => s.id === secao && s.id !== 'geral')

  useEffect(() => {
    if (secao === 'aparencia') router.replace('/empresa/definicoes?tab=aparencia')
    else if (!section) router.replace('/empresa')
  }, [section, secao, router])

  return section ? <CompanyPage section={section.id} /> : null
}
