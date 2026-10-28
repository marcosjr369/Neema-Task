'use client'

import { useState } from 'react'
import { ClockIcon, EyeIcon, PulseIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import { useOrg } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import Mascot from '../ui/Mascot'

/** Primeira entrada numa empresa: explicar e aceitar o registo de tempo */
export default function ConsentGate() {
  const org = useOrg()
  const { logout } = useAccount()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!org || org.me.consentAt) return null

  const accept = async () => {
    setBusy(true)
    try {
      await api(`${org.base}/consent`, { method: 'POST' })
      await org.refresh()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  const items = [
    { icon: <PulseIcon size={22} />, text: 'O teu estado ao longo do dia: a trabalhar, pausa, almoço, reunião, ausente.' },
    { icon: <ClockIcon size={22} />, text: 'O tempo que o cronómetro conta em cada tarefa da empresa.' },
    { icon: <EyeIcon size={22} />, text: 'Quem vê: o teu supervisor e os administradores. Tu vês sempre os mesmos dados.' },
    { icon: <ShieldCheckIcon size={22} />, text: 'No ranking só aparecem colegas desta empresa.' },
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-white p-5 animate-fade-in">
      <div className="w-full max-w-md py-6">
        <Mascot size={90} className="mx-auto" />
        <h1 className="mt-4 text-center text-2xl font-black text-ink">Bem-vindo à {org.org.name}</h1>
        <p className="mt-1 text-center font-semibold text-muted">Antes de começar, o que esta empresa regista:</p>
        <ul className="card mt-5 divide-y-2 divide-line">
          {items.map(i => (
            <li key={i.text} className="flex items-start gap-3 p-4 font-semibold text-body">
              <span className="text-accent">{i.icon}</span>
              {i.text}
            </li>
          ))}
        </ul>
        {error && <p className="mt-3 text-center text-sm font-bold text-danger">{error}</p>}
        <button onClick={accept} disabled={busy} className="btn btn-primary mt-6 w-full">
          {busy ? 'A guardar…' : 'Aceitar e continuar'}
        </button>
        <button onClick={() => logout()} className="btn btn-ghost mt-3 w-full text-body">
          Agora não (terminar sessão)
        </button>
      </div>
    </div>
  )
}
