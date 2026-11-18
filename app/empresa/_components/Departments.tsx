'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BuildingsIcon, CaretDownIcon, CaretUpIcon, CornersOutIcon, CrosshairIcon, DotsThreeIcon, MagnifyingGlassIcon, MinusIcon, PlusIcon, UsersThreeIcon,
} from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import { childDepartments, departmentPath, departmentTree, deptDeputyIds, deptHeadId, descendantIds } from '../../lib/org'
import type { Department, Member } from '../../types'
import Avatar from '../../components/ui/Avatar'
import { MemberForm } from './People'
import DeptForm from './structure/DeptForm'
import DeptPanel from './structure/DeptPanel'
import { ActionMenu, TransferDialog, type DeptAction } from './structure/actions'
import { CARD_H, CARD_W, edgePath, layoutTree, type TreeNode } from './structure/layout'

/** id do cartão da empresa (raiz da árvore) */
const ROOT = '__empresa'
const MIN_Z = 0.2
const MAX_Z = 1.6
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

type View = { x: number; y: number; z: number }
type Form = { dept: Department | null; parentId?: string } | null
type Menu = { id: string; anchor: DOMRect } | null

/** Estrutura da empresa: organograma dos departamentos, com chefia, funcionários e subdepartamentos */
export default function Departments() {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const depts = org.departments
  const canEdit = org.isAdmin
  const myDept = org.me.departmentId && org.deptById(org.me.departmentId) ? org.me.departmentId : undefined

  const active = useMemo(() => org.members.filter(m => m.status === 'activo' || m.status === 'pendente'), [org.members])

  const tree = useMemo<TreeNode>(() => {
    const build = (parentId: string | undefined, seen: Set<string>): TreeNode[] =>
      childDepartments(depts, parentId)
        .filter(d => !seen.has(d.id))
        .map(d => ({ id: d.id, children: build(d.id, new Set([...seen, d.id])) }))
    return { id: ROOT, children: build(undefined, new Set()) }
  }, [depts])

  // muitos departamentos: começa só com o topo aberto e o caminho até ao meu departamento
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (depts.length <= 15) return new Set()
    const keep = new Set(departmentPath(depts, myDept).map(d => d.id))
    return new Set(departmentTree(depts).filter(({ dept, depth }) => depth >= 1 && !keep.has(dept.id)).map(({ dept }) => dept.id))
  })
  const layout = useMemo(() => layoutTree(tree, collapsed), [tree, collapsed])
  const pos = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout])

  const [selected, setSelected] = useState<string | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [form, setForm] = useState<Form>(null)
  const [transfer, setTransfer] = useState<Department | null>(null)
  const [invite, setInvite] = useState<string | null>(null)

  /* ─── quadro: arrastar e zoom ─── */
  const wrap = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [smooth, setSmooth] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x: number; y: number; view: View; dist?: number; moved: boolean } | null>(null)
  const panned = useRef(false)

  const size = () => {
    const r = wrap.current?.getBoundingClientRect()
    // no computador, o painel lateral tapa a direita do quadro
    const panel = selected !== null && window.innerWidth >= 1024 ? 392 : 0
    return { w: (r?.width ?? 800) - panel, h: r?.height ?? 600 }
  }

  const fit = useCallback(() => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    const z = clamp(Math.min((r.width - 48) / layout.width, (r.height - 120) / layout.height), MIN_Z, 1)
    setSmooth(true)
    setView({ z, x: (r.width - layout.width * z) / 2, y: 92 })
  }, [layout])

  const centerOn = (id: string, zoom?: number) => {
    const n = pos.get(id)
    if (!n) return
    const { w, h } = size()
    const z = zoom ?? Math.max(view.z, 0.75)
    setSmooth(true)
    setView({ z, x: w / 2 - (n.x + CARD_W / 2) * z, y: Math.min(h / 3, 160) - n.y * z })
  }

  // ajusta ao ecrã na primeira vez
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (fitted.current) return
    const raf = requestAnimationFrame(() => {
      fitted.current = true
      fit()
    })
    return () => cancelAnimationFrame(raf)
  }, [fit])

  // depois de abrir ramos (pesquisa, "Encontrar-me"), centra no departamento quando já tem posição
  const pendingCenter = useRef<string | null>(null)
  useEffect(() => {
    const id = pendingCenter.current
    if (id && pos.has(id)) {
      pendingCenter.current = null
      centerOn(id)
    }
  })

  const select = (id: string | null, center = true) => {
    setSelected(id)
    if (!id || id === ROOT) {
      if (center) pendingCenter.current = ROOT
      return
    }
    // abre os ramos até ao departamento
    const path = departmentPath(depts, id).slice(0, -1).map(d => d.id)
    setCollapsed(c => (path.some(p => c.has(p)) ? new Set([...c].filter(x => !path.includes(x))) : c))
    if (center) pendingCenter.current = id
  }

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      setSmooth(false)
      setView(v => {
        const z = clamp(v.z * Math.exp(-e.deltaY * 0.0015), MIN_Z, MAX_Z)
        const k = z / v.z
        return { z, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, select, [data-nodrag]')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    gesture.current = { x: cx, y: cy, view, dist, moved: gesture.current?.moved ?? false }
    setSmooth(false)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    if (!g.moved && Math.hypot(cx - g.x, cy - g.y) > 4) {
      g.moved = true
      // só agora: capturar logo no início desviava o clique dos cartões
      pointers.current.forEach((_, id) => { try { wrap.current?.setPointerCapture(id) } catch { /* já levantou */ } })
    }
    if (pts.length === 2 && g.dist) {
      // beliscar: zoom à volta do ponto entre os dois dedos
      const r = wrap.current!.getBoundingClientRect()
      const z = clamp(g.view.z * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist), MIN_Z, MAX_Z)
      const px = g.x - r.left
      const py = g.y - r.top
      const k = z / g.view.z
      g.moved = true
      setView({ z, x: px - (px - g.view.x) * k + (cx - g.x), y: py - (py - g.view.y) * k + (cy - g.y) })
    } else {
      setView({ ...g.view, x: g.view.x + cx - g.x, y: g.view.y + cy - g.y })
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (pointers.current.size === 0) {
      panned.current = !!g?.moved
      gesture.current = null
    } else if (g) {
      const p = [...pointers.current.values()][0]
      gesture.current = { x: p.x, y: p.y, view, moved: true }
    }
  }
  /** um clique logo a seguir a arrastar não abre o cartão */
  const tap = (fn: () => void) => {
    if (panned.current) {
      panned.current = false
      return
    }
    fn()
  }

  const zoomBy = (f: number) => {
    const { w, h } = size()
    setSmooth(true)
    setView(v => {
      const z = clamp(v.z * f, MIN_Z, MAX_Z)
      const k = z / v.z
      return { z, x: w / 2 - (w / 2 - v.x) * k, y: h / 2 - (h / 2 - v.y) * k }
    })
  }

  const toggle = (id: string) => setCollapsed(c => {
    const next = new Set(c)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  /* ─── dados dos cartões ─── */
  const peopleIn = (id: string) => active.filter(m => m.departmentId === id).length
  const peopleUnder = (id: string) => {
    const ids = descendantIds(depts, id)
    return active.filter(m => m.departmentId && ids.has(m.departmentId)).length
  }
  const highlighted = useMemo(() => {
    if (!selected || selected === ROOT) return new Set<string>()
    return new Set(departmentPath(depts, selected).map(d => d.id))
  }, [selected, depts])

  const remove = async (dept: Department) => {
    const parent = depts.find(d => d.id === dept.parentId)
    const where = parent ? `passam para ${parent.name}` : 'passam para o topo da estrutura'
    if (!confirm(`Apagar o departamento ${dept.name}? Os subdepartamentos e os funcionários ${where}.`)) return
    try {
      await api(`${org.base}/departments/${dept.id}`, { method: 'DELETE' })
      await org.refresh()
      if (selected === dept.id) setSelected(null)
      showToast('Departamento apagado', 'success')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível apagar o departamento. Tenta outra vez.'), 'danger')
    }
  }

  const act = (id: string, a: DeptAction) => {
    const dept = id === ROOT ? null : org.deptById(id) ?? null
    if (a === 'edit' && dept) setForm({ dept })
    if (a === 'add') setForm({ dept: null, parentId: dept?.id })
    if (a === 'transfer' && dept) setTransfer(dept)
    if (a === 'invite') setInvite(dept?.id ?? '')
    if (a === 'delete' && dept) remove(dept)
  }

  /* ─── pesquisa ─── */
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const q = query.trim().toLowerCase()
  const results = q
    ? [
        ...depts.filter(d => d.name.toLowerCase().includes(q)).map(d => ({ key: d.id, dept: d, person: undefined as Member | undefined })),
        ...active
          .filter(m => `${m.name} ${m.jobTitle ?? ''}`.toLowerCase().includes(q))
          .map(m => ({ key: m.id, dept: org.deptById(m.departmentId), person: m as Member | undefined })),
      ].slice(0, 8)
    : []

  const selectedDept = selected && selected !== ROOT ? org.deptById(selected) ?? null : null
  const findMe = () => select(myDept ?? ROOT)

  return (
    <div
      ref={wrap}
      className="relative -mx-4 h-[calc(100dvh-230px)] cursor-grab active:cursor-grabbing min-h-[460px] touch-none select-none overflow-hidden bg-snow lg:mx-0 lg:h-[calc(100dvh-150px)] lg:rounded-3xl lg:border-2 lg:border-line"
      style={{ backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)', backgroundSize: `${22 * view.z}px ${22 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* o organograma */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transition: smooth ? 'transform 0.3s ease' : undefined, width: layout.width, height: layout.height }}
        onTransitionEnd={() => setSmooth(false)}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden>
          {layout.edges.map(e => {
            const on = highlighted.has(e.to)
            return <path key={e.to} d={edgePath(e)} fill="none" stroke={on ? 'var(--color-brand)' : '#D5D2E3'} strokeWidth={on ? 2.5 : 2} />
          })}
        </svg>

        {layout.nodes.map(n => {
          const dept = n.id === ROOT ? null : org.deptById(n.id)
          const kids = n.id === ROOT ? tree.children.length : childDepartments(depts, n.id).length
          const open = !collapsed.has(n.id)
          const isSel = selected === n.id
          return (
            <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: CARD_W, height: CARD_H }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => tap(() => select(n.id === selected ? null : n.id, false))}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id, false) } }}
                className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition-shadow hover:shadow-md cursor-pointer ${
                  isSel ? 'border-brand ring-4 ring-brand/20' : n.id === myDept ? 'border-accent' : 'border-line'
                }`}
              >
                {n.id === myDept && (
                  <span className="absolute right-2 top-0 rounded-b-md bg-accent px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">O teu departamento</span>
                )}
                {dept ? <DeptCardBody dept={dept} peopleIn={peopleIn(dept.id)} peopleUnder={peopleUnder(dept.id)} /> : <RootCardBody total={active.length} />}

                <button
                  type="button"
                  onClick={() => tap(() => kids && toggle(n.id))}
                  disabled={!kids}
                  className={`mt-auto flex h-8 shrink-0 items-center justify-center gap-1 border-t-2 border-line text-[11px] font-extrabold ${
                    kids ? (open ? 'bg-brand-light/60 text-brand-dark' : 'text-body hover:bg-snow') + ' cursor-pointer' : 'text-muted'
                  }`}
                  aria-expanded={kids ? open : undefined}
                >
                  {kids ? (
                    <>
                      {kids} {n.id === ROOT ? `departamento${kids === 1 ? '' : 's'}` : `subdepartamento${kids === 1 ? '' : 's'}`}
                      {open ? <CaretUpIcon size={12} weight="bold" /> : <CaretDownIcon size={12} weight="bold" />}
                    </>
                  ) : 'sem subdepartamentos'}
                </button>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={e => setMenu({ id: n.id, anchor: e.currentTarget.getBoundingClientRect() })}
                  className="absolute right-1.5 top-3 rounded-lg p-1 text-muted hover:bg-snow hover:text-body cursor-pointer"
                  aria-label={`Acções de ${dept?.name ?? org.org.name}`}
                >
                  <DotsThreeIcon size={20} weight="bold" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setForm({ dept: null, parentId: dept?.id })}
                  className="absolute -bottom-3.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-line bg-white text-accent shadow-sm hover:border-accent cursor-pointer"
                  aria-label={dept ? `Adicionar subdepartamento a ${dept.name}` : 'Adicionar departamento'}
                  title={dept ? 'Adicionar subdepartamento' : 'Adicionar departamento'}
                >
                  <PlusIcon size={14} weight="bold" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* barra de cima */}
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2 lg:right-auto" data-nodrag>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-md ring-1 ring-black/5">
          <h2 className="hidden text-lg font-black text-ink sm:block">Estrutura da empresa</h2>
          {canEdit && (
            <button onClick={() => setForm({ dept: null })} className="btn btn-primary h-9 px-4 text-sm">
              <PlusIcon size={16} weight="bold" /> Adicionar
            </button>
          )}
          <div className="relative">
            {searching ? (
              <input
                autoFocus
                className="input w-56 py-1.5 pl-3"
                placeholder="Departamento ou pessoa"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onBlur={() => setTimeout(() => { setSearching(false); setQuery('') }, 150)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearching(false); setQuery('') } }}
              />
            ) : (
              <button onClick={() => setSearching(true)} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Procurar">
                <MagnifyingGlassIcon size={20} />
              </button>
            )}
            {results.length > 0 && (
              <ul className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-black/5">
                {results.map(r => (
                  <li key={r.key}>
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { select(r.dept?.id ?? ROOT); setSearching(false); setQuery('') }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-snow cursor-pointer"
                    >
                      {r.person ? <Avatar name={r.person.name} picture={r.person.picture} size={28} /> : <span className="ml-1 mr-1 h-3 w-3 shrink-0 rounded-full" style={{ background: r.dept!.color }} />}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">{r.person?.name ?? r.dept!.name}</span>
                        <span className="block truncate text-xs font-semibold text-muted">{r.person ? (r.dept?.name ?? 'Sem departamento') : 'Departamento'}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* zoom */}
      <div className={`absolute bottom-3 left-3 z-10 flex items-center rounded-2xl bg-white shadow-md ring-1 ring-black/5 ${selected !== null ? 'max-lg:hidden' : ''}`} data-nodrag>
        <button onClick={findMe} className="flex items-center gap-1.5 rounded-l-2xl px-3 py-2 text-sm font-bold text-body hover:bg-snow cursor-pointer">
          <CrosshairIcon size={16} /> Encontrar-me
        </button>
        <span className="h-6 w-0.5 bg-line" />
        <button onClick={() => zoomBy(1 / 1.2)} className="p-2 text-body hover:bg-snow cursor-pointer" aria-label="Afastar"><MinusIcon size={16} /></button>
        <span className="w-12 text-center text-sm font-bold text-body tabular-nums">{Math.round(view.z * 100)}%</span>
        <button onClick={() => zoomBy(1.2)} className="p-2 text-body hover:bg-snow cursor-pointer" aria-label="Aproximar"><PlusIcon size={16} /></button>
        <button onClick={fit} className="rounded-r-2xl p-2 text-body hover:bg-snow cursor-pointer" aria-label="Ver tudo" title="Ver tudo"><CornersOutIcon size={16} /></button>
      </div>

      {depts.length === 0 && (
        <p className="absolute inset-x-6 top-1/2 mx-auto max-w-sm text-center font-semibold text-muted" style={{ marginTop: 40 }}>
          Ainda sem departamentos. {canEdit ? 'Carrega no + debaixo da empresa para criar o primeiro.' : ''}
        </p>
      )}

      {selected !== null && (
        <div data-nodrag>
          <DeptPanel
            dept={selectedDept}
            onSelect={id => select(id ?? ROOT)}
            onMenu={canEdit ? anchor => setMenu({ id: selected, anchor }) : undefined}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      {menu && <ActionMenu anchor={menu.anchor} root={menu.id === ROOT} onClose={() => setMenu(null)} onPick={a => act(menu.id, a)} />}
      {form && <DeptForm dept={form.dept} parentId={form.parentId} onClose={() => setForm(null)} onSaved={id => select(id)} />}
      {transfer && <TransferDialog dept={transfer} onClose={() => setTransfer(null)} />}
      {invite !== null && <MemberForm member={null} departmentId={invite || undefined} onClose={() => setInvite(null)} />}
    </div>
  )
}

function DeptCardBody({ dept, peopleIn, peopleUnder }: { dept: Department; peopleIn: number; peopleUnder: number }) {
  const org = useOrgRequired()
  const head = org.memberById(deptHeadId(dept))
  const deputies = deptDeputyIds(dept).map(id => org.memberById(id)).filter((m): m is Member => !!m)
  return (
    <div className="min-h-0 flex-1 px-3 pt-3">
      <p className="flex items-center gap-1.5 pr-6 text-[13px] font-black text-ink">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dept.color }} />
        <span className="truncate">{dept.name}</span>
      </p>
      <div className="mt-2 flex items-center gap-2">
        {head ? (
          <>
            <Avatar name={head.name} picture={head.picture} size={30} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-xs font-extrabold text-ink">{head.name}</span>
                <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-snow px-1 text-[10px] font-bold text-muted" title="Pessoas neste departamento e nos de baixo">
                  <UsersThreeIcon size={11} /> {peopleUnder}
                </span>
              </span>
              <span className="block truncate text-[11px] font-semibold text-muted">{head.jobTitle || 'Chefe do departamento'}</span>
            </span>
          </>
        ) : (
          <span className="text-xs font-semibold text-muted">Sem chefe</span>
        )}
      </div>
      <div className="mt-2.5 flex gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-muted">Funcionários</p>
          <span className="mt-0.5 inline-block rounded-lg border-2 border-line px-1.5 text-[11px] font-bold text-body">
            {peopleIn} pessoa{peopleIn === 1 ? '' : 's'}
          </span>
        </div>
        {deputies.length > 0 && (
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted">Adjunto{deputies.length === 1 ? '' : 's'}</p>
            <span className="mt-0.5 flex items-center gap-1">
              <span className="flex -space-x-1.5">
                {deputies.slice(0, 3).map(m => <span key={m.id} className="rounded-full ring-2 ring-white"><Avatar name={m.name} picture={m.picture} size={18} /></span>)}
              </span>
              {deputies.length === 1 && <span className="truncate text-[11px] font-bold text-body">{deputies[0].name}</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function RootCardBody({ total }: { total: number }) {
  const org = useOrgRequired()
  return (
    <div className="min-h-0 flex-1 bg-accent-light/40 px-3 pt-3">
      <p className="flex items-center gap-1.5 pr-6 text-[13px] font-black text-ink">
        <BuildingsIcon size={16} className="shrink-0 text-accent" />
        <span className="truncate">{org.org.name}</span>
      </p>
      {org.org.sector && <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{org.org.sector}</p>}
      <p className="mt-3 text-[10px] font-bold text-muted">Pessoas</p>
      <span className="mt-0.5 inline-block rounded-lg border-2 border-line bg-white px-1.5 text-[11px] font-bold text-body">
        {total} pessoa{total === 1 ? '' : 's'}
      </span>
    </div>
  )
}
