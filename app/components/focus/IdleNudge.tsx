'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { formatDuration, todaySeconds } from '../../lib/stats'
import { pushNotification, sounds } from '../../lib/sounds'
import { nudgeMessage } from '../../lib/nudges'
import { api } from '../../lib/api'
import Mascot from '../ui/Mascot'

/**
 * Lembrete de inactividade com a app aberta: sem cronómetro a correr durante o intervalo
 * escolhido, o Marcos reclama (notificação + janela no ecrã). Com a app fechada, quem envia
 * é o servidor por push (lib/server/reminders.ts), com as mesmas regras.
 */
export default function IdleNudge() {
  const { allSessions, timer, now, settings, tasks, startTimer } = useApp()
  const org = useOrg()
  const router = useRouter()
  const [shown, setShown] = useState<{ title: string; body: string } | null>(null)
  const startedAt = useRef(0)
  const lastNudge = useRef(0)
  const count = useRef(0)

  useEffect(() => { startedAt.current = Date.now() }, [])

  const running = !!timer?.segmentStart
  const interval = settings.idleReminderMinutes * 60 * 1000
  const goalReached = todaySeconds(allSessions, now) >= settings.dailyGoalMinutes * 60
  const lastWork = allSessions.reduce((m, s) => Math.max(m, s.end), 0)

  useEffect(() => {
    // a trabalhar outra vez: volta à primeira frase
    if (running) count.current = 0
  }, [running])

  useEffect(() => {
    if (!interval || running || goalReached || !startedAt.current) return
    const hour = new Date(now).getHours()
    if (hour < settings.reminderStartHour || hour >= settings.reminderEndHour) return
    // na empresa só reclama de quem está marcado como "a trabalhar"
    if (org && org.presence !== 'trabalho') return

    const since = Math.max(lastWork, startedAt.current, lastNudge.current)
    if (now - since < interval) return

    const idleFor = formatDuration((now - Math.max(lastWork, startedAt.current)) / 1000)
    lastNudge.current = now
    const show = (n: number) => {
      const message = nudgeMessage(n, idleFor)
      // mesma etiqueta do push do servidor: o sistema substitui em vez de duplicar
      pushNotification(message.title, message.body, 'idle-nudge', '/foco')
      if (settings.sound) sounds.gentle()
      setShown(message)
    }
    // regista no servidor (para não repetir por push) e usa a contagem de lá
    api<{ count: number }>('/api/me/nudge', { method: 'POST' })
      .then(r => show(r.count))
      .catch(() => show(count.current))
    count.current++
  }, [now, interval, running, goalReached, lastWork, org, settings.reminderStartHour, settings.reminderEndHour, settings.sound])

  if (!shown) return null
  const next = tasks.find(t => t.status === 'doing') ?? tasks.find(t => t.status === 'todo')

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-ink/40 p-5 backdrop-blur-sm animate-fade-in" onClick={() => setShown(null)}>
      <div
        role="alertdialog"
        aria-labelledby="nudge-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl animate-bubble"
        style={{ transformOrigin: 'center' }}
      >
        <div className="mx-auto w-fit animate-shake">
          <Mascot size={130} mood="sad" animated />
        </div>
        <h2 id="nudge-title" className="mt-3 text-2xl font-black text-ink">{shown.title}</h2>
        <p className="mt-1 font-semibold text-muted">{shown.body}</p>
        <button
          onClick={() => {
            setShown(null)
            if (next) startTimer(next.id)
            router.push('/foco')
          }}
          className="btn btn-primary mt-6 w-full py-4 text-base"
          autoFocus
        >
          <PlayIcon size={18} weight="fill" /> {next ? `Focar em “${next.title.length > 22 ? next.title.slice(0, 22) + '…' : next.title}”` : 'Vamos focar'}
        </button>
        <button onClick={() => setShown(null)} className="btn btn-ghost mt-3 w-full text-body">Agora não</button>
      </div>
    </div>
  )
}
