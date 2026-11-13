'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowRightIcon, GraduationCapIcon, XIcon } from '@phosphor-icons/react'
import LessonPlayer from './LessonPlayer'
import Mascot from '../ui/Mascot'
import Confetti from '../ui/Confetti'
import { useAccount } from '../../context/AccountContext'
import { useOrg } from '../../context/OrgContext'
import { navModeOf } from '../../lib/nav'
import { lessonsFor, welcomeLessons } from '../../lib/tutorial'

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
  const all = useMemo(() => lessonsFor(mode), [mode])
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-6 animate-fade-in" role="dialog" aria-modal aria-label="Boas-vindas à Udacha">
      {slide === last && <Confetti count={70} />}
      <div className="relative flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl animate-dg-rise">
        {/* progresso */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {Array.from({ length: last + 1 }, (_, i) => (
            <span key={i} className="h-1 flex-1 rounded-full transition-colors duration-500" style={{ background: i <= slide ? (lessons[i - 1]?.color ?? '#7B61FF') : '#E9E7F2' }} />
          ))}
          <button onClick={() => close()} aria-label="Fechar" className="ml-2 rounded-xl p-1.5 text-muted hover:bg-snow cursor-pointer"><XIcon size={20} /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-3 sm:px-7">
          {slide === 0 && (
            <div key="hello" className="flex flex-col items-center py-4 text-center animate-dg-rise">
              <Mascot size={130} wave animated />
              <h2 className="mt-3 text-2xl font-black text-ink">Olá, {first}! 👋</h2>
              <p className="mt-1 max-w-sm font-semibold text-body">Bem-vindo à Udacha. Em menos de um minuto mostramos-te o essencial, com pequenas animações.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {lessons.map((l, i) => (
                  <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full bg-snow px-3 py-1 text-sm font-bold text-body animate-pop-in" style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
                    <l.icon size={15} weight="bold" style={{ color: l.color }} /> {l.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lesson && (
            <div key={lesson.id} className="animate-dg-rise">
              <div className="mb-3 flex items-center gap-2">
                <lesson.icon size={20} weight="bold" style={{ color: lesson.color }} />
                <h2 className="text-lg font-black text-ink">{lesson.title}</h2>
                <span className="ml-auto text-xs font-bold text-muted">{slide} de {lessons.length}</span>
              </div>
              <LessonPlayer lesson={lesson} variant="compact" onComplete={() => updateTutorial({ done: lesson.id })} />
            </div>
          )}

          {slide === last && (
            <div key="end" className="flex flex-col items-center py-4 text-center animate-dg-rise">
              <Mascot size={120} pose="celebrate" animated />
              <h2 className="mt-3 text-2xl font-black text-ink">Tudo pronto!</h2>
              <p className="mt-1 max-w-sm font-semibold text-body">Há uma lição animada para cada funcionalidade. Encontras o tutorial no menu, sempre que precisares.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-4">
                {all.map((l, i) => (
                  <span key={l.id} title={l.title} className="animate-pop-in" style={{ color: l.color, animationDelay: `${i * 0.06}s` }}>
                    <l.icon size={22} weight="bold" />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t-2 border-line px-5 py-4 sm:px-7">
          {slide === 0 && (
            <>
              <button onClick={() => close()} className="btn btn-ghost flex-1">Agora não</button>
              <button onClick={() => setSlide(1)} className="btn btn-primary flex-1">Mostrar-me <ArrowRightIcon size={18} /></button>
            </>
          )}
          {lesson && (
            <>
              <button onClick={() => setSlide(s => s - 1)} className="btn btn-ghost">Voltar</button>
              <button onClick={() => setSlide(s => s + 1)} className="btn btn-primary flex-1">{slide === lessons.length ? 'Concluir' : 'Seguinte'} <ArrowRightIcon size={18} /></button>
            </>
          )}
          {slide === last && (
            <>
              <button onClick={() => close('/tutorial')} className="btn btn-ghost flex-1"><GraduationCapIcon size={18} /> Tutorial completo</button>
              <button onClick={() => close()} className="btn btn-primary flex-1">Começar a usar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
