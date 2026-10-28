'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BuildingsIcon, ChartBarIcon } from '@phosphor-icons/react'
import { useAccount } from '../context/AccountContext'
import { useApp } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import { api, errorText } from '../lib/api'
import { COMPANY_ACCOUNT_LABEL, ROLE_LABEL, type RankingVisibility } from '../types'
import Avatar from '../components/ui/Avatar'
import WorkspaceSwitcher from '../components/account/WorkspaceSwitcher'
import LogoutButton from '../components/account/LogoutButton'

const VISIBILITY: { id: RankingVisibility; label: string; desc: string }[] = [
  { id: 'nome', label: 'Nome', desc: 'Nome e foto' },
  { id: 'iniciais', label: 'Iniciais', desc: 'Só as iniciais' },
  { id: 'oculto', label: 'Oculto', desc: 'Não aparecer' },
]

export default function AccountSection() {
  const account = useAccount()
  const { showToast } = useApp()
  const org = useOrg()
  const [busy, setBusy] = useState(false)
  const { user } = account

  if (!user) return null

  const setVisibility = async (v: RankingVisibility) => {
    try {
      await account.updateMe({ rankingVisibility: v })
      showToast('Privacidade actualizada', 'success')
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
  }

  const leaveOrg = async () => {
    if (!org || !confirm(`Sair da ${org.org.name}? Deixas de ver as tarefas da empresa.`)) return
    setBusy(true)
    try {
      await api(`${org.base}/members/${org.me.id}`, { method: 'DELETE' })
      // sem outra empresa, a conta volta à entrada para criar ou entrar numa
      await account.refresh()
      showToast('Saíste da empresa', 'info')
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
    setBusy(false)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-ink">Conta</h2>
      <div className="card divide-y-2 divide-line">
        <div className="flex items-center gap-3 p-4">
          <Avatar name={user.name} picture={user.picture} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black text-ink">{user.name}</p>
            <p className="truncate text-sm font-semibold text-muted">{user.email}</p>
          </div>
        </div>
        <div className="p-4">
          <LogoutButton className="w-full" />
        </div>
        {account.accountType === 'personal' && (
          <div className="p-4">
            <p className="label">Convite de uma empresa</p>
            <Link href="/entrar?passo=codigo" className="btn btn-ghost w-full text-accent">Tenho um código de convite</Link>
          </div>
        )}
        {account.accountType === 'business' && (
          <div className="p-4">
            <p className="label">Empresa activa</p>
            <WorkspaceSwitcher />
          </div>
        )}
        {!org && (
          <div className="p-4">
            <p className="label">Como apareço no ranking das contas pessoais</p>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVisibility(v.id)}
                  className={`chip flex-col justify-center gap-0 py-2 ${user.rankingVisibility === v.id ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}
                >
                  <span>{v.label}</span>
                  <span className="text-[11px] font-semibold opacity-70">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {org?.isCompany && (
          <div className="flex items-center gap-3 p-4">
            <BuildingsIcon size={22} className="text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-ink">{org.org.name}</p>
              <p className="truncate text-sm font-semibold text-muted">{COMPANY_ACCOUNT_LABEL}</p>
            </div>
            <Link href="/empresa/definicoes" className="btn btn-ghost shrink-0 px-3 text-sm">Definições</Link>
          </div>
        )}
        {org && !org.isCompany && (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <BuildingsIcon size={22} className="text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-ink">{org.org.name}</p>
                <p className="truncate text-sm font-semibold text-muted">
                  {ROLE_LABEL[org.me.role]}{org.deptById(org.me.departmentId) ? ` · ${org.deptById(org.me.departmentId)!.name}` : ''}
                  {org.me.jobTitle ? ` · ${org.me.jobTitle}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/empresa/membro/${org.me.id}`} className="btn btn-ghost flex-1 text-sm">
                <ChartBarIcon size={16} /> O meu tempo
              </Link>
              {/* só quem foi convidado ou adicionado pode sair; quem criou a empresa é o dono */}
              {org.org.createdBy !== user.id && (
                <button onClick={leaveOrg} disabled={busy} className="btn btn-ghost flex-1 text-sm text-danger">
                  Sair da empresa
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
