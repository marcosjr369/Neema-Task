'use client'

import { useState } from 'react'
import { SignOutIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import Modal from '../ui/Modal'

type Variant = 'button' | 'icon' | 'menu'

/** Terminar sessão, com confirmação. Ao sair, a app volta ao ecrã de entrada. */
export default function LogoutButton({ variant = 'button', className = '' }: { variant?: Variant; className?: string }) {
  const { logout, user } = useAccount()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const trigger =
    variant === 'icon' ? (
      <button
        onClick={() => setAsking(true)}
        aria-label="Terminar sessão"
        title="Terminar sessão"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-danger-light hover:text-danger cursor-pointer ${className}`}
      >
        <SignOutIcon size={20} />
      </button>
    ) : variant === 'menu' ? (
      <button
        onClick={() => setAsking(true)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left font-bold text-danger hover:bg-danger-light cursor-pointer ${className}`}
      >
        <SignOutIcon size={20} /> Terminar sessão
      </button>
    ) : (
      <button onClick={() => setAsking(true)} className={`btn btn-ghost text-danger ${className}`}>
        <SignOutIcon size={18} /> Terminar sessão
      </button>
    )

  return (
    <>
      {trigger}
      {asking && (
        <Modal
          title="Terminar sessão?"
          onClose={() => setAsking(false)}
          footer={
            <div className="space-y-3">
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await logout()
                }}
                className="btn btn-danger w-full"
              >
                <SignOutIcon size={18} /> {busy ? 'A sair…' : 'Terminar sessão'}
              </button>
              <button onClick={() => setAsking(false)} className="btn btn-ghost w-full">Cancelar</button>
            </div>
          }
        >
          <p className="font-semibold text-muted">
            Vais sair da conta{user ? ` ${user.email}` : ''}. Os teus dados ficam guardados e voltas a vê-los quando entrares outra vez.
          </p>
        </Modal>
      )}
    </>
  )
}
