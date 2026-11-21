'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { api } from '../../lib/api'
import type { ShareKind } from '../../types'

export type UnseenCounts = Record<ShareKind, number>
const NONE: UnseenCounts = { board: 0, sheet: 0, diagram: 0, poll: 0 }

/** href do menu → tipo de recurso partilhável */
export const SHARED_NAV: Record<string, ShareKind> = { '/quadros': 'board', '/planilhas': 'sheet', '/diagramas': 'diagram', '/inqueritos': 'poll' }

/*
 * Um só pedido para todos os menus (o lateral e o do telemóvel estão montados ao mesmo tempo):
 * os contadores vivem aqui e quem os usa só subscreve.
 */
let counts = NONE
const listeners = new Set<() => void>()
let soon: ReturnType<typeof setTimeout> | undefined
let every: ReturnType<typeof setInterval> | undefined

function check() {
  if (document.visibilityState !== 'visible') return
  api<UnseenCounts>('/api/me/novidades')
    .then(c => {
      const next = { ...NONE, ...c }
      if (next.board === counts.board && next.sheet === counts.sheet && next.diagram === counts.diagram && next.poll === counts.poll) return
      counts = next
      listeners.forEach(l => l())
    })
    .catch(() => undefined)
}

/** um pequeno atraso: a página acabada de abrir marca o recurso como visto ao carregar */
function checkSoon() {
  clearTimeout(soon)
  soon = setTimeout(check, 1200)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    every = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    clearInterval(every)
    clearTimeout(soon)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    counts = NONE
  }
}

/**
 * Quadros, planilhas e diagramas partilhados contigo que ainda não abriste.
 * Atualiza ao mudar de página, ao voltar ao separador e a cada minuto.
 */
export function useUnseenShares(enabled: boolean): UnseenCounts {
  const pathname = usePathname()
  const value = useSyncExternalStore(enabled ? subscribe : noSubscribe, () => counts, () => NONE)
  useEffect(() => { if (enabled) checkSoon() }, [enabled, pathname])
  return enabled ? value : NONE
}

const noSubscribe = () => () => undefined

export const unseenFor = (c: UnseenCounts, href: string) => (SHARED_NAV[href] ? c[SHARED_NAV[href]] : 0)
