'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BuildingsIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import { errorText } from '../../lib/api'
import Modal from '../ui/Modal'

/** Convite de uma empresa para uma conta que já existia: aceitar ou recusar */
export default function InviteDialog() {
  const { user, loading, invites, accountType, answerInvite } = useAccount()
  const pathname = usePathname()
  const router = useRouter()
  const [hidden, setHidden] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const invite = invites.find(i => !hidden.includes(i.member.id))
  if (loading || !user || !invite || pathname.startsWith('/marcos')) return null

  const close = () => {
    setHidden(h => [...h, invite.member.id])
    setConfirming(false)
    setError('')
  }
  const answer = async (accept: boolean) => {
    // conta pessoal: passa a conta de empresa, por isso confirma primeiro
    if (accept && accountType === 'personal' && !confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      await answerInvite(invite.member.id, accept, accept && accountType === 'personal')
      setConfirming(false)
      if (accept && pathname.startsWith('/entrar')) router.replace('/')
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <Modal
      title="Convite"
      onClose={close}
      footer={
        <div className="flex gap-2">
          <button onClick={() => (confirming ? setConfirming(false) : answer(false))} disabled={busy} className="btn btn-ghost flex-1 text-body">
            {confirming ? 'Voltar' : 'Recusar'}
          </button>
          <button onClick={() => answer(true)} disabled={busy} className="btn btn-primary flex-1">
            {busy ? 'Um momento…' : confirming ? 'Confirmar' : 'Aceitar'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center py-2 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent-dark">
          <BuildingsIcon size={34} weight="duotone" />
        </span>
        <p className="mt-3 text-lg font-black text-ink">{invite.org.name}</p>
        {invite.org.sector && <p className="text-sm font-bold text-muted">{invite.org.sector}</p>}
        <p className="mt-3 font-semibold text-body">
          {confirming ? 'A tua conta passa a ser de empresa. Os teus pontos e conquistas continuam contigo.' : 'Convidou-te para a equipa.'}
        </p>
        {error && <p className="mt-3 text-sm font-bold text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
