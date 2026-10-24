'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { isActivePath, mobileNav } from '../../lib/nav'

export default function BottomNav() {
  const pathname = usePathname()
  const { timer } = useApp()
  const org = useOrg()
  const reviews = org?.teamTasks.filter(t => t.review?.status === 'pending' && t.status === 'done').length ?? 0

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t-2 border-line bg-white pb-[env(safe-area-inset-bottom)] sm:border-x-2 lg:hidden" aria-label="Navegação principal">
      <ul className="flex items-stretch justify-around px-1 py-1.5">
        {mobileNav(!!org?.isManager).map(({ href, label, icon: Icon, color }) => {
          const active = isActivePath(pathname, href)
          const dot = (href === '/foco' && timer) || (href === '/empresa' && reviews > 0)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="relative mx-auto flex max-w-16 flex-col items-center gap-0.5 rounded-xl py-1 transition-transform active:scale-90"
              >
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-xl transition-colors ${active ? '' : 'text-muted'}`}
                  style={active ? { background: `${color}1f`, color } : undefined}
                >
                  <Icon size={24} weight={active ? 'duotone' : 'bold'} />
                </span>
                <span className={`text-[10px] font-extrabold ${active ? 'text-ink' : 'text-muted'}`}>{label}</span>
                {dot && <span className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
