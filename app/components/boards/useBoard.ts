'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorText, throttled } from '../../lib/api'
import { applyOp, type BoardOp } from '../../lib/boards'
import { useAccount } from '../../context/AccountContext'
import { useApp } from '../../context/AppContext'
import type { Access, BoardPerson, BoardView } from '../../types'

export type BoardData = { board: BoardView; access: Access; people: BoardPerson[]; orgName?: string; requests: number }

const POLL = 15 * 1000
const newId = () => crypto.randomUUID()

/** Operações que criam algo: o id vai já do browser, para o cartão novo não "piscar" ao chegar a resposta */
const CREATES = new Set<BoardOp['type']>(['list.add', 'list.copy', 'card.add', 'card.copy', 'card.comment', 'label.add'])

export function useBoard(boardId: string) {
  const { user } = useAccount()
  const { showToast } = useApp()
  const [data, setData] = useState<BoardData | null>(null)
  const [error, setError] = useState<{ status: number; text: string } | null>(null)
  // cada alteração local aumenta a versão: respostas de leituras mais antigas são ignoradas
  const version = useRef(0)
  const inFlight = useRef(0)

  const load = useCallback(async () => {
    const v = version.current
    try {
      const res = await api<BoardData>(`/api/quadros/${boardId}`)
      if (v === version.current && inFlight.current === 0) setData(res)
      setError(null)
    } catch (err) {
      setError({ status: err instanceof ApiError ? err.status : 0, text: errorText(err, 'Não foi possível abrir o quadro.') })
    }
  }, [boardId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const id = setInterval(tick, POLL)
    const onFocus = throttled(load, 5000)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const run = useCallback(async (input: BoardOp) => {
    if (!user) return
    const op = CREATES.has(input.type) && !('id' in input && input.id) ? ({ ...input, id: newId() } as BoardOp) : input
    version.current++
    setData(d => {
      if (!d) return d
      const board = structuredClone(d.board)
      try {
        applyOp(board, op, { userId: user.id, name: user.name, now: Date.now(), newId, moderator: d.access === 'owner' })
      } catch {
        return d // o servidor responde com a mensagem
      }
      return { ...d, board }
    })
    inFlight.current++
    try {
      const res = await api<{ board: BoardView }>(`/api/quadros/${boardId}/ops`, { body: { op } })
      inFlight.current--
      // só a última resposta manda (outras alterações podem ter sido feitas entretanto)
      if (inFlight.current === 0) setData(d => (d ? { ...d, board: res.board } : d))
    } catch (err) {
      inFlight.current--
      showToast(errorText(err, 'Não foi possível guardar a alteração no quadro.'), 'danger')
      if (inFlight.current === 0) load()
    }
  }, [boardId, user, showToast, load])

  const patch = useCallback((fn: (d: BoardData) => BoardData) => setData(d => (d ? fn(d) : d)), [])

  return { data, error, load, run, patch }
}

export type RunOp = (op: BoardOp) => void
