'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Task } from '../types'

function playDeadlineAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.18, ctx.currentTime)
    master.connect(ctx.destination)

    const tone = (
      freq: number,
      start: number,
      dur: number,
      type: OscillatorType = 'sine',
      vol = 1,
    ) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      g.gain.setValueAtTime(0, ctx.currentTime + start)
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }

    // Três bipes descendentes urgentes
    tone(880, 0.0, 0.12, 'square', 0.9)
    tone(880, 0.18, 0.12, 'square', 0.9)
    tone(660, 0.36, 0.12, 'square', 0.9)
    tone(660, 0.54, 0.12, 'square', 0.9)
    tone(440, 0.72, 0.25, 'square', 1.0)

    // Shimmer de alerta por baixo
    const shimmer = ctx.createOscillator()
    const shimG = ctx.createGain()
    shimmer.type = 'sawtooth'
    shimmer.frequency.setValueAtTime(220, ctx.currentTime)
    shimmer.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.9)
    shimG.gain.setValueAtTime(0.08, ctx.currentTime)
    shimG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.95)
    shimmer.connect(shimG)
    shimG.connect(master)
    shimmer.start(ctx.currentTime)
    shimmer.stop(ctx.currentTime + 1.0)
  } catch {
    // silently ignore se o áudio não estiver disponível
  }
}

// Som mais suave para aviso antecipado (5 min antes)
function playWarningSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.12, ctx.currentTime)
    master.connect(ctx.destination)

    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      g.gain.setValueAtTime(0, ctx.currentTime + start)
      g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }

    // Dois bipes suaves ascendentes
    tone(523, 0.0, 0.15)
    tone(659, 0.2, 0.2)
  } catch {
  }
}


export function useNotifications(
  tasks: Task[],
  onNotified: (taskId: string) => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warnedRef = useRef<Set<string>>(new Set())

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'default') {
      return await Notification.requestPermission()
    }
    return Notification.permission
  }, [])

  useEffect(() => {
    if (!('Notification' in window)) return
    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      if (Notification.permission !== 'granted') return

      const now = new Date()

      tasks.forEach(task => {
        if (!task.deadline || task.status === 'done') return

        const deadline = new Date(task.deadline)
        const diffMs = deadline.getTime() - now.getTime()

        // Prazo expirado → notificação + som de alerta urgente
        if (diffMs <= 0 && !task.notified) {
          new Notification('Prazo expirado! ⏰', {
            body: `A tarefa "${task.title}" está atrasada.`,
            icon: '/favicon.svg',
            tag: `expired-${task.id}`,
          })
          playDeadlineAlertSound()
          onNotified(task.id)
          return
        }

        // Menos de 5 minutos → aviso antecipado + som suave
        const warningKey = `warning-${task.id}`
        if (diffMs > 0 && diffMs <= 5 * 60 * 1000 && !warnedRef.current.has(warningKey)) {
          const minutesLeft = Math.ceil(diffMs / 60000)
          new Notification('Prazo se aproximando! ⚠️', {
            body: `"${task.title}" vence em ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''}.`,
            icon: '/favicon.svg',
            tag: warningKey,
          })
          playWarningSound()
          warnedRef.current.add(warningKey)
        }
      })
    }, 30 * 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [tasks, onNotified])

  return { requestPermission }
}
