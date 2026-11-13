'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, EraserIcon, TrashIcon } from '@phosphor-icons/react'
import Popover, { MenuDivider, MenuItem } from '../boards/Popover'
import { display, isError, refText, rewriteRefs, type Calc, type RefTok } from '../../lib/sheets/formula'
import { DEFAULT_WIDTH, MAX_COLS, MAX_ROWS, ROW_HEIGHT, cellKey, colName, normRange, type Range } from '../../lib/sheets/refs'
import type { SheetOp } from '../../lib/sheets/ops'
import type { SheetTab } from '../../types'

export type Pos = { r: number; c: number }
export type Sel = { a: Pos; f: Pos }
/** type: começou a escrever por cima (as setas confirmam); edit: F2/duplo clique (as setas movem o cursor) */
export type Editing = { value: string; mode: 'type' | 'edit'; where: 'cell' | 'bar' }

const HEADER_W = 48
const HEADER_H = 26

type Props = {
  tab: SheetTab
  calc: Calc
  readOnly: boolean
  sel: Sel
  setSel: (s: Sel) => void
  editing: Editing | null
  setEditing: (e: Editing | null) => void
  /** grava valores (com anular) */
  setCells: (changes: Record<string, string>) => void
  run: (ops: SheetOp[]) => void
  onShortcut: (key: 'bold' | 'italic' | 'undo' | 'redo') => void
}

/** Texto copiado do Excel (ou de outra app): linhas por \n, células por \t, aspas para multilinha */
function parseTsv(text: string): string[][] {
  const rows: string[][] = [[]]
  let field = ''
  let quoted = false
  const src = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === '\t') { rows[rows.length - 1].push(field); field = '' }
    else if (ch === '\n') { rows[rows.length - 1].push(field); field = ''; rows.push([]) }
    else field += ch
  }
  rows[rows.length - 1].push(field)
  return rows
}

/** Desloca as referências relativas de uma fórmula copiada (como o Excel ao colar) */
function moveFormula(raw: string, dr: number, dc: number) {
  if (!raw.startsWith('=') || (dr === 0 && dc === 0)) return raw
  const move = (t: RefTok) => ({ ...t, row: t.absR ? t.row : t.row + dr, col: t.absC ? t.col : t.col + dc })
  const ok = (t: RefTok) => t.row >= 0 && t.col >= 0 && t.row < MAX_ROWS && t.col < MAX_COLS
  return rewriteRefs(raw, u => {
    const a = move(u.a)
    const b = u.b ? move(u.b) : undefined
    if (!ok(a) || (b && !ok(b))) return '#REF!'
    return b ? `${refText(a, u.a.sheet)}:${refText(b, u.b!.sheet)}` : refText(a, u.a.sheet)
  })
}

export default function SheetGrid({ tab, calc, readOnly, sel, setSel, editing, setEditing, setCells, run, onShortcut }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [view, setView] = useState({ top: 0, height: 600 })
  const [drag, setDrag] = useState<'cells' | 'rows' | 'cols' | null>(null)
  const [resize, setResize] = useState<{ col: number; x: number; w: number; now: number } | null>(null)
  const [menu, setMenu] = useState<{ kind: 'rows' | 'cols'; rect: DOMRect } | null>(null)
  const clip = useRef<{ text: string; raw: string[][]; origin: Pos } | null>(null)

  const g = normRange(sel.a, sel.f)
  const width = (c: number) => (resize?.col === c ? resize.now : tab.widths?.[c] ?? DEFAULT_WIDTH)
  const colLeft = (c: number) => { let x = HEADER_W; for (let i = 0; i < c; i++) x += width(i); return x }
  const raw = (p: Pos) => tab.cells[cellKey(p.r, p.c)] ?? ''

  /* ── tamanho visível (só se desenham as linhas à vista) ── */
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setView({ top: el.scrollTop, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const first = Math.max(0, Math.floor((view.top - HEADER_H) / ROW_HEIGHT) - 5)
  const last = Math.min(tab.rows, first + Math.ceil(view.height / ROW_HEIGHT) + 12)

  /* ── manter a célula activa à vista ── */
  const reveal = (p: Pos) => {
    const el = box.current
    if (!el) return
    const top = HEADER_H + p.r * ROW_HEIGHT
    if (top < el.scrollTop + HEADER_H) el.scrollTop = top - HEADER_H
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight
    const left = colLeft(p.c)
    const w = width(p.c)
    if (left < el.scrollLeft + HEADER_W) el.scrollLeft = left - HEADER_W
    else if (left + w > el.scrollLeft + el.clientWidth) el.scrollLeft = left + w - el.clientWidth
  }

  const clamp = (p: Pos): Pos => ({ r: Math.max(0, Math.min(tab.rows - 1, p.r)), c: Math.max(0, Math.min(tab.cols - 1, p.c)) })
  const moveTo = (p: Pos, extend = false) => {
    const q = clamp(p)
    setSel(extend ? { a: sel.a, f: q } : { a: q, f: q })
    reveal(q)
  }

  /* ── editar ── */
  const commit = (then?: Pos) => {
    if (editing) {
      const key = cellKey(sel.a.r, sel.a.c)
      if (editing.value !== (tab.cells[key] ?? '')) setCells({ [key]: editing.value })
      setEditing(null)
    }
    if (then) moveTo(then)
    box.current?.focus({ preventScroll: true })
  }
  const startEdit = (value: string, mode: Editing['mode']) => {
    if (readOnly) return
    setSel({ a: sel.a, f: sel.a })
    setEditing({ value, mode, where: 'cell' })
  }

  useEffect(() => {
    if (editing?.where === 'cell') {
      const el = input.current
      el?.focus()
      if (el && editing.mode === 'edit') el.setSelectionRange(el.value.length, el.value.length)
    }
    // só ao começar a editar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.where, sel.a.r, sel.a.c])

  const clearRange = () => {
    if (readOnly) return
    const changes: Record<string, string> = {}
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const k = cellKey(r, c); if (tab.cells[k]) changes[k] = '' }
    if (Object.keys(changes).length) setCells(changes)
  }

  /* ── teclado ── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== box.current) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key
    const page = Math.max(1, Math.floor(view.height / ROW_HEIGHT) - 2)
    // com Shift estende a partir da ponta da selecção; sem Shift anda a partir da célula activa
    const at = e.shiftKey ? sel.f : sel.a
    if (mod && (k === 'b' || k === 'B')) { e.preventDefault(); onShortcut('bold'); return }
    if (mod && (k === 'i' || k === 'I')) { e.preventDefault(); onShortcut('italic'); return }
    if (mod && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); onShortcut('undo'); return }
    if (mod && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); onShortcut('redo'); return }
    if (mod && (k === 'a' || k === 'A')) { e.preventDefault(); setSel({ a: { r: 0, c: 0 }, f: { r: tab.rows - 1, c: tab.cols - 1 } }); return }
    const moves: Record<string, Pos> = {
      ArrowUp: { r: at.r - 1, c: at.c }, ArrowDown: { r: at.r + 1, c: at.c },
      ArrowLeft: { r: at.r, c: at.c - 1 }, ArrowRight: { r: at.r, c: at.c + 1 },
      PageDown: { r: at.r + page, c: at.c }, PageUp: { r: at.r - page, c: at.c },
      Home: mod ? { r: 0, c: 0 } : { r: at.r, c: 0 },
    }
    if (moves[k]) {
      e.preventDefault()
      moveTo(moves[k], e.shiftKey)
      return
    }
    if (k === 'Tab') { e.preventDefault(); moveTo({ r: sel.a.r, c: sel.a.c + (e.shiftKey ? -1 : 1) }); return }
    if (k === 'Enter') { e.preventDefault(); moveTo({ r: sel.a.r + (e.shiftKey ? -1 : 1), c: sel.a.c }); return }
    if (k === 'F2') { e.preventDefault(); startEdit(raw(sel.a), 'edit'); return }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearRange(); return }
    if (!mod && !e.altKey && k.length === 1) { e.preventDefault(); startEdit(k, 'type') }
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const p = sel.a
    if (e.key === 'Enter') { e.preventDefault(); commit({ r: p.r + (e.shiftKey ? -1 : 1), c: p.c }) }
    else if (e.key === 'Tab') { e.preventDefault(); commit({ r: p.r, c: p.c + (e.shiftKey ? -1 : 1) }) }
    else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); box.current?.focus({ preventScroll: true }) }
    else if (editing?.mode === 'type' && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const d: Record<string, Pos> = { ArrowUp: { r: p.r - 1, c: p.c }, ArrowDown: { r: p.r + 1, c: p.c }, ArrowLeft: { r: p.r, c: p.c - 1 }, ArrowRight: { r: p.r, c: p.c + 1 } }
      commit(d[e.key])
    }
  }

  /* ── copiar / colar ── */
  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (e.target !== box.current) return
    e.preventDefault()
    const rawRows: string[][] = []
    const lines: string[] = []
    for (let r = g.r1; r <= g.r2; r++) {
      const rr: string[] = []
      const shown: string[] = []
      for (let c = g.c1; c <= g.c2; c++) {
        const k = cellKey(r, c)
        rr.push(tab.cells[k] ?? '')
        const s = display(calc.value(tab.id, k), tab.fmt?.[k]?.nf)
        shown.push(/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
      }
      rawRows.push(rr)
      lines.push(shown.join('\t'))
    }
    const text = lines.join('\n')
    e.clipboardData.setData('text/plain', text)
    clip.current = { text, raw: rawRows, origin: { r: g.r1, c: g.c1 } }
    if (cut) clearRange()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    if (e.target !== box.current || readOnly) return
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    // copiado daqui: cola as fórmulas (ajustadas); de fora: os valores
    const internal = clip.current && clip.current.text === text ? clip.current : null
    const block = internal ? internal.raw : parseTsv(text)
    const h = block.length
    const w = Math.max(...block.map(r => r.length))
    // um só valor numa selecção maior: preenche a selecção toda
    const fill = h === 1 && w === 1 && (g.r2 > g.r1 || g.c2 > g.c1)
    const rows = fill ? g.r2 - g.r1 + 1 : h
    const cols = fill ? g.c2 - g.c1 + 1 : w
    const changes: Record<string, string> = {}
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tr = g.r1 + r, tc = g.c1 + c
        if (tr >= MAX_ROWS || tc >= MAX_COLS) continue
        const v = fill ? block[0][0] : block[r][c] ?? ''
        const src = internal ? { r: internal.origin.r + (fill ? 0 : r), c: internal.origin.c + (fill ? 0 : c) } : null
        changes[cellKey(tr, tc)] = src ? moveFormula(v, tr - src.r, tc - src.c) : v
      }
    }
    setCells(changes)
    setSel({ a: { r: g.r1, c: g.c1 }, f: clamp({ r: g.r1 + rows - 1, c: g.c1 + cols - 1 }) })
  }

  /* ── rato ── */
  useEffect(() => {
    if (!drag && !resize) return
    const move = (e: MouseEvent) => { if (resize) setResize(r => (r ? { ...r, now: Math.max(40, Math.min(600, r.w + e.clientX - r.x)) } : r)) }
    const up = () => {
      if (resize && resize.now !== resize.w && !readOnly) run([{ type: 'col.width', tabId: tab.id, col: resize.col, width: resize.now }])
      setResize(null)
      setDrag(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag, resize, run, tab.id, readOnly])

  const cellDown = (e: React.MouseEvent, p: Pos) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (editing) commit()
    if (e.shiftKey) setSel({ a: sel.a, f: p })
    else setSel({ a: p, f: p })
    setDrag('cells')
    box.current?.focus({ preventScroll: true })
  }
  const cellEnter = (p: Pos) => {
    if (drag === 'cells') setSel({ a: sel.a, f: p })
    else if (drag === 'rows') setSel({ a: sel.a, f: { r: p.r, c: tab.cols - 1 } })
    else if (drag === 'cols') setSel({ a: sel.a, f: { r: tab.rows - 1, c: p.c } })
  }
  const rowDown = (e: React.MouseEvent, r: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (editing) commit()
    setSel(e.shiftKey ? { a: { r: sel.a.r, c: 0 }, f: { r, c: tab.cols - 1 } } : { a: { r, c: 0 }, f: { r, c: tab.cols - 1 } })
    setDrag('rows')
    box.current?.focus({ preventScroll: true })
  }
  const colDown = (e: React.MouseEvent, c: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (editing) commit()
    setSel(e.shiftKey ? { a: { r: 0, c: sel.a.c }, f: { r: tab.rows - 1, c } } : { a: { r: 0, c }, f: { r: tab.rows - 1, c } })
    setDrag('cols')
    box.current?.focus({ preventScroll: true })
  }
  const headerMenu = (e: React.MouseEvent, kind: 'rows' | 'cols', index: number) => {
    e.preventDefault()
    if (readOnly) return
    const inside = kind === 'rows' ? index >= g.r1 && index <= g.r2 : index >= g.c1 && index <= g.c2
    if (!inside) setSel(kind === 'rows' ? { a: { r: index, c: 0 }, f: { r: index, c: tab.cols - 1 } } : { a: { r: 0, c: index }, f: { r: tab.rows - 1, c: index } })
    setMenu({ kind, rect: new DOMRect(e.clientX, e.clientY, 0, 0) })
  }

  /* ── desenhar ── */
  const total = HEADER_W + Array.from({ length: tab.cols }, (_, c) => width(c)).reduce((a, b) => a + b, 0)
  const rows: number[] = []
  for (let r = first; r < last; r++) rows.push(r)
  const fullCols = g.r1 === 0 && g.r2 === tab.rows - 1
  const fullRows = g.c1 === 0 && g.c2 === tab.cols - 1
  const menuRange: Range = g

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={box}
        tabIndex={0}
        role="grid"
        aria-label={`Folha ${tab.name}`}
        aria-readonly={readOnly}
        className="min-h-0 flex-1 overflow-auto bg-white outline-none"
        onScroll={e => {
          // ler já: no fim do evento o currentTarget passa a null
          const top = e.currentTarget.scrollTop
          setView(v => ({ ...v, top }))
        }}
        onKeyDown={onKeyDown}
        onCopy={e => onCopy(e)}
        onCut={e => { if (!readOnly) onCopy(e, true) }}
        onPaste={onPaste}
      >
        <table className="select-none border-separate border-spacing-0 text-[13px]" style={{ tableLayout: 'fixed', width: total }}>
          <colgroup>
            <col style={{ width: HEADER_W }} />
            {Array.from({ length: tab.cols }, (_, c) => <col key={c} style={{ width: width(c) }} />)}
          </colgroup>
          <thead>
            <tr style={{ height: HEADER_H }}>
              <th className="sticky left-0 top-0 z-30 border-b border-r border-line bg-snow" onMouseDown={e => { e.preventDefault(); setSel({ a: { r: 0, c: 0 }, f: { r: tab.rows - 1, c: tab.cols - 1 } }) }} aria-label="Seleccionar tudo" />
              {Array.from({ length: tab.cols }, (_, c) => {
                const on = c >= g.c1 && c <= g.c2
                return (
                  <th
                    key={c}
                    onMouseDown={e => colDown(e, c)}
                    onMouseEnter={() => cellEnter({ r: 0, c })}
                    onContextMenu={e => headerMenu(e, 'cols', c)}
                    className={`sticky top-0 z-20 border-b border-r border-line text-[12px] font-extrabold ${on ? (fullCols ? 'bg-brand text-white' : 'bg-brand-light text-brand-dark') : 'bg-snow text-muted'}`}
                  >
                    {colName(c)}
                    {!readOnly && (
                      <span
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setResize({ col: c, x: e.clientX, w: width(c), now: width(c) }) }}
                        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-brand/40"
                        aria-hidden
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {first > 0 && <tr style={{ height: first * ROW_HEIGHT }}><td colSpan={tab.cols + 1} /></tr>}
            {rows.map(r => {
              const rowOn = r >= g.r1 && r <= g.r2
              return (
                <tr key={r} style={{ height: ROW_HEIGHT }}>
                  <th
                    onMouseDown={e => rowDown(e, r)}
                    onMouseEnter={() => cellEnter({ r, c: 0 })}
                    onContextMenu={e => headerMenu(e, 'rows', r)}
                    className={`sticky left-0 z-10 border-b border-r border-line text-[12px] font-extrabold ${rowOn ? (fullRows ? 'bg-brand text-white' : 'bg-brand-light text-brand-dark') : 'bg-snow text-muted'}`}
                  >
                    {r + 1}
                  </th>
                  {Array.from({ length: tab.cols }, (_, c) => {
                    const key = cellKey(r, c)
                    const active = r === sel.a.r && c === sel.a.c
                    const inRange = rowOn && c >= g.c1 && c <= g.c2
                    const f = tab.fmt?.[key]
                    if (active && editing?.where === 'cell') {
                      return (
                        <td key={c} className="relative border-b border-r border-line p-0" style={{ boxShadow: 'inset 0 0 0 2px #7B61FF' }}>
                          <input
                            ref={input}
                            value={editing.value}
                            onChange={e => setEditing({ ...editing, value: e.target.value })}
                            onKeyDown={onInputKey}
                            onBlur={() => commit()}
                            aria-label={`Editar ${key}`}
                            className="absolute inset-0 h-full min-w-full bg-white px-1.5 text-[13px] text-ink outline-none"
                            style={{ fontWeight: f?.b ? 700 : 500, fontStyle: f?.i ? 'italic' : undefined, width: Math.max(width(c), editing.value.length * 8 + 16) }}
                          />
                        </td>
                      )
                    }
                    const v = calc.value(tab.id, key)
                    const shownText = active && editing?.where === 'bar' ? editing.value : display(v, f?.nf)
                    const align = f?.align ?? (typeof v === 'number' ? 'right' : typeof v === 'boolean' || isError(v) ? 'center' : 'left')
                    return (
                      <td
                        key={c}
                        onMouseDown={e => cellDown(e, { r, c })}
                        onMouseEnter={() => cellEnter({ r, c })}
                        onDoubleClick={() => startEdit(raw({ r, c }), 'edit')}
                        className={`overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-line px-1.5 ${isError(v) ? 'text-danger' : 'text-ink'}`}
                        style={{
                          textAlign: align,
                          fontWeight: f?.b ? 700 : 500,
                          fontStyle: f?.i ? 'italic' : undefined,
                          background: inRange && !active ? 'rgba(123,97,255,0.12)' : f?.bg,
                          boxShadow: active ? 'inset 0 0 0 2px #7B61FF' : undefined,
                        }}
                        title={isError(v) ? 'Erro na fórmula' : undefined}
                      >
                        {shownText}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {last < tab.rows && <tr style={{ height: (tab.rows - last) * ROW_HEIGHT }}><td colSpan={tab.cols + 1} /></tr>}
          </tbody>
        </table>
        {!readOnly && (tab.rows < MAX_ROWS || tab.cols < MAX_COLS) && (
          <div className="sticky left-0 flex gap-2 p-3">
            {tab.rows < MAX_ROWS && <button onClick={() => run([{ type: 'size.add', tabId: tab.id, rows: 100 }])} className="chip py-1 text-xs">+ 100 linhas</button>}
            {tab.cols < MAX_COLS && <button onClick={() => run([{ type: 'size.add', tabId: tab.id, cols: 5 }])} className="chip py-1 text-xs">+ 5 colunas</button>}
          </div>
        )}
      </div>

      {menu && (() => {
        const rowsK = menu.kind === 'rows'
        const at = rowsK ? menuRange.r1 : menuRange.c1
        const count = rowsK ? menuRange.r2 - menuRange.r1 + 1 : menuRange.c2 - menuRange.c1 + 1
        const word = rowsK ? (count === 1 ? 'linha' : `${count} linhas`) : count === 1 ? 'coluna' : `${count} colunas`
        const close = () => setMenu(null)
        const ins = (before: boolean) => { run([{ type: rowsK ? 'rows.insert' : 'cols.insert', tabId: tab.id, at: before ? at : at + count, count }]); close() }
        return (
          <Popover anchor={menu.rect} title={rowsK ? `Linha${count > 1 ? 's' : ''} ${menuRange.r1 + 1}${count > 1 ? `–${menuRange.r2 + 1}` : ''}` : `Coluna${count > 1 ? 's' : ''} ${colName(menuRange.c1)}${count > 1 ? `–${colName(menuRange.c2)}` : ''}`} onClose={close} width={260}>
            <MenuItem icon={rowsK ? <ArrowUpIcon size={16} /> : <ArrowLeftIcon size={16} />} onClick={() => ins(true)}>Inserir {word} {rowsK ? 'acima' : 'à esquerda'}</MenuItem>
            <MenuItem icon={rowsK ? <ArrowDownIcon size={16} /> : <ArrowRightIcon size={16} />} onClick={() => ins(false)}>Inserir {word} {rowsK ? 'abaixo' : 'à direita'}</MenuItem>
            <MenuDivider />
            <MenuItem icon={<EraserIcon size={16} />} onClick={() => { clearRange(); close() }}>Limpar conteúdo</MenuItem>
            <MenuItem danger icon={<TrashIcon size={16} />} onClick={() => {
              run([{ type: rowsK ? 'rows.delete' : 'cols.delete', tabId: tab.id, at, count }])
              setSel({ a: { r: rowsK ? at : 0, c: rowsK ? 0 : at }, f: { r: rowsK ? at : 0, c: rowsK ? 0 : at } })
              close()
            }}>Apagar {word}</MenuItem>
          </Popover>
        )
      })()}
    </div>
  )
}
