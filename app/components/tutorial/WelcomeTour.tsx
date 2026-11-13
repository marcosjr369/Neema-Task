'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from '@phosphor-icons/react'
import LessonPlayer from './LessonPlayer'
import Mascot from '../ui/Mascot'
import { useAccount } from '../../context/AccountContext'
import { useOrg } from '../../context/OrgContext'
import { navModeOf } from '../../lib/nav'
import { welcomeLessons } from '../../lib/tutorial'

/** Botões desta janela: mais leves do que os .btn da app (sem maiúsculas nem relevo) */
const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-[15px] font-extrabold text-white transition-[background,transform] hover:bg-brand-dark active:scale-[0.98] cursor-pointer'
const QUIET = 'rounded-xl px-3 py-2 text-sm font-bold text-muted transition-colors hover:text-ink cursor-pointer'

/**
 * Boas-vindas depois do login: uma vez por conta (fica gravado em user.tutorial.seenAt).
 * Mostra as 3 lições essenciais do tipo de conta, com as cenas animadas, e no fim leva
 * ao tutorial completo. Espera pelo consentimento da empresa e pelos convites pendentes.
 */
export default function WelcomeTour() {
  const { user, invites, updateTutorial } = useAccount()
  const org = useOrg()
  const router = useRouter()
  const mode = navModeOf(org ? { isCompany: org.isCompany, isAdmin: org.isAdmin, isManager: org.isManager } : null)
  const lessons = useMemo(() => welcomeLessons(mode), [mode])
  const [slide, setSlide] = useState(0)

  const waiting = (org && !org.me.consentAt) || invites.length > 0
  if (!user || user.tutorial?.seenAt || waiting) return null

  const last = lessons.length + 1
  const close = (to?: string) => {
    updateTutorial({ seen: true })
    setSlide(0)
    if (to) router.push(to)
  }
  const first = user.name.split(' ')[0]
  const lesson = slide >= 1 && slide <= lessons.length ? lessons[slide - 1] : null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-6 animate-fade-in" role="dialog" aria-modal aria-label="Boas-vindas à Udacha">
      <div className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_24px_60px_-20px_rgb(43_40_64/0.45)] transition-[max-width] duration-300 sm:rounded-3xl animate-dg-rise ${lesson ? 'max-w-xl' : 'max-w-md'}`}>
        <button onClick={() => close()} aria-label="Fechar" className="absolute right-3 top-3 z-10 rounded-full p-2 text-muted transition-colors hover:bg-snow hover:text-ink cursor-pointer">
          <XIcon size={18} />
        </button>

        <div className="overflow-y-auto">
          {slide === 0 && (
            <div key="hello" className="animate-fade-in">
              <div className="flex justify-center bg-linear-to-b from-brand-light/70 to-white pb-2 pt-8">
                <Mascot size={112} wave animated />
              </div>
              <div className="px-7 pb-2 text-center">
                <h2 className="text-2xl font-black text-ink">Olá, {first} 👋</h2>
                <p className="mt-1 font-semibold text-muted">Mostramos-te o essencial em menos de um minuto.</p>
              </div>
              <ul className="mx-6 mt-4 space-y-1">
                {lessons.map((l, i) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 animate-dg-rise" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: l.light, color: l.color }}>
                      <l.icon size={18} weight="bold" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-extrabold text-ink">{l.title}</span>
                      <span className="block truncate text-sm font-semibold text-muted">{l.summary}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col items-center gap-1 px-6 pb-6 pt-5">
                <button onClick={() => setSlide(1)} className={`${PRIMARY} w-full`}>Começar <ArrowRightIcon size={18} weight="bold" /></button>
                <button onClick={() => close()} className={QUIET}>Agora não</button>
              </div>
            </div>
          )}

          {lesson && (
            <div key={lesson.id} className="px-6 pb-6 pt-5 animate-fade-in">
              <div className="mb-4 flex items-center gap-2 pr-10">
                <lesson.icon size={20} weight="bold" style={{ color: lesson.color }} />
                <h2 className="text-lg font-black text-ink">{lesson.title}</h2>
              </div>
              <LessonPlayer lesson={lesson} variant="compact" onComplete={() => updateTutorial({ done: lesson.id })} />
              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setSlide(s => s - 1)} className={`${QUIET} inline-flex items-center gap-1.5 -ml-3`}><ArrowLeftIcon size={16} /> Voltar</button>
                <span className="flex gap-1.5" aria-label={`${slide} de ${lessons.length}`}>
                  {lessons.map((l, i) => (
                    <span key={l.id} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === slide - 1 ? 18 : 6, background: i === slide - 1 ? lesson.color : '#E3E1EC' }} />
                  ))}
                </span>
                <button onClick={() => setSlide(s => s + 1)} className={PRIMARY}>{slide === lessons.length ? 'Concluir' : 'Seguinte'}</button>
              </div>
            </div>
          )}

          {slide === last && (
            <div key="end" className="animate-fade-in">
              <div className="flex justify-center bg-linear-to-b from-accent-light/70 to-white pb-2 pt-14">
                <Mascot size={112} pose="celebrate" animated />
              </div>
              <div className="px-7 text-center">
                <h2 className="text-2xl font-black text-ink">Tudo pronto!</h2>
                <p className="mt-1 font-semibold text-muted">Há uma lição para cada funcionalidade no Tutorial, no menu, sempre que precisares.</p>
              </div>
              <div className="flex flex-col items-center gap-1 px-6 pb-6 pt-6">
                <button onClick={() => close()} className={`${PRIMARY} w-full`}>Começar a usar</button>
                <button onClick={() => close('/tutorial')} className={QUIET}>Ver o tutorial completo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
