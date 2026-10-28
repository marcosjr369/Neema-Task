'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { BuildingsIcon, CaretUpDownIcon, CheckIcon, PlusIcon, SignInIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import Avatar from '../ui/Avatar'
import LogoutButton from './LogoutButton'

/** Conta activa: nas contas de empresa troca entre as empresas; nas pessoais só mostra a conta e sair */
export default function WorkspaceSwitcher() {
  const { user, accountType, businessRole, memberships, workspace, current, setWorkspace } = useAccount()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!user) {
    return (
      <Link href="/entrar" className="btn btn-ghost w-full text-brand">
        <SignInIcon size={18} /> Entrar
      </Link>
    )
  }

  const label = current ? current.org.name : 'Pessoal'
  const go = (fn: () => void) => {
    fn()
    setOpen(false)
    router.push('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-3 py-2 text-left hover:bg-snow cursor-pointer"
      >
        {current ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark">
            <BuildingsIcon size={20} />
          </span>
        ) : (
          <Avatar name={user.name} picture={user.picture} size={36} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black text-ink">{label}</span>
          <span className="block truncate text-xs font-bold text-muted">{current ? 'Empresa' : user.email}</span>
        </span>
        <CaretUpDownIcon size={18} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div role="menu" className="absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-xl animate-fade-in">
          {accountType === 'business' && memberships.map(({ org, member }) => {
            const sel = workspace.kind === 'org' && workspace.orgId === org.id
            return (
              <button
                key={org.id}
                role="menuitemradio"
                aria-checked={sel}
                onClick={() => go(() => setWorkspace({ kind: 'org', orgId: org.id, memberId: member.id }))}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left font-bold hover:bg-snow cursor-pointer"
              >
                <BuildingsIcon size={20} className="text-accent" />
                <span className="min-w-0 flex-1 truncate text-ink">{org.name}</span>
                {sel && <CheckIcon size={18} className="text-brand" />}
              </button>
            )
          })}
          {/* só a conta de uma empresa cria outra (funcionários, mesmo administradores, não) */}
          {businessRole === 'company' && (
            <Link
              href="/entrar?passo=criar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border-t-2 border-line px-3 py-2.5 text-sm font-extrabold uppercase tracking-wide text-accent hover:bg-snow"
            >
              <PlusIcon size={18} /> Criar outra empresa
            </Link>
          )}
          <div className={accountType === 'business' ? 'border-t-2 border-line' : ''}>
            <LogoutButton variant="menu" />
          </div>
        </div>
      )}
    </div>
  )
}
