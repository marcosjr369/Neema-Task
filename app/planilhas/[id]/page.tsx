'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import {
  ArrowUUpLeftIcon, ArrowUUpRightIcon, CaretDownIcon, CaretLeftIcon, CheckIcon, CloudCheckIcon, CloudArrowUpIcon, CurrencyEurIcon, DotsThreeIcon,
  DownloadSimpleIcon, EyeIcon, FunctionIcon, GlobeIcon, LockIcon, PaintBucketIcon, PercentIcon, PlusIcon, ShareNetworkIcon, SignOutIcon,
  TextAlignCenterIcon, TextAlignLeftIcon, TextAlignRightIcon, TextBIcon, TextItalicIcon, TrashIcon, UploadSimpleIcon, UsersThreeIcon,
} from '@phosphor-icons/react'
import { useSheet } from '../../components/sheets/useSheet'
import SheetGrid, { type Editing, type Sel } from '../../components/sheets/SheetGrid'
import ShareDialog from '../../components/boards/ShareDialog'
import Popover, { MenuDivider, MenuItem, MenuTitle } from '../../components/boards/Popover'
import Avatar from '../../components/ui/Avatar'
import Mascot from '../../components/ui/Mascot'
import { api, errorText } from '../../lib/api'
import { Calc, FUNCTION_HELP } from '../../lib/sheets/formula'
import { FILL_COLORS, type FmtPatch, type SheetOp } from '../../lib/sheets/ops'
import { cellKey, normRange, rangeLabel } from '../../lib/sheets/refs'
import { download, readSheetFile, writeCsv, writeXlsx } from '../../lib/sheets/files'
import { useApp } from '../../context/AppContext'
import type { CellAlign, NumberFormat, SheetView } from '../../types'
import { SheetSkeleton } from '../../components/ui/Skeleton'

type Step = { tabId: string; before: Record<string, string>; after: Record<string, string> }

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim() || 'planilha'

function Tool({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: (e: React.MouseEvent) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={active}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-extrabold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-brand-light text-brand-dark' : 'text-body hover:bg-snow'}`}>
      {children}
    </button>
  )
}

function Visibility({ sheet, orgName }: { sheet: SheetView; orgName?: string }) {
  const v = sheet.sharing.visibility
  const Icon = v === 'org' ? UsersThreeIcon : v === 'link' ? GlobeIcon : LockIcon
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body">
      <Icon size={14} /> {v === 'org' ? orgName ?? 'Empresa' : v === 'link' ? 'Público com link' : 'Privado'}
    </span>
  )
}

export default function SheetPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useApp()
  const { data, error, saving, load, run } = useSheet(id)
  const [tabId, setTabId] = useState<string | null>(null)
  const [sel, setSel] = useState<Sel>({ a: { r: 0, c: 0 }, f: { r: 0, c: 0 } })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [share, setShare] = useState(() => typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('partilha'))
  const [pop, setPop] = useState<{ kind: 'menu' | 'fill' | 'nf' | 'fx' | 'export' | 'tab'; rect: DOMRect; tabId?: string } | null>(null)
  const [renaming, setRenaming] = useState<{ tabId: string; name: string } | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const undo = useRef<Step[]>([])
  const redo = useRef<Step[]>([])
  // tamanhos do histórico, para os botões (as listas vivem em refs)
  const [hist, setHist] = useState({ undo: 0, redo: 0 })
  const bump = () => setHist({ undo: undo.current.length, redo: redo.current.length })
  const fileInput = useRef<HTMLInputElement>(null)

  const sheet = data?.sheet
  const tab = sheet ? sheet.tabs.find(t => t.id === tabId) ?? sheet.tabs[0] : undefined
  const calc = useMemo(() => new Calc(sheet?.tabs ?? []), [sheet])

  if (error && !data) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={100} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">{error.status === 403 ? 'Sem acesso' : error.status === 404 ? 'Planilha não encontrada' : 'Algo correu mal'}</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">{error.text}</p>
        <Link href="/planilhas" className="btn btn-primary mt-6">Ver as minhas planilhas</Link>
      </div>
    )
  }
  if (!data || !sheet || !tab) return <div className="h-[calc(100dvh-84px)] lg:h-dvh"><SheetSkeleton /></div>

  const { access, people, orgName, requests } = data
  const readOnly = access === 'view'
  const g = normRange(sel.a, sel.f)
  const activeKey = cellKey(sel.a.r, sel.a.c)
  const fmt = tab.fmt?.[activeKey] ?? {}
  const rawActive = tab.cells[activeKey] ?? ''

  /* ── alterações ── */
  const runOps = (ops: SheetOp[]) => {
    // inserir/apagar mexe nos endereços: o histórico de anular deixa de valer
    if (ops.some(o => /insert|delete/.test(o.type))) { undo.current = []; redo.current = []; bump() }
    return run(ops)
  }
  const setCells = (changes: Record<string, string>, onTab = tab) => {
    const before: Record<string, string> = {}
    for (const k of Object.keys(changes)) before[k] = onTab.cells[k] ?? ''
    if (run([{ type: 'cells.set', tabId: onTab.id, cells: changes }])) {
      undo.current.push({ tabId: onTab.id, before, after: changes })
      if (undo.current.length > 100) undo.current.shift()
      redo.current = []
      bump()
    }
  }
  const step = (from: React.RefObject<Step[]>, to: React.RefObject<Step[]>, back: boolean) => {
    const s = from.current.pop()
    if (!s) return
    if (!sheet.tabs.some(t => t.id === s.tabId)) return
    if (run([{ type: 'cells.set', tabId: s.tabId, cells: back ? s.before : s.after }])) {
      to.current.push(s)
      setTabId(s.tabId)
    }
    bump()
  }
  const format = (patch: FmtPatch) => { if (!readOnly) runOps([{ type: 'format.set', tabId: tab.id, range: g, fmt: patch }]) }
  const shortcut = (k: 'bold' | 'italic' | 'undo' | 'redo') => {
    if (readOnly) return
    if (k === 'bold') format({ b: !fmt.b || null })
    else if (k === 'italic') format({ i: !fmt.i || null })
    else if (k === 'undo') step(undo, redo, true)
    else step(redo, undo, false)
  }

  /* ── barra de fórmulas ── */
  const barValue = editing ? editing.value : rawActive
  const commitBar = () => {
    if (editing?.where !== 'bar') return
    if (editing.value !== rawActive) setCells({ [activeKey]: editing.value })
    setEditing(null)
  }

  /* ── ficheiros ── */
  const importFile = async (file: File) => {
    try {
      const tabs = await readSheetFile(file)
      const ok = run(tabs.map(t => ({ type: 'tab.import' as const, name: t.name, rows: t.rows, cols: t.cols, cells: t.cells, widths: t.widths })))
      if (ok) {
        showToast(`${tabs.length === 1 ? 'Folha importada' : `${tabs.length} folhas importadas`}`, 'success')
        setTabId(null)
      }
    } catch (err) {
      showToast(errorText(err, 'Não foi possível importar o ficheiro.'), 'danger')
    }
  }
  const exportXlsx = () => download(`${safeName(sheet.title)}.xlsx`, writeXlsx(sheet.tabs) as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const exportCsv = () => download(`${safeName(sheet.title)} - ${safeName(tab.name)}.csv`, writeCsv(tab, calc), 'text/csv;charset=utf-8')

  const leave = async () => {
    if (!confirm('Sair desta planilha? Deixas de a ver até alguém te convidar outra vez.')) return
    try {
      await api(`/api/planilhas/${id}/share`, { method: 'DELETE' })
      router.replace('/planilhas')
    } catch (err) { showToast(errorText(err, 'Não foi possível sair da planilha. Tenta outra vez.'), 'danger') }
  }
  const remove = async () => {
    if (!confirm(`Apagar a planilha "${sheet.title}" com todas as folhas? Não dá para desfazer.`)) return
    try {
      await api(`/api/planilhas/${id}`, { method: 'DELETE' })
      showToast('Planilha apagada', 'success')
      router.replace('/planilhas')
    } catch (err) { showToast(errorText(err, 'Não foi possível apagar a planilha. Tenta outra vez.'), 'danger') }
  }

  const open = (kind: NonNullable<typeof pop>['kind'], tid?: string) => (e: React.MouseEvent) => setPop({ kind, rect: e.currentTarget.getBoundingClientRect(), tabId: tid })
  const alignIcon = { left: TextAlignLeftIcon, center: TextAlignCenterIcon, right: TextAlignRightIcon }
  const NF_LABEL: Record<NumberFormat | 'geral', string> = { geral: 'Geral', num2: 'Número (0,00)', eur: 'Moeda (€)', pct: 'Percentagem (%)' }
  const popTab = pop?.tabId ? sheet.tabs.find(t => t.id === pop.tabId) : undefined
  const popTabIndex = popTab ? sheet.tabs.indexOf(popTab) : -1

  return (
    <div className="flex h-[calc(100dvh-84px)] flex-col bg-white lg:h-dvh">
      {/* cabeçalho */}
      <header className="flex flex-wrap items-center gap-2 border-b-2 border-line px-3 py-2 lg:px-5">
        <Link href="/planilhas" aria-label="Voltar às planilhas" className="rounded-xl p-2 text-muted hover:bg-snow"><CaretLeftIcon size={20} /></Link>
        {title !== null && !readOnly ? (
          <input className="input w-auto min-w-0 py-1.5 text-lg font-black" value={title} autoFocus maxLength={80} aria-label="Nome da planilha"
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title.trim() !== sheet.title) runOps([{ type: 'sheet.update', title }]); setTitle(null) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTitle(null) }} />
        ) : (
          <h1 className={`min-w-0 truncate rounded-xl px-2 py-1 text-xl font-black text-ink ${readOnly ? '' : 'cursor-text hover:bg-snow'}`} onClick={() => { if (!readOnly) setTitle(sheet.title) }}>
            {sheet.title}
          </h1>
        )}
        <Visibility sheet={sheet} orgName={orgName} />
        {readOnly && <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body"><EyeIcon size={14} /> Só ver</span>}
        {!readOnly && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted" aria-live="polite">
            {saving ? <><CloudArrowUpIcon size={16} /> A guardar…</> : <><CloudCheckIcon size={16} /> Guardado</>}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden -space-x-2 sm:flex">
            {people.slice(0, 5).map(p => <span key={p.userId} title={p.name} className="rounded-full ring-2 ring-white"><Avatar name={p.name} picture={p.picture} size={28} /></span>)}
          </span>
          {access === 'owner' && (
            <button onClick={() => setShare(true)} className="btn btn-primary relative px-3 py-2 text-xs">
              <ShareNetworkIcon size={16} /> Partilhar
              {requests > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-danger px-1.5 text-[11px] font-black text-white">{requests}</span>}
            </button>
          )}
          <button onClick={open('menu')} aria-label="Menu da planilha" className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer"><DotsThreeIcon size={22} weight="bold" /></button>
        </div>
      </header>

      {/* ferramentas */}
      <div className="flex flex-wrap items-center gap-0.5 border-b-2 border-line px-2 py-1 lg:px-4">
        {!readOnly && (
          <>
            <Tool label="Anular (Ctrl+Z)" onClick={() => shortcut('undo')} disabled={!hist.undo}><ArrowUUpLeftIcon size={18} /></Tool>
            <Tool label="Refazer (Ctrl+Y)" onClick={() => shortcut('redo')} disabled={!hist.redo}><ArrowUUpRightIcon size={18} /></Tool>
            <span className="mx-1 h-5 w-0.5 bg-line" />
            <Tool label="Negrito (Ctrl+B)" active={!!fmt.b} onClick={() => format({ b: !fmt.b || null })}><TextBIcon size={18} /></Tool>
            <Tool label="Itálico (Ctrl+I)" active={!!fmt.i} onClick={() => format({ i: !fmt.i || null })}><TextItalicIcon size={18} /></Tool>
            {(['left', 'center', 'right'] as CellAlign[]).map(a => {
              const Icon = alignIcon[a]
              return <Tool key={a} label={{ left: 'Alinhar à esquerda', center: 'Centrar', right: 'Alinhar à direita' }[a]} active={fmt.align === a} onClick={() => format({ align: fmt.align === a ? null : a })}><Icon size={18} /></Tool>
            })}
            <Tool label="Cor de fundo" onClick={open('fill')}>
              <PaintBucketIcon size={18} /><span className="h-3 w-3 rounded-sm border border-line" style={{ background: fmt.bg ?? '#fff' }} />
            </Tool>
            <Tool label="Formato de número" onClick={open('nf')}>
              {fmt.nf === 'eur' ? <CurrencyEurIcon size={18} /> : fmt.nf === 'pct' ? <PercentIcon size={18} /> : <span className="text-xs">{fmt.nf === 'num2' ? '0,00' : '123'}</span>}
              <CaretDownIcon size={12} />
            </Tool>
            <span className="mx-1 h-5 w-0.5 bg-line" />
          </>
        )}
        <Tool label="Funções disponíveis" onClick={open('fx')}><FunctionIcon size={18} /></Tool>
        <div className="ml-auto flex items-center gap-0.5">
          {!readOnly && <Tool label="Importar .xlsx ou .csv como nova folha" onClick={() => fileInput.current?.click()}><UploadSimpleIcon size={18} /><span className="hidden text-xs sm:inline">Importar</span></Tool>}
          <Tool label="Exportar" onClick={open('export')}><DownloadSimpleIcon size={18} /><span className="hidden text-xs sm:inline">Exportar</span></Tool>
        </div>
        <input ref={fileInput} type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f) }} />
      </div>

      {/* barra de fórmulas */}
      <div className="flex items-center gap-2 border-b-2 border-line px-2 py-1 lg:px-4">
        <span className="w-24 shrink-0 truncate rounded-lg bg-snow px-2 py-1 text-center text-xs font-black text-body">{rangeLabel(g)}</span>
        <FunctionIcon size={16} className="shrink-0 text-muted" />
        <input
          className="min-w-0 flex-1 rounded-lg border-2 border-transparent px-2 py-1 font-mono text-[13px] text-ink outline-none focus:border-accent"
          value={barValue}
          readOnly={readOnly}
          aria-label="Conteúdo da célula"
          placeholder={readOnly ? '' : 'Escreve um valor ou uma fórmula, ex.: =SOMA(A1:A10)'}
          onFocus={() => { if (!readOnly && !editing) setEditing({ value: rawActive, mode: 'edit', where: 'bar' }) }}
          onChange={e => setEditing({ value: e.target.value, mode: 'edit', where: 'bar' })}
          onBlur={commitBar}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitBar(); (e.target as HTMLInputElement).blur() }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(null); (e.target as HTMLInputElement).blur() }
          }}
        />
      </div>

      {/* grelha */}
      <div className="min-h-0 flex-1">
        <SheetGrid
          key={tab.id}
          tab={tab}
          calc={calc}
          readOnly={readOnly}
          sel={sel}
          setSel={s => { setSel(s); if (editing?.where === 'bar') setEditing(null) }}
          editing={editing}
          setEditing={setEditing}
          setCells={changes => setCells(changes)}
          run={ops => { runOps(ops) }}
          onShortcut={shortcut}
        />
      </div>

      {/* folhas */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t-2 border-line bg-snow px-2 py-1.5" aria-label="Folhas">
        {!readOnly && (
          <button onClick={() => { if (run([{ type: 'tab.add' }])) setTabId(null) }} aria-label="Nova folha" className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-brand cursor-pointer">
            <PlusIcon size={18} />
          </button>
        )}
        {sheet.tabs.map(t => (
          renaming?.tabId === t.id ? (
            <input key={t.id} className="w-36 rounded-lg border-2 border-accent bg-white px-2 py-1 text-sm font-extrabold text-ink outline-none" value={renaming.name} autoFocus maxLength={40}
              onChange={e => setRenaming({ tabId: t.id, name: e.target.value })}
              onBlur={() => { if (renaming.name.trim() && renaming.name.trim() !== t.name) runOps([{ type: 'tab.rename', tabId: t.id, name: renaming.name }]); setRenaming(null) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null) }} />
          ) : (
            <button key={t.id}
              onClick={() => { setTabId(t.id); setSel({ a: { r: 0, c: 0 }, f: { r: 0, c: 0 } }); setEditing(null) }}
              onDoubleClick={() => { if (!readOnly) setRenaming({ tabId: t.id, name: t.name }) }}
              onContextMenu={e => { if (!readOnly) { e.preventDefault(); setPop({ kind: 'tab', rect: e.currentTarget.getBoundingClientRect(), tabId: t.id }) } }}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-sm font-extrabold cursor-pointer ${t.id === tab.id ? 'bg-white text-brand-dark shadow-sm ring-2 ring-brand/30' : 'text-body hover:bg-white'}`}>
              {t.name}
              {!readOnly && t.id === tab.id && (
                <span role="button" tabIndex={0} aria-label={`Opções da folha ${t.name}`} onClick={e => { e.stopPropagation(); open('tab', t.id)(e) }}
                  className="-mr-1 rounded p-0.5 text-muted hover:bg-snow"><CaretDownIcon size={12} /></span>
              )}
            </button>
          )
        ))}
      </nav>

      {/* painéis */}
      {pop && (
        <Popover anchor={pop.rect} title={{ menu: 'Menu', fill: 'Cor de fundo', nf: 'Formato de número', fx: 'Funções', export: 'Exportar', tab: popTab?.name ?? 'Folha' }[pop.kind]}
          onClose={() => setPop(null)} width={pop.kind === 'fx' ? 360 : 280}>
          {pop.kind === 'menu' && (
            <>
              {access === 'owner' && <MenuItem icon={<ShareNetworkIcon size={18} />} onClick={() => { setPop(null); setShare(true) }}>Partilhar</MenuItem>}
              <MenuItem icon={<DownloadSimpleIcon size={18} />} onClick={() => { setPop(null); exportXlsx() }}>Descarregar .xlsx</MenuItem>
              {access !== 'owner' && sheet.sharing.visibility !== 'org' && <MenuItem icon={<SignOutIcon size={18} />} onClick={() => { setPop(null); leave() }}>Sair da planilha</MenuItem>}
              {access === 'owner' && (<><MenuDivider /><MenuItem danger icon={<TrashIcon size={18} />} onClick={() => { setPop(null); remove() }}>Apagar planilha</MenuItem></>)}
            </>
          )}
          {pop.kind === 'fill' && (
            <div className="grid grid-cols-5 gap-2">
              {FILL_COLORS.map(c => (
                <button key={c} onClick={() => { format({ bg: c }); setPop(null) }} aria-label={`Cor ${c}`} className="flex h-9 items-center justify-center rounded-lg border-2 border-line cursor-pointer" style={{ background: c }}>
                  {fmt.bg === c && <CheckIcon size={14} />}
                </button>
              ))}
              <button onClick={() => { format({ bg: null }); setPop(null) }} className="h-9 rounded-lg border-2 border-line text-[11px] font-black text-muted cursor-pointer">Sem</button>
            </div>
          )}
          {pop.kind === 'nf' && (['geral', 'num2', 'eur', 'pct'] as const).map(nf => (
            <MenuItem key={nf} icon={(fmt.nf ?? 'geral') === nf ? <CheckIcon size={16} /> : <span className="inline-block w-4" />} onClick={() => { format({ nf: nf === 'geral' ? null : nf }); setPop(null) }}>
              {NF_LABEL[nf]}
            </MenuItem>
          ))}
          {pop.kind === 'fx' && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-muted">Começa por <b className="text-ink">=</b>. Separa os argumentos com <b className="text-ink">;</b> e usa intervalos como <b className="text-ink">A1:B5</b>. Para outra folha: <b className="text-ink">Folha2!A1</b>.</p>
              <ul className="divide-y-2 divide-line">
                {FUNCTION_HELP.map(([f, d]) => (
                  <li key={f} className="py-1.5"><code className="font-mono text-[12px] font-bold text-brand-dark">={f}</code><span className="block text-xs font-semibold text-muted">{d}</span></li>
                ))}
              </ul>
              <p className="text-xs font-semibold text-muted">Também aceita os nomes em inglês (SUM, AVERAGE, IF…) e operadores + − * / ^ &amp; = &lt; &gt;.</p>
            </div>
          )}
          {pop.kind === 'export' && (
            <>
              <MenuItem icon={<DownloadSimpleIcon size={18} />} onClick={() => { setPop(null); exportXlsx() }}>Excel (.xlsx), todas as folhas</MenuItem>
              <MenuItem icon={<DownloadSimpleIcon size={18} />} onClick={() => { setPop(null); exportCsv() }}>CSV (.csv), só esta folha</MenuItem>
            </>
          )}
          {pop.kind === 'tab' && popTab && (
            <>
              <MenuItem onClick={() => { setPop(null); setRenaming({ tabId: popTab.id, name: popTab.name }) }}>Mudar o nome</MenuItem>
              <MenuItem disabled={popTabIndex <= 0} onClick={() => { runOps([{ type: 'tab.move', tabId: popTab.id, index: popTabIndex - 1 }]); setPop(null) }}>Mover para a esquerda</MenuItem>
              <MenuItem disabled={popTabIndex >= sheet.tabs.length - 1} onClick={() => { runOps([{ type: 'tab.move', tabId: popTab.id, index: popTabIndex + 1 }]); setPop(null) }}>Mover para a direita</MenuItem>
              <MenuTitle>Perigo</MenuTitle>
              <MenuItem danger disabled={sheet.tabs.length <= 1} icon={<TrashIcon size={16} />} onClick={() => {
                setPop(null)
                if (!confirm(`Apagar a folha "${popTab.name}"? As fórmulas que a usam passam a mostrar #REF!.`)) return
                if (runOps([{ type: 'tab.delete', tabId: popTab.id }]) && popTab.id === tab.id) setTabId(null)
              }}>Apagar folha</MenuItem>
            </>
          )}
        </Popover>
      )}

      {share && <ShareDialog endpoint={`/api/planilhas/${id}/share`} noun="planilha" isOrg={!!sheet.orgId} orgName={orgName} onClose={() => setShare(false)} onChanged={load} />}
    </div>
  )
}
