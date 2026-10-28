'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SECTIONS, sectionHref } from '../lib/nav'
import CompanyPage from './_components/CompanyPage'

export default function CompanyOverviewPage() {
  const router = useRouter()
  // links antigos (/empresa?tab=pessoas) passam para o endereço da secção
  const [legacy] = useState(() => SECTIONS.find(s => s.id === new URLSearchParams(window.location.search).get('tab')))

  useEffect(() => {
    if (legacy) router.replace(sectionHref(legacy.id))
  }, [legacy, router])

  return legacy ? null : <CompanyPage section="geral" />
}
