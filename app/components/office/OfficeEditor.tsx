'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArmchairIcon, ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowLeftIcon, CameraIcon, CopyIcon, CubeIcon, CursorIcon, DeskIcon,
  MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PathIcon, SquareIcon, TrashIcon, type Icon,
} from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, apiUrl, errorText } from '../../lib/api'
import { departmentTree, indentedName } from '../../lib/org'
import {
  CHAIR_STYLES, CORRIDOR_COLOR, DESK_COLORS, DESK_STYLES, GUIDE_TYPES, MAX_GUIDE, MAX_ITEMS, MAX_ROOMS, MAX_SIZE, MIN_SIZE, ROOM_COLORS, SNAP,
  WALL_COLORS, chairStyle, deskSeats, deskStyle, emptyOffice, fits, freeSpot, itemSize,
  SEAT_LIMITS, arrangeDesk, chairAtDesk, misplaced, nearestDesk, nextSeatLabel, organizeAll, snap,
} from '../../lib/office'
import type { ChairStyle, DeskStyle, OfficeItem, OfficeMap, OfficeRoom } from '../../types'
import { Busy } from '../ui/Spinner'
import OfficeScene from './OfficeScene'

type Tool = 'select' | 'sala' | 'corredor' | 'mesa' | 'cadeira' | 'posto'
type Sel = { kind: 'room' | 'item'; id: string } | null
type Drag =
  | { type: 'draw'; kind: 'sala' | 'corredor'; x0: number; z0: number; x1: number; z1: number }
  | { type: 'move'; sel: NonNullable<Sel>; dx: number; dz: number; moved: boolean }
  | { type: 'resize'; id: string; moved: boolean }

const TOOLS: { id: Tool; label: string; hint: string; icon: Icon }[] = [
  { id: 'select', label: 'Selecionar', hint: 'Carrega para escolher; arrasta para mover. Delete apaga, R roda.', icon: CursorIcon },
  { id: 'sala', label: 'Sala', hint: 'Arrasta na planta para desenhar uma sala (com paredes).', icon: SquareIcon },
  { id: 'corredor', label: 'Corredor', hint: 'Arrasta para desenhar um corredor (só chão). As portas das salas abrem para os corredores.', icon: PathIcon },
  { id: 'posto', label: 'Posto', hint: 'Carrega para pôr uma mesa com uma cadeira.', icon: DeskIcon },
  { id: 'mesa', label: 'Mesa', hint: 'Carrega para pôr uma mesa.', icon: DeskIcon },
  { id: 'cadeira', label: 'Cadeira', hint: 'Carrega para pôr uma cadeira: é onde as pessoas se sentam.', icon: ArmchairIcon },
]

const uid = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const clone = (m: OfficeMap): OfficeMap => ({ ...m, rooms: m.rooms.map(r => ({ ...r })), items: m.items.map(i => ({ ...i })) })

/** Editor do mapa do escritório (só a conta da empresa): planta vista de cima, com pré-visualização 3D */
export default function OfficeEditor({ onClose }: { onClose: () => void }) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [map, setMap] = useState<OfficeMap>(() => clone(org.org.office ?? emptyOffice()))
  const [history, setHistory] = useState<OfficeMap[]>([])
  const [tool, setTool] = useState<Tool>(org.org.office?.rooms.length ? 'select' : 'sala')
  const [sel, setSelState] = useState<Sel>(null)
  // para onde o 3D se vira (calculado no momento da escolha: arrastar não volta a mexer a câmara)
  const [focus3d, setFocus3d] = useState<{ x: number; z: number; zoom: number } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // peça que se tentou arrastar para cima de outra (fica a vermelho até largar)
  const [blocked, setBlocked] = useState<string | null>(null)
  // em ecrãs largos, a planta e o 3D ficam lado a lado (o 3D acompanha as alterações)
  const [view, setView] = useState<'2d' | 'ambos' | '3d'>(() => (typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'ambos' : '2d'))
  const [newDesk, setNewDesk] = useState<DeskStyle>('escritorio')
  const [newChair, setNewChair] = useState<ChairStyle>('escritorio')
  const [newSeats, setNewSeats] = useState(SEAT_LIMITS.escritorio.def)
  const [zoom, setZoom] = useState(1)
  const [guideOpacity, setGuideOpacity] = useState(0.5)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'guide' | null>(null)
  const [error, setError] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const guideId = org.org.office?.guideId
  const guideUrl = guideId ? apiUrl(`${org.base}/mapa/guia?v=${encodeURIComponent(guideId)}`) : null

  const room = sel?.kind === 'room' ? map.rooms.find(r => r.id === sel.id) : undefined
  const item = sel?.kind === 'item' ? map.items.find(i => i.id === sel.id) : undefined

  // o mapa actual também numa ref: as alterações seguidas (arrastar) partem sempre do último
  const current = useRef(map)
  const historyRef = useRef(history)

  /** escolher uma sala ou peça (null: nenhuma); o 3D aproxima-se do que foi escolhido */
  const setSel = useCallback((s: Sel) => {
    setSelState(s)
    if (!s) return
    const m = current.current
    if (s.kind === 'room') {
      const r = m.rooms.find(x => x.id === s.id)
      if (r) setFocus3d({ x: r.x + r.w / 2, z: r.z + r.d / 2, zoom: Math.max(7, Math.max(r.w, r.d) * 1.3) })
    } else {
      const i = m.items.find(x => x.id === s.id)
      if (i) setFocus3d({ x: i.x, z: i.z, zoom: i.type === 'mesa' ? Math.max(5, itemSize(i).w * 2.5) : 4.5 })
    }
  }, [])
  useEffect(() => { historyRef.current = history }, [history])

  /** guarda o estado actual para poder anular (snapshot), e aplica a alteração */
  const edit = useCallback((fn: (m: OfficeMap) => OfficeMap, snapshot = true) => {
    const prev = current.current
    const next = fn(prev)
    current.current = next
    if (snapshot) setHistory(h => [...h.slice(-49), prev])
    setMap(next)
    setDirty(true)
  }, [])
  const undo = useCallback(() => {
    const h = historyRef.current
    if (!h.length) return
    const prev = h[h.length - 1]
    current.current = prev
    setMap(prev)
    setHistory(h.slice(0, -1))
    setDirty(true)
  }, [])

  const removeSel = useCallback(() => {
    if (!sel) return
    edit(m => (sel.kind === 'room' ? { ...m, rooms: m.rooms.filter(r => r.id !== sel.id) } : { ...m, items: m.items.filter(i => i.id !== sel.id) }))
    setSel(null)
  }, [sel, edit, setSel])
  /**
   * Encaixa a cadeira na mesa mais perto: à frente (ou atrás) dela, à distância certa e virada
   * para a mesa. Sem mesa perto ou sem espaço, fica como está (devolve false).
   */
  const alignChair = (id: string, snapshot = true) => {
    const m = current.current
    const c = m.items.find(i => i.id === id && i.type === 'cadeira')
    const d = c && nearestDesk(m.items, c.x, c.z)
    if (!c || !d) return false
    const target = { ...c, ...chairAtDesk(d, c.x, c.z) }
    const spot = freeSpot(m.items, target, m, new Set([c.id]), 1)
    if (!spot) return false
    if (target.x !== c.x || target.z !== c.z || target.rot !== c.rot || spot.x !== target.x || spot.z !== target.z) {
      edit(mm => ({ ...mm, items: mm.items.map(i => (i.id === c.id ? { ...target, ...spot } : i)) }), snapshot)
    }
    return true
  }

  /** rodar a peça; se assim não couber onde está, vai para o lugar livre mais perto */
  const rotateSel = useCallback((by: number) => {
    if (sel?.kind !== 'item') return
    const m = current.current
    const it = m.items.find(i => i.id === sel.id)
    if (!it) return
    const turned = { ...it, rot: (((it.rot + by) % 360) + 360) % 360 }
    const spot = freeSpot(m.items, turned, m, new Set([it.id]), 1.5)
    if (!spot) return setError('Rodada assim, esta peça ficava por cima de outra. Afasta-a primeiro.')
    setError('')
    edit(mm => ({ ...mm, items: mm.items.map(i => (i.id === it.id ? { ...turned, ...spot } : i)) }))
  }, [sel, edit])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel() }
      else if (e.key.toLowerCase() === 'r') rotateSel(e.shiftKey ? -90 : 90)
      else if (e.key === 'Escape') { setTool('select'); setSel(null) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [undo, removeSel, rotateSel, setSel])

  // sair com alterações por gravar
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** posição do rato em metros no piso */
  const at = (e: { clientX: number; clientY: number }) => {
    const ctm = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm)
    return { x: Math.min(map.width, Math.max(0, p.x)), z: Math.min(map.depth, Math.max(0, p.y)) }
  }

  /**
   * Põe uma ou mais peças (um posto = mesa + cadeira) sem ficarem por cima de nada: se não
   * couberem no sítio do clique, vão juntas para o lugar livre mais perto (até 2 m).
   */
  const addItems = (list: Omit<OfficeItem, 'id'>[]) => {
    const m0 = current.current
    if (m0.items.length + list.length > MAX_ITEMS) return setError(`No máximo ${MAX_ITEMS} mesas e cadeiras.`)
    const groupFits = (dx: number, dz: number) => {
      const placed = [...m0.items]
      for (const it of list) {
        const cand = { ...it, id: '_', x: it.x + dx, z: it.z + dz }
        if (!fits(placed, cand, m0)) return false
        placed.push(cand)
      }
      return true
    }
    let offset: { dx: number; dz: number } | null = null
    const steps = Math.round(2 / SNAP)
    for (let r = 0; r <= steps && !offset; r++) {
      const ring: { dx: number; dz: number; d: number }[] = []
      for (let a = -r; a <= r; a++) {
        for (let b = -r; b <= r; b++) if (Math.max(Math.abs(a), Math.abs(b)) === r) ring.push({ dx: a * SNAP, dz: b * SNAP, d: a * a + b * b })
      }
      ring.sort((p, q) => p.d - q.d)
      offset = ring.find(p => groupFits(p.dx, p.dz)) ?? null
    }
    if (!offset) return setError('Não há espaço livre aqui: as peças ficavam por cima de outras.')
    setError('')
    const off = offset
    const made = list.map(i => ({ ...i, id: uid(), x: i.x + off.dx, z: i.z + off.dz }))
    edit(m => {
      const items = [...m.items]
      for (const it of made) items.push(it.type === 'cadeira' ? { ...it, label: nextSeatLabel(items) } : it)
      return { ...m, items }
    })
    setSel({ kind: 'item', id: made[made.length - 1].id })
    return made
  }

  /** dá à mesa as suas cadeiras (e o tamanho para os lugares), sem criar um passo novo para anular */
  const arrange = (id: string) => {
    const res = arrangeDesk(current.current, id)
    if (!res) return setError('Aqui não há espaço para a mesa com todos os lugares. Afasta as peças à volta ou escolhe menos lugares.')
    edit(m => ({ ...m, items: res.items }), false)
    setError(res.skipped ? `${res.skipped} lugar${res.skipped === 1 ? '' : 'es'} não coube${res.skipped === 1 ? '' : 'ram'} (paredes ou outras peças à volta).` : '')
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const p = at(e)
    const target = (e.target as Element).closest('[data-room],[data-item],[data-resize]') as HTMLElement | null
    if (tool === 'sala' || tool === 'corredor') {
      if (map.rooms.length >= MAX_ROOMS) return setError(`No máximo ${MAX_ROOMS} salas e corredores.`)
      svg.current!.setPointerCapture(e.pointerId)
      setDrag({ type: 'draw', kind: tool, x0: snap(p.x), z0: snap(p.z), x1: snap(p.x), z1: snap(p.z) })
      return
    }
    if (tool === 'mesa') {
      // a mesa já vem com as suas cadeiras (o número de lugares escolhido)
      const made = addItems([{ type: 'mesa', x: snap(p.x), z: snap(p.z), rot: 0, seats: newSeats, ...(newDesk !== 'escritorio' ? { style: newDesk } : {}) }])
      if (made) arrange(made[0].id)
      return
    }
    if (tool === 'cadeira') {
      // perto de uma mesa, a cadeira encaixa à frente (ou atrás) dela, virada para a mesa
      const d = nearestDesk(current.current.items, p.x, p.z)
      const style = newChair !== 'escritorio' ? { style: newChair } : {}
      return addItems([{ type: 'cadeira', ...style, ...(d ? chairAtDesk(d, p.x, p.z, style) : { x: snap(p.x), z: snap(p.z), rot: 0 }) }])
    }
    if (tool === 'posto') {
      const x = snap(p.x)
      const z = snap(p.z)
      // mesa de trabalho com um lugar: a cadeira fica à frente, virada para ela
      const made = addItems([{ type: 'mesa', x, z, rot: 0, seats: 1 }])
      if (made) arrange(made[0].id)
      return
    }
    // selecionar / mover / redimensionar
    if (target?.dataset.resize) {
      setHistory(h => [...h.slice(-49), current.current])
      svg.current!.setPointerCapture(e.pointerId)
      setDrag({ type: 'resize', id: target.dataset.resize, moved: false })
      return
    }
    const id = target?.dataset.item ?? target?.dataset.room
    if (!id) return setSel(null)
    const s: NonNullable<Sel> = target!.dataset.item ? { kind: 'item', id } : { kind: 'room', id }
    setSel(s)
    const obj = s.kind === 'item' ? map.items.find(i => i.id === id)! : map.rooms.find(r => r.id === id)!
    setHistory(h => [...h.slice(-49), current.current])
    svg.current!.setPointerCapture(e.pointerId)
    setDrag({ type: 'move', sel: s, dx: p.x - obj.x, dz: p.z - obj.z, moved: false })
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const p = at(e)
    if (drag.type === 'draw') return setDrag({ ...drag, x1: snap(p.x), z1: snap(p.z) })
    if (drag.type === 'resize') {
      if (!drag.moved) setDrag({ ...drag, moved: true })
      return edit(m => ({
        ...m,
        rooms: m.rooms.map(r => (r.id === drag.id ? { ...r, w: Math.max(0.5, snap(p.x) - r.x), d: Math.max(0.5, snap(p.z) - r.z) } : r)),
      }), false)
    }
    if (!drag.moved) setDrag({ ...drag, moved: true })
    const { sel: s } = drag
    if (s.kind === 'item') {
      // só se mexe para onde cabe: por cima de outra peça fica parada (e a vermelho)
      const m = current.current
      const it = m.items.find(i => i.id === s.id)
      if (!it) return
      const cand = { ...it, x: snap(p.x - drag.dx), z: snap(p.z - drag.dz) }
      if (cand.x === it.x && cand.z === it.z) return
      if (!fits(m.items, cand, m, new Set([it.id]))) return setBlocked(it.id)
      setBlocked(null)
      edit(mm => ({ ...mm, items: mm.items.map(i => (i.id === it.id ? cand : i)) }), false)
    } else {
      edit(m => ({
        ...m,
        rooms: m.rooms.map(r => (r.id === s.id
          ? { ...r, x: Math.min(m.width - r.w, Math.max(0, snap(p.x - drag.dx))), z: Math.min(m.depth - r.d, Math.max(0, snap(p.z - drag.dz))) }
          : r)),
      }), false)
    }
  }

  const onUp = () => {
    if (drag?.type === 'draw') {
      const x = Math.min(drag.x0, drag.x1)
      const z = Math.min(drag.z0, drag.z1)
      const w = Math.abs(drag.x1 - drag.x0)
      const d = Math.abs(drag.z1 - drag.z0)
      if (w >= 0.5 && d >= 0.5) {
        const salas = map.rooms.filter(r => r.kind === 'sala').length
        const r: OfficeRoom = {
          id: uid(),
          kind: drag.kind,
          name: drag.kind === 'corredor' ? 'Corredor' : `Sala ${salas + 1}`,
          x, z, w, d,
          color: drag.kind === 'corredor' ? CORRIDOR_COLOR : ROOM_COLORS[salas % ROOM_COLORS.length],
        }
        edit(m => ({ ...m, rooms: [...m.rooms, r] }))
        setSel({ kind: 'room', id: r.id })
        setTool('select')
      }
    } else if (drag && (drag.type === 'move' || drag.type === 'resize') && !drag.moved) {
      // só um clique: não ficou nada para anular
      setHistory(h => h.slice(0, -1))
    } else if (drag?.type === 'move' && drag.sel.kind === 'item') {
      // cadeira largada perto de uma mesa: encaixa à distância certa, virada para ela
      alignChair(drag.sel.id, false)
    }
    setDrag(null)
    setBlocked(null)
  }

  const setRoom = (patch: Partial<OfficeRoom>) => room && edit(m => ({ ...m, rooms: m.rooms.map(r => (r.id === room.id ? { ...r, ...patch } : r)) }))
  const setItem = (patch: Partial<OfficeItem>) => item && edit(m => ({ ...m, items: m.items.map(i => (i.id === item.id ? { ...i, ...patch } : i)) }))
  /**
   * Mudar o tipo, o tamanho ou o acabamento de uma peça. Se maior deixar de caber onde está,
   * desloca-se um pouco; se não houver espaço, fica como estava. Uma cadeira junto a uma mesa
   * volta a encaixar nela (o tamanho mudou).
   */
  const changeItem = (patch: Partial<OfficeItem>) => {
    if (!item) return
    const m = current.current
    const cand: OfficeItem = { ...item, ...patch }
    for (const k of ['style', 'w', 'd', 'color'] as const) if (cand[k] === undefined) delete cand[k]
    if (cand.type === 'cadeira' && cand.style === 'escritorio') delete cand.style
    if (cand.type === 'mesa' && cand.style === 'escritorio') delete cand.style
    const spot = freeSpot(m.items, cand, m, new Set([item.id]), 1)
    if (!spot) return setError('Assim já não cabe aqui: afasta as peças à volta ou escolhe um tamanho menor.')
    setError('')
    edit(mm => ({ ...mm, items: mm.items.map(i => (i.id === item.id ? { ...cand, ...spot } : i)) }))
    if (cand.type === 'cadeira') alignChair(item.id, false)
    // uma mesa com outro tipo, tamanho ou lugares volta a pôr as suas cadeiras
    else if ('style' in patch || 'w' in patch || 'd' in patch || 'seats' in patch) arrange(item.id)
  }

  // o 3D acompanha as alterações (com um pequeno atraso: arrastar não refaz a cena a cada passo)
  const [previewMap, setPreviewMap] = useState(map)
  useEffect(() => {
    const t = setTimeout(() => setPreviewMap(map), 250)
    return () => clearTimeout(t)
  }, [map])
  // ao escolher uma sala ou uma peça na planta, o 3D aproxima-se dela
  const duplicate = () => {
    if (!item) return
    // a cópia fica ao lado, com o mesmo tipo, tamanho e acabamento
    const { id: _id, label: _label, ...copy } = item
    void _id; void _label
    addItems([{ ...copy, x: item.x + itemSize(item).w + 0.15, z: item.z }])
  }

  const save = async () => {
    const clash = misplaced(current.current).size
    if (clash) {
      if (!confirm(`Há ${clash} peças mal postas (por cima de outras, coladas ou a atravessar paredes). Organizar tudo e guardar?`)) return
      if (organize()) return setError('Algumas peças não couberam: afasta-as à mão (a vermelho) e guarda outra vez.')
    }
    setBusy('save')
    setError('')
    try {
      await api(`${org.base}/mapa`, { method: 'PUT', body: current.current })
      await org.refresh()
      setDirty(false)
      showToast('Mapa guardado', 'success')
    } catch (err) {
      setError(errorText(err, 'Não foi possível guardar o mapa. Tenta outra vez.'))
    }
    setBusy(null)
  }

  const uploadGuide = async (f: File) => {
    if (!GUIDE_TYPES.includes(f.type) || f.size > MAX_GUIDE) return setError('A planta tem de ser JPG, PNG ou WebP, até 8 MB.')
    setBusy('guide')
    setError('')
    try {
      const form = new FormData()
      form.append('file', f)
      await api(`${org.base}/mapa/guia`, { form })
      await org.refresh()
      // ajusta o piso à proporção da imagem, se o desenho ainda estiver vazio
      if (!map.rooms.length && !map.items.length) {
        const img = new Image()
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight
          if (ratio > 0) edit(m => ({ ...m, depth: Math.max(MIN_SIZE, Math.round((m.width / ratio) * 2) / 2) }))
          URL.revokeObjectURL(img.src)
        }
        img.src = URL.createObjectURL(f)
      }
      showToast('Planta carregada: desenha as salas por cima dela', 'success')
    } catch (err) {
      setError(errorText(err, 'Não foi possível carregar a planta. Tenta outra vez.'))
    }
    setBusy(null)
  }
  const removeGuide = async () => {
    if (!confirm('Tirar a planta? O desenho do mapa fica.')) return
    setBusy('guide')
    try {
      await api(`${org.base}/mapa/guia`, { method: 'DELETE' })
      await org.refresh()
    } catch (err) {
      setError(errorText(err, 'Não foi possível tirar a planta. Tenta outra vez.'))
    }
    setBusy(null)
  }

  const close = () => {
    if (dirty && !confirm('Há alterações por guardar. Sair mesmo assim?')) return
    onClose()
  }

  const empty = useMemo(() => new Map(), [])
  const seats = map.items.filter(i => i.type === 'cadeira').length
  const overlaps = useMemo(() => misplaced(map), [map])
  /** Organizar tudo: cada mesa com as suas cadeiras, nada fora das salas nem torto (ver organizeAll) */
  const organize = () => {
    const r = organizeAll(current.current)
    edit(m => ({ ...m, items: r.items }))
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
    const parts = [
      r.moved ? plural(r.moved, 'mesa ajustada', 'mesas ajustadas') : '',
      r.removedDesks ? plural(r.removedDesks, 'mesa removida', 'mesas removidas') : '',
      r.removedChairs ? plural(r.removedChairs, 'cadeira removida', 'cadeiras removidas') : '',
      r.added ? plural(r.added, 'cadeira nova', 'cadeiras novas') : '',
    ].filter(Boolean)
    showToast(parts.length ? `Organizado: ${parts.join(', ')}` : 'Já estava tudo organizado', 'success')
    setError(r.skipped ? `${plural(r.skipped, 'lugar não coube', 'lugares não couberam')}: essas mesas ficaram com menos lugares (há salas sem espaço para todos).` : '')
    return misplaced(current.current).size
  }
  const confirmOrganize = () => {
    if (!confirm('Organizar tudo? As mesas ficam em filas e cada uma com as suas cadeiras, viradas para ela. Saem as mesas sem espaço para nenhum lugar ou fora das salas, e todas as cadeiras que não são de uma mesa; quem estava sentado nelas volta a escolher o lugar. (Podes anular com Ctrl+Z.)')) return
    organize()
  }
  const preview = drag?.type === 'draw'
    ? { x: Math.min(drag.x0, drag.x1), z: Math.min(drag.z0, drag.z1), w: Math.abs(drag.x1 - drag.x0), d: Math.abs(drag.z1 - drag.z0), kind: drag.kind }
    : null
  const toolInfo = TOOLS.find(t => t.id === tool)!

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={close} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Voltar"><ArrowLeftIcon size={22} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-ink">Mapa do escritório</h1>
          <p className="text-sm font-bold text-muted">
            {map.rooms.filter(r => r.kind === 'sala').length} salas · {map.rooms.filter(r => r.kind === 'corredor').length} corredores · {seats} cadeira{seats === 1 ? '' : 's'}
            {dirty ? ' · alterações por guardar' : ''}
          </p>
        </div>
        <div className="flex rounded-xl border-2 border-line p-0.5">
          {(['2d', 'ambos', '3d'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm font-extrabold cursor-pointer ${view === v ? 'bg-brand text-white' : 'text-body'}`}>
              {v === '2d' ? 'Planta' : v === 'ambos' ? 'Lado a lado' : <span className="flex items-center gap-1"><CubeIcon size={16} /> 3D</span>}
            </button>
          ))}
        </div>
        <button onClick={save} disabled={!!busy} aria-busy={busy === 'save'} className="btn btn-primary shrink-0">
          <Busy busy={busy === 'save'} text="A guardar…">Guardar mapa</Busy>
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className={`min-w-0 ${view === 'ambos' ? 'grid gap-3 2xl:grid-cols-2' : ''}`}>
          {view !== '3d' && (
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`chip ${tool === t.id ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}
                    aria-pressed={tool === t.id}
                  >
                    <t.icon size={16} /> {t.label}
                  </button>
                ))}
                <span className="flex-1" />
                <button onClick={undo} disabled={!history.length} className="rounded-lg p-2 text-body enabled:hover:bg-snow disabled:opacity-40 cursor-pointer" aria-label="Anular (Ctrl+Z)" title="Anular (Ctrl+Z)">
                  <ArrowCounterClockwiseIcon size={18} />
                </button>
                <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="rounded-lg p-2 text-body hover:bg-snow cursor-pointer" aria-label="Afastar"><MagnifyingGlassMinusIcon size={18} /></button>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.5))} className="rounded-lg p-2 text-body hover:bg-snow cursor-pointer" aria-label="Aproximar"><MagnifyingGlassPlusIcon size={18} /></button>
              </div>
              {(tool === 'mesa' || tool === 'cadeira') && (
                <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Tipo">
                  {tool === 'mesa'
                    ? (Object.keys(DESK_STYLES) as DeskStyle[]).map(s => (
                      <button key={s} onClick={() => { setNewDesk(s); setNewSeats(SEAT_LIMITS[s].def) }} className={`chip text-xs ${newDesk === s ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>{DESK_STYLES[s].label}</button>
                    ))
                    : (Object.keys(CHAIR_STYLES) as ChairStyle[]).map(s => (
                      <button key={s} onClick={() => setNewChair(s)} className={`chip text-xs ${newChair === s ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>{CHAIR_STYLES[s].label}</button>
                    ))}
                </div>
              )}
              {tool === 'mesa' && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Lugares">
                  <span className="text-xs font-bold text-muted">Lugares:</span>
                  {Array.from({ length: SEAT_LIMITS[newDesk].max }, (_, k) => k + 1).map(n => (
                    <button key={n} onClick={() => setNewSeats(n)} aria-pressed={newSeats === n}
                      className={`h-8 min-w-8 rounded-lg border-2 px-1.5 text-xs font-extrabold cursor-pointer ${newSeats === n ? 'border-accent bg-accent-light text-accent-dark' : 'border-line text-body hover:bg-snow'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <p className="mb-2 text-xs font-semibold text-muted">{toolInfo.hint}</p>
              <div className="max-h-[70dvh] overflow-auto rounded-2xl border-2 border-line bg-white">
                <svg
                  ref={svg}
                  viewBox={`0 0 ${map.width} ${map.depth}`}
                  className={`block touch-none select-none ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
                  style={{ width: `${zoom * 100}%`, aspectRatio: `${map.width} / ${map.depth}` }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  <defs>
                    <pattern id="grid1" width="1" height="1" patternUnits="userSpaceOnUse">
                      <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#E9E7F2" strokeWidth="0.02" />
                    </pattern>
                  </defs>
                  {guideUrl && <image href={guideUrl} x="0" y="0" width={map.width} height={map.depth} preserveAspectRatio="none" opacity={guideOpacity} />}
                  <rect x="0" y="0" width={map.width} height={map.depth} fill="url(#grid1)" />

                  {[...map.rooms].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'corredor' ? -1 : 1)).map(r => {
                    const on = sel?.kind === 'room' && sel.id === r.id
                    return (
                      <g key={r.id} data-room={r.id} className={tool === 'select' ? 'cursor-move' : ''}>
                        <rect
                          x={r.x} y={r.z} width={r.w} height={r.d}
                          fill={r.color}
                          fillOpacity={guideUrl ? 0.75 : 1}
                          stroke={on ? '#7B61FF' : r.kind === 'sala' ? '#4A4763' : '#C9C6D9'}
                          strokeWidth={on ? 0.12 : r.kind === 'sala' ? 0.08 : 0.04}
                          strokeDasharray={r.kind === 'corredor' ? '0.3 0.2' : undefined}
                        />
                        <text x={r.x + 0.25} y={r.z + 0.6} fontSize={Math.min(0.55, Math.max(0.3, r.w / 9))} fontWeight={800} fill="#2B2840" className="pointer-events-none">
                          {r.name}
                        </text>
                        {on && tool === 'select' && (
                          <rect data-resize={r.id} x={r.x + r.w - 0.3} y={r.z + r.d - 0.3} width={0.6} height={0.6} rx={0.1} fill="#7B61FF" className="cursor-nwse-resize" />
                        )}
                      </g>
                    )
                  })}

                  {map.items.map(i => (
                    <PlanPiece key={i.id} item={i} on={sel?.kind === 'item' && sel.id === i.id} bad={overlaps.has(i.id) || blocked === i.id} movable={tool === 'select'} />
                  ))}

                  {preview && (
                    <rect x={preview.x} y={preview.z} width={preview.w} height={preview.d} fill={preview.kind === 'corredor' ? CORRIDOR_COLOR : '#EEEAFF'} fillOpacity={0.7} stroke="#7B61FF" strokeWidth={0.06} strokeDasharray="0.25 0.15" />
                  )}
                </svg>
              </div>
            </div>
          )}
          {view !== '2d' && (
            <div className="min-w-0">
              {view === 'ambos' && <p className="mb-2 text-xs font-semibold text-muted">Pré-visualização em 3D: muda à medida que editas. Carrega numa peça ou sala da planta para a ver de perto.</p>}
              <OfficeScene
                map={previewMap}
                taken={empty}
                guideUrl={guideUrl}
                selected={sel?.kind === 'item' ? sel.id : null}
                focus={focus3d}
                className={view === 'ambos' ? 'h-[60dvh] min-h-[360px]' : 'h-[70dvh] min-h-[420px]'}
              />
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {room && (
            <div className="card space-y-3 p-4 animate-fade-in">
              <div className="flex rounded-xl border-2 border-line p-0.5">
                {(['sala', 'corredor'] as const).map(k => (
                  <button key={k} onClick={() => setRoom({ kind: k, color: k === 'corredor' ? CORRIDOR_COLOR : room.kind === 'corredor' ? ROOM_COLORS[0] : room.color })}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-extrabold capitalize cursor-pointer ${room.kind === k ? 'bg-brand text-white' : 'text-body'}`}>
                    {k}
                  </button>
                ))}
              </div>
              <div>
                <label className="label" htmlFor="o-name">Nome</label>
                <input id="o-name" className="input py-2.5" value={room.name} maxLength={40} onChange={e => setRoom({ name: e.target.value })} />
              </div>
              {room.kind === 'sala' && (
                <>
                  <div>
                    <label className="label" htmlFor="o-dept">Departamento</label>
                    <select id="o-dept" className="input py-2.5" value={room.departmentId ?? ''} onChange={e => setRoom({ departmentId: e.target.value || undefined })}>
                      <option value="">Espaço comum</option>
                      {departmentTree(org.departments).map(({ dept: d, depth }) => <option key={d.id} value={d.id}>{indentedName(d.name, depth)}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold text-muted">Cor do chão</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ROOM_COLORS.map(c => (
                        <button key={c} onClick={() => setRoom({ color: c })} aria-label={`Chão ${c}`} aria-pressed={room.color === c} className="h-7 w-7 rounded-full border-2 border-line cursor-pointer"
                          style={{ background: c, outline: room.color === c ? '3px solid #7B61FF' : undefined, outlineOffset: 1 }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold text-muted">Cor das paredes</span>
                    <div className="flex flex-wrap gap-1.5">
                      {WALL_COLORS.map(c => {
                        const current = (room.wallColor ?? '#FFFFFF') === c
                        return (
                          <button key={c} onClick={() => setRoom({ wallColor: c === '#FFFFFF' ? undefined : c })} aria-label={`Paredes ${c}`} aria-pressed={current}
                            className="h-7 w-7 rounded-lg border-2 border-line cursor-pointer"
                            style={{ background: c, outline: current ? '3px solid #7B61FF' : undefined, outlineOffset: 1 }} />
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                {([['w', 'Largura (m)'], ['d', 'Fundo (m)']] as const).map(([k, l]) => (
                  <div key={k}>
                    <label className="mb-1 block text-xs font-bold text-muted" htmlFor={`o-${k}`}>{l}</label>
                    <input id={`o-${k}`} type="number" step={0.25} min={0.5} className="input py-2" value={room[k]}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0.5) setRoom({ [k]: v }) }} />
                  </div>
                ))}
              </div>
              <button onClick={removeSel} className="btn btn-ghost w-full text-danger"><TrashIcon size={18} /> Apagar {room.kind}</button>
            </div>
          )}

          {item && (
            <div className="card space-y-3 p-4 animate-fade-in">
              <p className="font-black text-ink">{item.type === 'mesa' ? 'Mesa' : 'Cadeira'}</p>
              <div>
                <label className="label" htmlFor="o-style">Tipo</label>
                <select
                  id="o-style"
                  className="input py-2.5"
                  value={item.type === 'mesa' ? deskStyle(item) : chairStyle(item)}
                  onChange={e => {
                    const style = e.target.value as DeskStyle | ChairStyle
                    // um tipo novo começa com o tamanho desse tipo
                    changeItem(item.type === 'mesa' ? { style, w: undefined, d: undefined } : { style })
                  }}
                >
                  {item.type === 'mesa'
                    ? (Object.keys(DESK_STYLES) as DeskStyle[]).map(s => <option key={s} value={s}>{DESK_STYLES[s].label}</option>)
                    : (Object.keys(CHAIR_STYLES) as ChairStyle[]).map(s => <option key={s} value={s}>{CHAIR_STYLES[s].label}</option>)}
                </select>
              </div>
              {item.type === 'mesa' && (() => {
                const s = DESK_STYLES[deskStyle(item)]
                const size = itemSize(item)
                const round = deskStyle(item) === 'redonda'
                return (
                  <>
                    <div>
                      <label className="label" htmlFor="o-seats">Lugares</label>
                      <select id="o-seats" className="input py-2.5" value={deskSeats(item)} onChange={e => changeItem({ seats: Number(e.target.value) })}>
                        {Array.from({ length: SEAT_LIMITS[deskStyle(item)].max }, (_, k) => k + 1).map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'lugar' : 'lugares'}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs font-semibold text-muted">A mesa cresce se precisar, e as cadeiras ficam nos lugares certos.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={round ? 'col-span-2' : ''}>
                        <label className="mb-1 block text-xs font-bold text-muted" htmlFor="o-dw">{round ? 'Diâmetro (m)' : 'Comprimento (m)'}</label>
                        <input id="o-dw" type="number" step={0.1} min={s.min} max={s.max} className="input py-2" value={size.w}
                          onChange={e => { const v = Number(e.target.value); if (v >= s.min && v <= s.max) changeItem({ w: v }) }} />
                      </div>
                      {!round && (
                        <div>
                          <label className="mb-1 block text-xs font-bold text-muted" htmlFor="o-dd">Largura (m)</label>
                          <input id="o-dd" type="number" step={0.1} min={0.4} max={Math.max(s.d, s.max / 2)} className="input py-2" value={size.d}
                            onChange={e => { const v = Number(e.target.value); if (v >= 0.4 && v <= Math.max(s.d, s.max / 2)) changeItem({ d: v }) }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-bold text-muted">Acabamento</span>
                      <div className="flex flex-wrap gap-1.5">
                        {DESK_COLORS.map(c => {
                          const current = (item.color ?? DESK_COLORS[0].color) === c.color
                          return (
                            <button key={c.color} onClick={() => changeItem({ color: c.color === DESK_COLORS[0].color ? undefined : c.color })} title={c.label} aria-label={c.label} aria-pressed={current}
                              className="h-7 w-7 rounded-lg border-2 border-line cursor-pointer"
                              style={{ background: c.color, outline: current ? '3px solid #7B61FF' : undefined, outlineOffset: 1 }} />
                          )
                        })}
                      </div>
                    </div>
                  </>
                )
              })()}
              {item.type === 'cadeira' && (
                <div>
                  <label className="label" htmlFor="o-label">Nome da cadeira</label>
                  <input id="o-label" className="input py-2.5" value={item.label ?? ''} maxLength={24} onChange={e => setItem({ label: e.target.value })} />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => rotateSel(-90)} className="btn btn-ghost flex-1 px-2" aria-label="Rodar para a esquerda"><ArrowCounterClockwiseIcon size={18} /></button>
                <button onClick={() => rotateSel(90)} className="btn btn-ghost flex-1 px-2" aria-label="Rodar para a direita (R)"><ArrowClockwiseIcon size={18} /></button>
                <button onClick={duplicate} className="btn btn-ghost flex-1 px-2" aria-label="Duplicar"><CopyIcon size={18} /></button>
                <button onClick={removeSel} className="btn btn-ghost flex-1 px-2 text-danger" aria-label="Apagar"><TrashIcon size={18} /></button>
              </div>
              {item.type === 'cadeira' && (
                <button
                  onClick={() => { if (!alignChair(item.id)) setError('Esta cadeira não está perto de nenhuma mesa (ou não há espaço à frente dela).'); else setError('') }}
                  className="btn btn-ghost w-full text-sm"
                >
                  <DeskIcon size={16} /> Virar para a mesa
                </button>
              )}
            </div>
          )}

          <div className="card space-y-3 p-4">
            <span className="label">Piso</span>
            <div className="grid grid-cols-2 gap-2">
              {([['width', 'Comprimento (m)'], ['depth', 'Largura (m)']] as const).map(([k, l]) => (
                <div key={k}>
                  <label className="mb-1 block text-xs font-bold text-muted" htmlFor={`o-${k}`}>{l}</label>
                  <input id={`o-${k}`} type="number" min={MIN_SIZE} max={MAX_SIZE} className="input py-2" value={map[k]}
                    onChange={e => { const v = Number(e.target.value); if (v >= MIN_SIZE && v <= MAX_SIZE) edit(m => ({ ...m, [k]: v })) }} />
                </div>
              ))}
            </div>
            <input ref={file} type="file" accept={GUIDE_TYPES.join(',')} className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadGuide(f) }} />
            <button onClick={() => file.current?.click()} disabled={!!busy} aria-busy={busy === 'guide'} className="btn btn-ghost w-full">
              <CameraIcon size={18} /> <Busy busy={busy === 'guide'} text="A carregar…">{guideId ? 'Trocar a planta' : 'Carregar planta ou foto'}</Busy>
            </button>
            {guideId && (
              <>
                <label className="block text-xs font-bold text-muted" htmlFor="o-opacity">Transparência da planta</label>
                <input id="o-opacity" type="range" min={0.1} max={1} step={0.05} value={guideOpacity} onChange={e => setGuideOpacity(Number(e.target.value))} className="w-full accent-brand" />
                <button onClick={removeGuide} disabled={!!busy} className="text-sm font-bold text-danger cursor-pointer">Tirar a planta</button>
              </>
            )}
            <p className="text-xs font-semibold text-muted">
              A planta fica por baixo, esticada ao tamanho do piso: desenha as salas e os corredores por cima dela. O 3D é feito a partir do desenho.
            </p>
          </div>

          <div className={`card space-y-2 p-4 ${overlaps.size ? 'border-danger/40 bg-danger-light/40' : ''}`}>
            {overlaps.size > 0 ? (
              <p className="text-sm font-bold text-danger-dark">
                {overlaps.size} peças mal postas (a vermelho): por cima de outras, coladas ou a atravessar paredes.
              </p>
            ) : (
              <p className="text-sm font-semibold text-muted">
                Mesas em filas, cada uma com as suas cadeiras. Nenhuma mesa fica sem cadeiras e nenhuma cadeira fica sem mesa.
              </p>
            )}
            <button onClick={confirmOrganize} className="btn btn-primary w-full text-sm">Organizar tudo</button>
          </div>

          {error && <p className="rounded-2xl bg-danger-light p-3 text-sm font-bold text-danger-dark">{error}</p>}
        </aside>
      </div>
    </div>
  )
}

/** Uma peça desenhada na planta (vista de cima), com o tamanho e a forma do tipo */
/**
 * Uma peça na planta. Memorizada: ao arrastar uma peça só ela é redesenhada (as outras mantêm
 * o mesmo objecto e as mesmas marcas), mesmo com centenas de mesas e cadeiras.
 */
const PlanPiece = memo(function PlanPiece({ item, on, bad, movable }: { item: OfficeItem; on: boolean; bad: boolean; movable: boolean }) {
  return (
    <g data-item={item.id} transform={`translate(${item.x} ${item.z}) rotate(${item.rot})`} className={movable ? 'cursor-move' : ''}>
      <PlanItem item={item} on={on} bad={bad} stroke={bad ? '#F2545B' : on ? '#7B61FF' : '#4A4763'} />
    </g>
  )
})

function PlanItem({ item, on, bad, stroke }: { item: OfficeItem; on: boolean; bad: boolean; stroke: string }) {
  const { w, d } = itemSize(item)
  if (item.type === 'mesa') {
    const fill = bad ? '#FDE4E5' : item.color ?? '#E9DCC8'
    const sw = on ? 0.08 : 0.03
    switch (deskStyle(item)) {
      case 'redonda':
        return <circle r={w / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
      case 'reuniao':
        return <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.12} fill={fill} stroke={stroke} strokeWidth={sw} />
      case 'balcao':
        return (
          <>
            <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.04} fill={fill} stroke={stroke} strokeWidth={sw} />
            {/* o painel da frente (do lado de quem chega) */}
            <rect x={-w / 2} y={-d / 2} width={w} height={0.08} fill="#4A4763" />
          </>
        )
      default: {
        const screens = deskSeats(item)
        return (
          <>
            <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.05} fill={fill} stroke={stroke} strokeWidth={sw} />
            {/* monitores (do lado de trás): a pessoa senta-se do outro lado */}
            {Array.from({ length: screens }, (_, k) => (
              <rect key={k} x={(k - (screens - 1) / 2) * (w / screens) - 0.3} y={-d / 2 + 0.08} width={0.6} height={0.06} rx={0.02} fill="#4A4763" />
            ))}
          </>
        )
      }
    }
  }
  const fill = bad ? '#FDE4E5' : on ? '#EEEAFF' : '#DCF7F3'
  const line = bad ? '#F2545B' : on ? '#7B61FF' : '#12B5A6'
  const sw = on ? 0.08 : 0.04
  const style = chairStyle(item)
  if (style === 'banco') return <circle r={w / 2} fill={fill} stroke={line} strokeWidth={sw} />
  return (
    <>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={style === 'poltrona' ? 0.18 : 0.1} fill={fill} stroke={line} strokeWidth={sw} />
      {/* o encosto fica atrás */}
      <rect x={-w / 2} y={d / 2 - (style === 'poltrona' ? 0.18 : 0.1)} width={w} height={style === 'poltrona' ? 0.18 : 0.1} fill={on ? '#7B61FF' : '#12B5A6'} />
    </>
  )
}
