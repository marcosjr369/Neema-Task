'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlusIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { isActivePath, navGroups, navModeOf, type NavItem } from '../../lib/nav'
import { COMPANY_ACCOUNT_LABEL } from '../../types'
import { levelInfo, totalXp } from '../../lib/stats'
import Mascot from '../ui/Mascot'
import Avatar from '../ui/Avatar'
import InstallCard from '../ui/InstallCard'
import WorkspaceSwitcher from '../account/WorkspaceSwitcher'
import PresencePicker from '../account/PresencePicker'
import LogoutButton from '../account/LogoutButton'

function NavLink({ item, badge }: { item: NavItem; badge?: React.ReactNode }) {
  const pathname = usePathname()
  const active = isActivePath(pathname, item.href, item.exact)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-[15px] font-extrabold transition-colors ${
        active ? 'border-brand/40 bg-brand-light text-brand-dark' : 'border-transparent text-body hover:bg-snow'
      }`}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
        style={{ background: active ? `${item.color}22` : 'transparent', color: active ? item.color : '#A3A0B8' }}
      >
        <Icon size={22} weight={active ? 'duotone' : 'bold'} />
      </span>
      {item.label}
      {badge}
    </Link>
  )
}

/** Navegação lateral (desktop) */
export default function SideNav() {
  const { timer, openTaskSheet, allSessions, tasks, history } = useApp()
  const { user } = useAccount()
  const org = useOrg()
  const reviews = org?.teamTasks.filter(t => t.review?.status === 'pending' && t.status === 'done').length ?? 0
  const { level } = levelInfo(totalXp(allSessions, tasks, history))

  const badgeFor = (href: string) => {
    if (href === '/foco' && timer) return <span className="ml-auto h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-label="Cronómetro a correr" />
    if (href === '/empresa/tarefas' && reviews > 0) {
      return <span className="ml-auto rounded-lg bg-danger px-2 text-xs font-black text-white" aria-label={`${reviews} por rever`}>{reviews}</span>
    }
    return null
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r-2 border-line bg-white px-4 py-5 lg:flex">
      <Link href="/" className="mb-5 flex items-center gap-2 px-2">
        <Mascot size={38} />
        <span className="text-xl font-black tracking-tight text-brand">udacha</span>
      </Link>

      <div className="space-y-2">
        <WorkspaceSwitcher />
        {org && !org.isCompany && <PresencePicker />}
      </div>

      <button onClick={() => openTaskSheet()} className="btn btn-primary mt-4 w-full">
        <PlusIcon size={20} /> Nova tarefa
      </button>

      <nav className="mt-5 space-y-5" aria-label="Navegação principal">
        {navGroups(navModeOf(org)).map(group => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-muted">{group.title}</p>
            <ul className="space-y-1">
              {group.items.map(item => (
                <li key={item.href}><NavLink item={item} badge={badgeFor(item.href)} /></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-5">
        <InstallCard compact />
        {user && (
          <div className="flex items-center gap-1 rounded-2xl border-2 border-line p-1.5">
            <Link href="/perfil" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 transition-colors hover:bg-snow">
              <Avatar name={user.name} picture={user.picture} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-ink">{user.name}</span>
                <span className="block text-xs font-bold text-muted">{org?.isCompany ? COMPANY_ACCOUNT_LABEL : `Nível ${level} · Perfil`}</span>
              </span>
            </Link>
            <LogoutButton variant="icon" />
          </div>
        )}
        <p className="px-2 text-xs font-semibold text-muted">
          Atalho: <kbd className="rounded border-2 border-line px-1.5 font-bold">N</kbd> nova tarefa
        </p>
      </div>
    </aside>
  )
}
