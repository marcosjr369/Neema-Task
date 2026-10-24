'use client'

import Link from 'next/link'
import { FireIcon, LightningIcon, TimerIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import PresencePicker from '../account/PresencePicker'
import { computeStreak, formatShort, levelInfo, todaySeconds, totalXp } from '../../lib/stats'

/** Barra superior com nível, sequência, XP e tempo de hoje */
export default function TopBar() {
  const { allSessions, tasks, now, timer } = useApp()
  const { streak, activeToday } = computeStreak(allSessions, tasks, now)
  const xp = totalXp(allSessions, tasks)
  const { level } = levelInfo(xp)
  const today = todaySeconds(allSessions, now)

  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-white/95 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/perfil" className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-brand px-2 text-sm font-black text-white" aria-label={`Nível ${level}`}>
          {level}
        </Link>
        <Link href="/estatisticas" className="flex items-center gap-1 font-extrabold" style={{ color: activeToday ? '#FF8A3D' : '#A3A0B8' }} aria-label={`Sequência de ${streak} dias`}>
          <FireIcon size={22} weight="fill" /> {streak}
        </Link>
        <Link href="/estatisticas" className="flex items-center gap-1 font-extrabold text-gold-dark" aria-label={`${xp} XP`}>
          <LightningIcon size={22} weight="fill" color="#FFC53D" /> {xp}
        </Link>
        <Link href="/foco" className="flex items-center gap-1 font-extrabold" style={{ color: timer ? '#F2545B' : '#12B5A6' }} aria-label="Tempo focado hoje">
          <TimerIcon size={22} /> {formatShort(today)}
        </Link>
        <PresencePicker compact />
      </div>
    </header>
  )
}
