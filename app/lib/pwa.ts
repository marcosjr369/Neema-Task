'use client'

import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Em desenvolvimento o service worker não guarda cache (atrapalhava o hot reload), só recebe push
  const url = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?dev=1'
  navigator.serviceWorker.register(url, { scope: '/' }).catch(() => {})
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/**
 * Estado da instalação da PWA.
 * - 'installed': já está a correr como app
 * - 'available': o browser permite instalar com um clique (Chrome/Edge/Android)
 * - 'ios': Safari no iPhone/iPad — instalação manual pelo botão Partilhar
 * - 'unavailable': browser sem suporte ou critérios ainda não cumpridos
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }, [deferred])

  const status = installed ? 'installed' : deferred ? 'available' : isIos() ? 'ios' : 'unavailable'
  return { status, install } as const
}
