'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BuildingsIcon } from '@phosphor-icons/react'
import { useOrg } from '../context/OrgContext'
import { ROLE_LABEL } from '../types'
import Mascot from '../components/ui/Mascot'
import Overview from './_components/Overview'
import TeamTasks from './_components/TeamTasks'
import People from './_components/People'
import Departments from './_components/Departments'
import Reports from './_components/Reports'
import Settings from './_components/Settings'

type Tab = { id: string; label: string; admin?: boolean }
const TABS: Tab[] = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'pessoas', label: 'Funcionários' },
  { id: 'departamentos', label: 'Departamentos', admin: true },
  { id: 'definicoes', label: 'Definições', admin: true },
]

export default function CompanyPage() {
  const org = useOrg()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') ?? 'geral')

  if (!org) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={110} />
        <h1 className="mt-4 text-2xl font-black text-ink">Usa com a tua equipa</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">
          Cria a empresa, organiza departamentos, atribui tarefas, aprova o trabalho e acompanha o tempo de cada pessoa.
        </p>
        <Link href="/entrar?passo=empresa" className="btn btn-primary mt-6">
          <BuildingsIcon size={18} /> Criar ou entrar em empresa
        </Link>
      </div>
    )
  }

  if (!org.isManager) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={100} mood="sleepy" />
        <h1 className="mt-4 text-xl font-black text-ink">Área de supervisores</h1>
        <p className="mt-1 max-w-xs font-semibold text-muted">Vê as tuas tarefas em Tarefas e a tua posição no Ranking.</p>
        <Link href={`/empresa/membro/${org.me.id}`} className="btn btn-ghost mt-6">Ver o meu relatório de tempo</Link>
      </div>
    )
  }

  const tabs = TABS.filter(t => !t.admin || org.isAdmin)
  const pending = org.teamTasks.filter(t => t.status === 'done' && t.review?.status === 'pending').length
  const select = (id: string) => {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', id)
    window.history.replaceState(window.history.state, '', url)
  }

  return (
    <div>
      <header className="sticky top-0 z-20 border-b-2 border-line bg-white/95 px-4 pt-4 backdrop-blur lg:px-0 lg:pt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-light text-accent-dark">
            <BuildingsIcon size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-ink">{org.org.name}</h1>
            <p className="truncate text-sm font-bold text-muted">
              {ROLE_LABEL[org.me.role]}{org.org.sector ? ` · ${org.org.sector}` : ''} · {org.members.filter(m => m.status === 'activo').length} activos
            </p>
          </div>
        </div>
        <nav className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => select(t.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-4 px-3 pb-2.5 pt-1 text-sm font-extrabold uppercase tracking-wide transition-colors cursor-pointer ${
                tab === t.id ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-body'
              }`}
            >
              {t.label}
              {t.id === 'tarefas' && pending > 0 && <span className="rounded-md bg-danger px-1.5 text-xs text-white">{pending}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="px-4 pt-5 lg:px-0">
        {org.error && <p className="card mb-4 bg-danger-light p-3 text-sm font-bold text-danger">{org.error}</p>}
        {tab === 'geral' && <Overview goTo={select} />}
        {tab === 'tarefas' && <TeamTasks />}
        {tab === 'relatorios' && <Reports />}
        {tab === 'pessoas' && <People />}
        {tab === 'departamentos' && org.isAdmin && <Departments />}
        {tab === 'definicoes' && org.isAdmin && <Settings />}
      </div>
    </div>
  )
}
