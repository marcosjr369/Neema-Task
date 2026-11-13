'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DownloadSimpleIcon, EyeIcon, FunctionIcon } from '@phosphor-icons/react'
import SheetGrid, { type Sel } from './SheetGrid'
import Mascot from '../ui/Mascot'
import { Calc } from '../../lib/sheets/formula'
import { download, writeXlsx } from '../../lib/sheets/files'
import { cellKey, normRange, rangeLabel } from '../../lib/sheets/refs'
import type { SheetView } from '../../types'

const noop = () => undefined

/** Planilha aberta por link (sem conta ou sem convite): só leitura, mas pode copiar e descarregar */
export default function PublicSheet({ sheet, signedIn }: { sheet: SheetView; signedIn: boolean }) {
  const [tabId, setTabId] = useState(sheet.tabs[0]?.id)
  const [sel, setSel] = useState<Sel>({ a: { r: 0, c: 0 }, f: { r: 0, c: 0 } })
  const calc = useMemo(() => new Calc(sheet.tabs), [sheet])
  const tab = sheet.tabs.find(t => t.id === tabId) ?? sheet.tabs[0]
  if (!tab) return null
  const raw = tab.cells[cellKey(sel.a.r, sel.a.c)] ?? ''

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b-2 border-line px-4 py-2.5">
        <Link href="/" className="flex items-center gap-1.5 rounded-xl px-1 py-1" aria-label="Udacha">
          <Mascot size={26} />
          <span className="text-sm font-black text-brand">udacha</span>
        </Link>
        <h1 className="min-w-0 truncate px-2 text-xl font-black text-ink">{sheet.title}</h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body"><EyeIcon size={14} /> Só ver</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => download(`${sheet.title.replace(/[\\/:*?"<>|]/g, '') || 'planilha'}.xlsx`, writeXlsx(sheet.tabs) as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            className="chip text-xs"><DownloadSimpleIcon size={16} /> Descarregar</button>
          {!signedIn && <Link href="/entrar" className="btn btn-primary px-3 py-2 text-xs">Criar as tuas planilhas</Link>}
        </div>
      </header>
      <div className="flex items-center gap-2 border-b-2 border-line px-3 py-1">
        <span className="w-24 shrink-0 truncate rounded-lg bg-snow px-2 py-1 text-center text-xs font-black text-body">{rangeLabel(normRange(sel.a, sel.f))}</span>
        <FunctionIcon size={16} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate px-2 py-1 font-mono text-[13px] text-ink">{raw}</span>
      </div>
      <div className="min-h-0 flex-1">
        <SheetGrid key={tab.id} tab={tab} calc={calc} readOnly sel={sel} setSel={setSel} editing={null} setEditing={noop} setCells={noop} run={noop} onShortcut={noop} />
      </div>
      {sheet.tabs.length > 1 && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t-2 border-line bg-snow px-2 py-1.5" aria-label="Folhas">
          {sheet.tabs.map(t => (
            <button key={t.id} onClick={() => { setTabId(t.id); setSel({ a: { r: 0, c: 0 }, f: { r: 0, c: 0 } }) }}
              className={`shrink-0 rounded-lg px-3 py-1 text-sm font-extrabold cursor-pointer ${t.id === tab.id ? 'bg-white text-brand-dark shadow-sm ring-2 ring-brand/30' : 'text-body hover:bg-white'}`}>
              {t.name}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
