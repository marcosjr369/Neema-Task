'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorText, throttled } from '../../lib/api'
import { applySheetOp, type SheetOp } from '../../lib/sheets/ops'
import { useApp } from '../../context/AppContext'
import type { Access, BoardPerson, SheetView } from '../../types'

export type SheetData = { sheet: SheetView; access: Access; people: BoardPerson[]; orgName?: string; requests: number }

const POLL = 10 * 1000
const newId = () => crypto.randomUUID()

/**
 * Planilha aberta: as alterações aplicam-se logo no ecrã e vão para o servidor em lotes
 * (enquanto um pedido está em curso, as seguintes juntam-se no próximo). As alterações dos
 * outros chegam por leitura periódica, quando não há nada por enviar.
 */
export function useSheet(id: string) {
  const { showToast } = useApp()
  const [data, setDataState] = useState<SheetData | null>(null)
  const current = useRef<SheetData | null>(null)
  const [error, setError] = useState<{ status: number; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const queue = useRef<SheetOp[]>([])
  const busy = useRef(false)
  const version = useRef(0)

  const setData = useCallback((d: SheetData) => {
    current.current = d
    setDataState(d)
  }, [])

  const load = useCallback(async () => {
    const v = version.current
    try {
      const res = await api<SheetData>(`/api/planilhas/${id}`)
      if (v === version.current && !busy.current && queue.current.length === 0) setData(res)
      setError(null)
    } catch (err) {
      setError({ status: err instanceof ApiError ? err.status : 0, text: errorText(err, 'Não foi possível abrir a planilha.') })
    }
  }, [id, setData])

  useEffect(() => {
    load()
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const t = setInterval(tick, POLL)
    const onFocus = throttled(load, 5000)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const flush = useCallback(async () => {
    if (busy.current || queue.current.length === 0) return
    busy.current = true
    setSaving(true)
    try {
      // o que for chegando enquanto um pedido está em curso vai no seguinte
      while (queue.current.length) {
        const ops = queue.current.splice(0, 50)
        await api(`/api/planilhas/${id}/ops`, { body: { ops } })
      }
    } catch (err) {
      queue.current = []
      showToast(errorText(err, 'Não foi possível guardar a alteração na planilha.'), 'danger')
      version.current++
      busy.current = false
      load()
    } finally {
      busy.current = false
      setSaving(false)
    }
  }, [id, load, showToast])

  /** Aplica no ecrã e envia. Devolve false se for inválida (e mostra o aviso). */
  const run = useCallback((input: SheetOp[]) => {
    const d = current.current
    if (!d || !input.length) return false
    // folhas novas levam o id daqui, para o servidor criar a mesma
    const ops = input.map(op => ((op.type === 'tab.add' || op.type === 'tab.import') && !op.id ? { ...op, id: newId() } : op))
    const sheet = structuredClone(d.sheet)
    try {
      for (const op of ops) applySheetOp(sheet, op, { now: Date.now(), newId })
    } catch (err) {
      showToast(errorText(err, 'Não foi possível guardar a alteração na planilha.'), 'danger')
      return false
    }
    version.current++
    setData({ ...d, sheet })
    queue.current.push(...ops)
    flush()
    return true
  }, [flush, setData, showToast])

  return { data, error, saving, load, run }
}
