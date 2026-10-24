'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, FireIcon, LightningIcon, StarIcon, TargetIcon, type Icon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { achievements, isUnlocked } from '../../lib/achievements'
import { completedTime } from '../../lib/points'
import { computeStreak, formatDuration, levelInfo, startOfDay, todaySeconds, totalXp } from '../../lib/stats'
import { pushNotification, sounds } from '../../lib/sounds'
import Mascot from '../ui/Mascot'
import Confetti from '../ui/Confetti'

type Milestone = { id: string; icon: Icon; color: string; title: string; subtitle: string; badge?: string }

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100]
const TASK_MILESTONES = [5, 10, 20]

type Snapshot = { day: number; goal: boolean; level: number; streak: number; unlocked: Set<string>; tasksToday: number }

/**
 * Celebra metas no centro do ecrã: meta diária, novo nível, sequência de dias,
 * conquistas e tarefas do dia. Compara com o estado anterior, por isso só celebra
 * o que acontece durante a sessão (recarregar a página não repete celebrações).
 */
export default function MilestoneCelebration() {
  const { ready, allSessions, tasks, now, settings, celebration } = useApp()
  const [queue, setQueue] = useState<Milestone[]>([])
  const prev = useRef<Snapshot | null>(null)

  const day = startOfDay(now)
  const today = todaySeconds(allSessions, now)
  const goalSeconds = settings.dailyGoalMinutes * 60
  const goal = today >= goalSeconds
  const xp = totalXp(allSessions, tasks)
  const level = levelInfo(xp).level
  const { streak } = computeStreak(allSessions, tasks, now)
  const list = achievements(allSessions, tasks)
  const unlockedIds = list.filter(isUnlocked).map(a => a.id).join(',')
  const tasksToday = tasks.filter(t => (completedTime(t) ?? 0) >= day).length

  useEffect(() => {
    if (!ready) return
    const unlocked = new Set(unlockedIds ? unlockedIds.split(',') : [])
    const snap: Snapshot = { day, goal, level, streak, unlocked, tasksToday }
    const before = prev.current
    prev.current = snap
    // primeira leitura (ou dia novo): só regista o ponto de partida
    if (!before || before.day !== day) return

    const found: Milestone[] = []
    if (goal && !before.goal) {
      found.push({
        id: `goal-${day}`, icon: TargetIcon, color: '#12B5A6',
        title: 'Meta diária cumprida!', subtitle: `Focaste ${formatDuration(today)} hoje. O Marcos está orgulhoso!`,
      })
    }
    if (level > before.level) {
      found.push({
        id: `level-${level}`, icon: StarIcon, color: '#7B61FF',
        title: `Nível ${level}!`, subtitle: 'Subiste de nível. Continua assim!', badge: `${xp} XP`,
      })
    }
    const streakHit = STREAK_MILESTONES.find(m => streak >= m && before.streak < m)
    if (streakHit) {
      found.push({
        id: `streak-${streakHit}`, icon: FireIcon, color: '#FF8A3D',
        title: `${streakHit} dias seguidos!`, subtitle: 'Estás em chamas. Não quebres a sequência!',
      })
    }
    for (const a of list) {
      if (unlocked.has(a.id) && !before.unlocked.has(a.id)) {
        found.push({ id: `ach-${a.id}`, icon: a.icon, color: a.color, title: 'Conquista desbloqueada!', subtitle: `${a.title}: ${a.desc.toLowerCase()}.` })
      }
    }
    const tasksHit = TASK_MILESTONES.find(m => tasksToday >= m && before.tasksToday < m)
    if (tasksHit) {
      found.push({
        id: `tasks-${day}-${tasksHit}`, icon: CheckCircleIcon, color: '#4C7DFF',
        title: `${tasksHit} tarefas hoje!`, subtitle: 'Que dia produtivo. Mereces uma pausa!',
      })
    }
    if (found.length) {
      setQueue(q => [...q, ...found.filter(f => !q.some(x => x.id === f.id))])
      if (document.hidden) pushNotification(found[0].title, found[0].subtitle, `milestone-${found[0].id}`, '/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `list` e `today` derivam dos valores observados
  }, [ready, day, goal, level, streak, unlockedIds, tasksToday])

  // espera que a celebração da tarefa concluída feche
  const current = celebration ? null : queue[0]

  useEffect(() => {
    if (current && settings.sound) sounds.success()
  }, [current, settings.sound])

  if (!current) return null
  const BadgeIcon = current.icon
  const close = () => setQueue(q => q.slice(1))

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-ink/50 p-5 backdrop-blur-sm animate-fade-in" onClick={close}>
      <Confetti key={current.id} />
      <div
        key={current.id}
        role="alertdialog"
        aria-labelledby="milestone-title"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl animate-bubble"
        style={{ transformOrigin: 'center' }}
      >
        {/* raios a girar atrás da mascote */}
        <div className="relative flex h-56 items-end justify-center overflow-hidden" style={{ background: `${current.color}18` }}>
          <div
            className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow opacity-60"
            style={{ background: `repeating-conic-gradient(${current.color}33 0deg 12deg, transparent 12deg 30deg)` }}
          />
          <div className="relative mb-3">
            <Mascot size={150} mood="excited" bounce wave />
          </div>
          <span
            className="absolute right-[calc(50%-96px)] top-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_4px_0_#0002] animate-pop-in"
            style={{ background: current.color, animationDelay: '250ms' }}
          >
            <BadgeIcon size={30} weight="fill" />
          </span>
        </div>
        <div className="px-6 pb-6 pt-5">
          <h2 id="milestone-title" className="text-3xl font-black tracking-tight animate-rise" style={{ color: current.color, animationDelay: '150ms' }}>
            {current.title}
          </h2>
          <p className="mt-2 font-semibold text-body animate-rise" style={{ animationDelay: '300ms' }}>{current.subtitle}</p>
          {current.badge && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-xl bg-gold/20 px-3 py-1 font-black text-gold-dark animate-rise" style={{ animationDelay: '400ms' }}>
              <LightningIcon size={18} weight="fill" /> {current.badge}
            </span>
          )}
          <button onClick={close} className="btn btn-accent mt-6 w-full py-4 text-base" autoFocus>
            {queue.length > 1 ? 'Seguinte' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
