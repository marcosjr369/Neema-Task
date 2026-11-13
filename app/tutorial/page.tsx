'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightIcon, CheckIcon } from '@phosphor-icons/react'
import LessonPlayer from '../components/tutorial/LessonPlayer'
import { useAccount } from '../context/AccountContext'
import { useOrg } from '../context/OrgContext'
import { navModeOf } from '../lib/nav'
import { lessonsFor } from '../lib/tutorial'

function TutorialContent() {
  const { user, updateTutorial } = useAccount()
  const org = useOrg()
  const router = useRouter()
  const params = useSearchParams()
  const lessons = useMemo(() => lessonsFor(navModeOf(org ? { isCompany: org.isCompany, isAdmin: org.isAdmin, isManager: org.isManager } : null)), [org])
  const done = useMemo(() => new Set(user?.tutorial?.done ?? []), [user])
  const wanted = params.get('licao')
  const [activeId, setActiveId] = useState<string>(() => (lessons.find(l => l.id === wanted) ?? lessons.find(l => !done.has(l.id)) ?? lessons[0]).id)
  const active = lessons.find(l => l.id === activeId) ?? lessons[0]

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o link (?licao=) muda a lição aberta
    if (wanted && lessons.some(l => l.id === wanted)) setActiveId(wanted)
  }, [wanted, lessons])

  // no telemóvel a lista é horizontal: mostra a lição aberta (sem mexer no scroll da página)
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const btn = nav?.querySelector<HTMLElement>('[aria-current="true"]')
    if (nav && btn && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2, behavior: 'smooth' })
  }, [activeId])

  const pick = (id: string) => {
    setActiveId(id)
    router.replace(`/tutorial?licao=${id}`, { scroll: false })
  }

  const finish = useCallback(() => updateTutorial({ done: active.id }), [active.id, updateTutorial])
  const count = lessons.filter(l => done.has(l.id)).length
  const index = lessons.indexOf(active)
  const nextLesson = index < lessons.length - 1 ? lessons[index + 1] : null

  return (
    <div className="px-4 pb-12 pt-6 lg:px-0 lg:pt-8">
      <header className="mb-6 flex items-end justify-between gap-4 lg:mb-10">
        <div>
          <h1 className="text-2xl font-black text-ink">Tutorial</h1>
          <p className="text-sm font-semibold text-muted">Cada funcionalidade em 4 passos.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold text-muted">{count} de {lessons.length} vistas</p>
          <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${(count / lessons.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        {/* lições: em linha no telemóvel, em coluna no computador */}
        <nav ref={navRef} aria-label="Lições" className="-mx-4 mb-6 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:mb-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-8 lg:flex-col">
            {lessons.map(l => {
              const on = l.id === active.id
              return (
                <li key={l.id} className="shrink-0">
                  <button onClick={() => pick(l.id)} aria-current={on}
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-[15px] font-bold transition-colors cursor-pointer ${on ? 'bg-snow text-ink' : 'text-muted hover:text-ink'}`}>
                    <l.icon size={18} weight={on ? 'bold' : 'regular'} style={{ color: on ? l.color : undefined }} />
                    <span className="flex-1">{l.title}</span>
                    {done.has(l.id) && <CheckIcon size={14} weight="bold" className="text-accent" aria-label="Vista" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <button onClick={() => updateTutorial({ reset: true })} className="mt-4 hidden px-3 text-sm font-bold text-muted transition-colors hover:text-ink lg:block cursor-pointer">
            Rever as boas-vindas
          </button>
        </nav>

        <section key={active.id} className="min-w-0 max-w-2xl animate-fade-in">
          <h2 className="text-xl font-black text-ink">{active.title}</h2>
          <p className="mb-5 text-sm font-semibold text-muted">{active.summary}</p>

          <LessonPlayer lesson={active} onComplete={finish} />

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm font-extrabold">
            <Link href={active.href} onClick={finish} className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80" style={{ color: active.color }}>
              Experimentar agora <ArrowRightIcon size={16} />
            </Link>
            {nextLesson && (
              <button onClick={() => { finish(); pick(nextLesson.id) }} className="text-muted transition-colors hover:text-ink cursor-pointer">
                Seguinte: {nextLesson.title}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function TutorialPage() {
  // useSearchParams precisa de Suspense para a página poder ser pré-gerada
  return <Suspense><TutorialContent /></Suspense>
}
