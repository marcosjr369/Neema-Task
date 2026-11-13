'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorText } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import type { Access, BoardPerson, DiagramView } from '../../types'
import type { DrawioHandle } from './DrawioFrame'

type Meta = { access: Access; rev: number; title: string; people: BoardPerson[]; orgName?: string; updatedByName?: string; requests: number }
type Res = Meta & { diagram?: DiagramView; unchanged?: true }

export type DiagramData = Meta & { diagram: DiagramView }
export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

const POLL = 15 * 1000
const DEBOUNCE = 1500
const RETRY = 10 * 1000

/**
 * Diagrama aberto. O editor manda o XML a cada alteração; juntamos as alterações seguidas e
 * gravamos o diagrama inteiro (com a versão "rev" em que nos baseámos). Se outra pessoa gravou
 * entretanto, o servidor recusa e mostramos o conflito em vez de apagar o trabalho dela.
 * Quem só vê recebe as versões novas sozinho; quem edita é avisado.
 */
export function useDiagram(id: string, editor: React.RefObject<DrawioHandle | null>) {
  const { showToast } = useApp()
  const [data, setData] = useState<DiagramData | null>(null)
  const [error, setError] = useState<{ status: number; text: string } | null>(null)
  const [state, setState] = useState<SaveState>('saved')
  const [conflict, setConflict] = useState<string | null>(null)
  /** outra pessoa gravou uma versão nova e nós não temos nada por gravar */
  const [remote, setRemote] = useState<{ rev: number; name?: string } | null>(null)

  const rev = useRef(0)
  const pending = useRef<string | null>(null)
  const saving = useRef(false)
  const blocked = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const access = useRef<Access | null>(null)

  const apply = useCallback((r: Res) => {
    access.current = r.access
    setData(prev => {
      const diagram = r.diagram ?? prev?.diagram
      if (!diagram) return prev
      const meta: Meta = { access: r.access, rev: r.rev, title: r.title, people: r.people, orgName: r.orgName, updatedByName: r.updatedByName, requests: r.requests }
      return { ...meta, diagram: { ...diagram, title: r.title } }
    })
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await api<Res>(`/api/diagramas/${id}`)
      // só na primeira vez: depois, a versão do editor só muda por check() ou resolve(),
      // senão gravaríamos por cima de alterações de outra pessoa sem dar pelo conflito
      if (!rev.current) rev.current = r.rev
      apply({ ...r, rev: rev.current })
      setError(null)
    } catch (err) {
      setError({ status: err instanceof ApiError ? err.status : 0, text: errorText(err) })
    }
  }, [id, apply])

  /** Verifica se há versão nova (sem trazer o XML quando não há) */
  const check = useCallback(async () => {
    if (blocked.current) return
    try {
      const r = await api<Res>(`/api/diagramas/${id}?rev=${rev.current}`)
      if (r.unchanged || !r.diagram) { apply(r); return }
      if (r.access === 'view') {
        rev.current = r.rev
        editor.current?.load(r.diagram.xml)
        apply(r)
      } else if (!pending.current && !saving.current) {
        apply({ ...r, diagram: undefined, rev: rev.current })
        setRemote({ rev: r.rev, name: r.updatedByName })
      }
    } catch { /* tenta na próxima */ }
  }, [id, apply, editor])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') check() }, POLL)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [load, check])

  const flush = useCallback(async (force = false) => {
    clearTimeout(timer.current)
    if (saving.current || (blocked.current && !force)) return
    let xml = pending.current
    if (xml === null) return
    // o que mudar a partir daqui fica para a gravação seguinte
    pending.current = null
    saving.current = true
    setState('saving')
    try {
      // a miniatura para a lista; se o editor não a der, grava-se sem ela
      let preview: string | undefined
      try {
        const out = await editor.current?.exportAs('svg')
        if (out) {
          preview = out.data
          if (out.xml) xml = out.xml
        }
      } catch { /* sem miniatura */ }
      const r = await api<{ rev: number; updatedAt: number }>(`/api/diagramas/${id}`, { method: 'PATCH', body: { xml, rev: rev.current, preview, force: force || undefined } })
      rev.current = r.rev
      blocked.current = false
      setConflict(null)
      setRemote(null)
      setData(d => (d ? { ...d, rev: r.rev, diagram: { ...d.diagram, updatedAt: r.updatedAt } } : d))
      setState(pending.current ? 'pending' : 'saved')
    } catch (err) {
      pending.current ??= xml
      if (err instanceof ApiError && err.status === 409) {
        blocked.current = true
        setConflict(err.message)
        setState('error')
      } else {
        setState('error')
        showToast(`Não foi possível gravar o diagrama: ${errorText(err)}`, 'danger')
        timer.current = window.setTimeout(() => flush(), RETRY)
      }
    } finally {
      saving.current = false
    }
    if (pending.current && !blocked.current) timer.current = window.setTimeout(() => flush(), DEBOUNCE)
  }, [id, editor, showToast])

  /** Alteração no editor */
  const changed = useCallback((xml: string) => {
    if (access.current === 'view') return
    pending.current = xml
    setRemote(null)
    if (blocked.current) return
    setState('pending')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flush(), DEBOUNCE)
  }, [flush])

  /** Ctrl+S: grava já */
  const saveNow = useCallback((xml: string) => {
    if (access.current === 'view') return
    pending.current = xml
    flush()
  }, [flush])

  /** Conflito ou versão nova: "theirs" abre a versão do servidor; "mine" grava a minha por cima */
  const resolve = useCallback(async (keep: 'theirs' | 'mine') => {
    if (keep === 'mine') { await flush(true); return }
    try {
      const r = await api<Res>(`/api/diagramas/${id}`)
      if (!r.diagram) return
      clearTimeout(timer.current)
      pending.current = null
      blocked.current = false
      rev.current = r.rev
      editor.current?.load(r.diagram.xml)
      apply(r)
      setConflict(null)
      setRemote(null)
      setState('saved')
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
  }, [id, apply, editor, flush, showToast])

  const rename = useCallback(async (title: string) => {
    const t = title.trim()
    if (!t) return
    setData(d => (d ? { ...d, title: t, diagram: { ...d.diagram, title: t } } : d))
    try {
      await api(`/api/diagramas/${id}`, { method: 'PATCH', body: { title: t } })
    } catch (err) {
      showToast(errorText(err), 'danger')
      load()
    }
  }, [id, load, showToast])

  // não deixar sair com alterações por gravar
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => { window.removeEventListener('beforeunload', onLeave); clearTimeout(timer.current) }
  }, [])

  return { data, error, state, conflict, remote, load, changed, saveNow, resolve, rename, flush }
}
