'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DotsNineIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { isActivePath, mobileMore, mobileNav, navModeOf, type NavGroup } from '../../lib/nav'
import Modal from '../ui/Modal'
import LogoutButton from '../account/LogoutButton'
import { unseenFor, useUnseenShares, type UnseenCounts } from './useUnseenShares'

const Dot = ({ pulse = false }: { pulse?: boolean }) => (
  <span className={`absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white ${pulse ? 'animate-pulse' : ''}`} />
)

export default function BottomNav() {
  const pathname = usePathname()
  const { timer } = useApp()
  const { user } = useAccount()
  const org = useOrg()
  const [open, setOpen] = useState(false)
  const unseen = useUnseenShares(!!user)
  const reviews = org?.teamTasks.filter(t => t.review?.status === 'pending' && t.status === 'done' && org.canReview(t)).length ?? 0
  const reviewsHref = org?.isCompany ? '/empresa/tarefas' : '/empresa'
  const mode = navModeOf(org)
  const more = mobileMore(mode)
  const moreItems = more.flatMap(g => g.items)
  const moreActive = moreItems.some(i => isActivePath(pathname, i.href, i.exact))
  const moreNews = moreItems.some(i => unseenFor(unseen, i.href) > 0)

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t-2 border-line bg-white pb-[env(safe-area-inset-bottom)] sm:border-x-2 lg:hidden" aria-label="Navegação principal">
        <ul className="flex items-stretch justify-around px-1 py-1.5">
          {mobileNav(mode).map(({ href, label, icon: Icon, color, exact }) => {
            const active = isActivePath(pathname, href, exact)
            const dot = (href === '/foco' && timer) || (href === reviewsHref && reviews > 0)
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
                  {dot && <Dot pulse={href === '/foco'} />}
                </Link>
              </li>
            )
          })}
          <li className="flex-1">
            <button
              onClick={() => setOpen(true)}
              aria-label={moreNews ? 'Mais (há partilhas por ver)' : 'Mais'}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="relative mx-auto flex w-full max-w-16 cursor-pointer flex-col items-center gap-0.5 rounded-xl py-1 transition-transform active:scale-90"
            >
              <span
                className={`flex h-9 w-12 items-center justify-center rounded-xl transition-colors ${moreActive ? '' : 'text-muted'}`}
                style={moreActive ? { background: '#7B61FF1f', color: '#7B61FF' } : undefined}
              >
                <DotsNineIcon size={24} weight={moreActive ? 'duotone' : 'bold'} />
              </span>
              <span className={`text-[10px] font-extrabold ${moreActive ? 'text-ink' : 'text-muted'}`}>Mais</span>
              {moreNews && <Dot pulse />}
            </button>
          </li>
        </ul>
      </nav>
      {open && <MoreSheet groups={more} unseen={unseen} pathname={pathname} onClose={() => setOpen(false)} />}
    </>
  )
}

function MoreSheet({ groups, unseen, pathname, onClose }: { groups: NavGroup[]; unseen: UnseenCounts; pathname: string; onClose: () => void }) {
  return (
    <Modal title="Menu" onClose={onClose}>
      <div className="space-y-5 pb-[env(safe-area-inset-bottom)]">
        {groups.map(group => (
          <section key={group.title}>
            <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted">{group.title}</p>
            <ul className="grid grid-cols-3 gap-2">
              {group.items.map(({ href, label, icon: Icon, color, exact }, i) => {
                const active = isActivePath(pathname, href, exact)
                const fresh = unseenFor(unseen, href)
                return (
                  <li key={href} className="tut-in" style={{ '--d': `${Math.min(i, 6) * 35}ms` } as React.CSSProperties}>
                    <Link
                      href={href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      aria-label={fresh ? `${label} (${fresh === 1 ? '1 partilha por ver' : `${fresh} partilhas por ver`})` : label}
                      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-3 text-center transition-transform active:scale-95 ${
                        active ? 'border-brand/40 bg-brand-light' : 'border-line bg-white'
                      }`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}1f`, color }}>
                        <Icon size={24} weight="duotone" />
                      </span>
                      <span className={`text-xs font-extrabold leading-tight ${active ? 'text-brand-dark' : 'text-ink'}`}>{label}</span>
                      {fresh > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <LogoutButton className="w-full" />
      </div>
    </Modal>
  )
}
