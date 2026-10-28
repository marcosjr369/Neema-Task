'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BuildingsIcon } from '@phosphor-icons/react'
import { useOrg } from '../../context/OrgContext'
import { sectionHref, visibleSections, type SectionId } from '../../lib/nav'
import { COMPANY_ACCOUNT_LABEL, ROLE_LABEL } from '../../types'
import Mascot from '../../components/ui/Mascot'
import Overview from './Overview'
import TeamTasks from './TeamTasks'
import People from './People'
import Departments from './Departments'
import Reports from './Reports'
import Settings from './Settings'

/**
 * Painel da empresa. Cada secção tem o seu endereço (/empresa, /empresa/pessoas, …):
 * no desktop navega-se pela sidebar; no telemóvel pelas abas do topo.
 */
export default function CompanyPage({ section }: { section: SectionId }) {
  const org = useOrg()
  const router = useRouter()
  const sections = visibleSections(!!org?.isAdmin)
  const allowed = sections.some(s => s.id === section)

  // secção só de administradores aberta por quem não é: volta à visão geral
  useEffect(() => {
    if (org?.isManager && !allowed) router.replace('/empresa')
  }, [org?.isManager, allowed, router])

  if (!org) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={110} />
        <h1 className="mt-4 text-2xl font-black text-ink">Área das empresas</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">
          Esta conta é pessoal. Para gerir uma equipa, cria uma conta de empresa com outro email.
        </p>
        <Link href="/" className="btn btn-primary mt-6">Voltar ao início</Link>
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

  if (!allowed) return null
  const current = sections.find(s => s.id === section)!
  const pending = org.teamTasks.filter(t => t.status === 'done' && t.review?.status === 'pending').length
  const goTo = (id: SectionId) => router.push(sectionHref(id))

  return (
    <div>
      <header className="sticky top-0 z-20 border-b-2 border-line bg-white/95 px-4 pt-4 backdrop-blur lg:px-0 lg:pb-4 lg:pt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-light text-accent-dark">
            <BuildingsIcon size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-ink">
              {/* no desktop a sidebar já diz onde estamos: o título é a secção */}
              <span className="lg:hidden">{org.org.name}</span>
              <span className="hidden lg:inline">{current.label}</span>
            </h1>
            <p className="truncate text-sm font-bold text-muted">
              <span className="hidden lg:inline">{org.org.name} · </span>
              {org.isCompany ? COMPANY_ACCOUNT_LABEL : ROLE_LABEL[org.me.role]}{org.org.sector ? ` · ${org.org.sector}` : ''} · {org.members.filter(m => m.status === 'activo').length} activos
            </p>
          </div>
        </div>
        <nav className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 lg:hidden" aria-label="Secções da empresa">
          {sections.map(s => (
            <Link
              key={s.id}
              href={s.href}
              aria-current={s.id === section ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-4 px-3 pb-2.5 pt-1 text-sm font-extrabold uppercase tracking-wide transition-colors ${
                s.id === section ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-body'
              }`}
            >
              {s.id === 'tarefas' ? 'Tarefas' : s.label}
              {s.id === 'tarefas' && pending > 0 && <span className="rounded-md bg-danger px-1.5 text-xs text-white">{pending}</span>}
            </Link>
          ))}
        </nav>
      </header>

      <div className="px-4 pt-5 lg:px-0">
        {org.error && <p className="card mb-4 bg-danger-light p-3 text-sm font-bold text-danger">{org.error}</p>}
        {section === 'geral' && <Overview goTo={goTo} />}
        {section === 'tarefas' && <TeamTasks />}
        {section === 'relatorios' && <Reports />}
        {section === 'pessoas' && <People />}
        {section === 'departamentos' && <Departments />}
        {section === 'definicoes' && <Settings />}
      </div>
    </div>
  )
}
