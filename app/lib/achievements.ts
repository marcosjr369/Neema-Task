import { BrainIcon, ClockIcon, FireIcon, RocketIcon, TargetIcon, TrophyIcon, type Icon } from '@phosphor-icons/react'
import type { Session, Task } from '../types'
import { bestStreak, sumSeconds } from './stats'

export type Achievement = {
  id: string
  icon: Icon
  title: string
  desc: string
  value: number
  target: number
  color: string
}

/** Conquistas e o progresso actual de cada uma (usadas no Perfil e nas celebrações) */
export function achievements(sessions: Session[], tasks: Task[]): Achievement[] {
  const hours = sumSeconds(sessions) / 3600
  const done = tasks.filter(t => t.status === 'done' && t.review?.status !== 'pending').length
  const record = bestStreak(sessions, tasks)
  const longest = sessions.reduce((m, s) => Math.max(m, s.seconds), 0) / 60
  return [
    { id: 'primeiro-passo', icon: RocketIcon, title: 'Primeiro passo', desc: 'Concluir 1 tarefa', value: done, target: 1, color: '#7B61FF' },
    { id: 'produtivo', icon: TrophyIcon, title: 'Produtivo', desc: 'Concluir 25 tarefas', value: done, target: 25, color: '#E0A419' },
    { id: 'primeira-hora', icon: ClockIcon, title: 'Primeira hora', desc: '1 hora focada', value: hours, target: 1, color: '#12B5A6' },
    { id: 'maratonista', icon: BrainIcon, title: 'Maratonista', desc: '25 horas focadas', value: hours, target: 25, color: '#EC5BA6' },
    { id: 'em-chamas', icon: FireIcon, title: 'Em chamas', desc: 'Sequência de 7 dias', value: record, target: 7, color: '#FF8A3D' },
    { id: 'foco-profundo', icon: TargetIcon, title: 'Foco profundo', desc: 'Sessão de 50 min seguidos', value: longest, target: 50, color: '#F2545B' },
  ]
}

export const isUnlocked = (a: Achievement) => a.value >= a.target
