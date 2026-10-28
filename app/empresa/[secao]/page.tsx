'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { SECTIONS } from '../../lib/nav'
import CompanyPage from '../_components/CompanyPage'

/** /empresa/tarefas, /empresa/pessoas, … (a visão geral é /empresa) */
export default function CompanySectionPage() {
  const { secao } = useParams<{ secao: string }>()
  const router = useRouter()
  const section = SECTIONS.find(s => s.id === secao && s.id !== 'geral')

  useEffect(() => {
    if (!section) router.replace('/empresa')
  }, [section, router])

  return section ? <CompanyPage section={section.id} /> : null
}
