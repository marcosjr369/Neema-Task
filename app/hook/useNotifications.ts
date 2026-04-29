'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Task } from '../types'

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

        if (diffMs <= 0 && !task.notified) {
          new Notification('Prazo expirado! ⏰', {
            body: `A tarefa "${task.title}" está atrasada.`,
            icon: '/favicon.ico',
            tag: `expired-${task.id}`,
          })
          onNotified(task.id)
          return
        }

        const warningKey = `warning-${task.id}`
        if (diffMs > 0 && diffMs <= 5 * 60 * 1000 && !warnedRef.current.has(warningKey)) {
          const minutesLeft = Math.ceil(diffMs / 60000)
          new Notification('Prazo se aproximando! ⚠️', {
            body: `"${task.title}" vence em ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''}.`,
            icon: '/favicon.ico',
            tag: warningKey,
          })
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
