'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Mascot from '../../components/ui/Mascot'

/** Link de convite partilhável: /convite/ABC123 */
export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/entrar?codigo=${encodeURIComponent(code)}`)
  }, [code, router])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Mascot size={96} className="animate-bounce-soft" />
    </div>
  )
}
