'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EyeIcon, FileXlsIcon, GlobeIcon, LockIcon, PlusIcon, TableIcon, UploadSimpleIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react'
import Modal from '../components/ui/Modal'
import Mascot from '../components/ui/Mascot'
import { api, errorText } from '../lib/api'
import { readSheetFile, type ImportedTab } from '../lib/sheets/files'
import { useApp } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import { CreateLocked, useCan } from '../components/layout/useCan'
import type { SheetSummary, ShareVisibility } from '../types'
import { ListSkeleton } from '../components/ui/Skeleton'
import { Busy } from '../components/ui/Spinner'

const VIS_ICON = { org: UsersThreeIcon, link: GlobeIcon, private: LockIcon }

const ago = (t: number) => {
  const d = Math.round((Date.now() - t) / 60000)
  if (d < 1) return 'agora mesmo'
  if (d < 60) return `há ${d} min`
  if (d < 1440) return `há ${Math.round(d / 60)} h`
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(t)
}

function Row({ s }: { s: SheetSummary }) {
  const Icon = VIS_ICON[s.visibility]
  return (
    <li>
      <Link href={`/planilhas/${s.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-snow">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><TableIcon size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black text-ink">{s.title}</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
            <Icon size={13} /> {s.tabs} folha{s.tabs === 1 ? '' : 's'} · {ago(s.updatedAt)}{!s.mine && s.ownerName ? ` · ${s.ownerName}` : ''}
          </span>
        </span>
        {s.fresh && <span className="inline-flex items-center gap-1 rounded-lg bg-danger px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />Novo</span>}
        {s.access === 'view' && <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body"><EyeIcon size={13} /> Só ver</span>}
      </Link>
    </li>
  )
}

function Section({ title, hint, sheets }: { title: string; hint?: string; sheets: SheetSummary[] }) {
  if (!sheets.length) return null
  return (
    <section className="mb-7">
      <h2 className="font-black text-ink">{title}</h2>
      {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      <ul className="mt-2 divide-y-2 divide-line rounded-2xl border-2 border-line">{sheets.map(s => <Row key={s.id} s={s} />)}</ul>
    </section>
  )
}

function CreateDialog({ orgId, orgName, onClose }: { orgId?: string; orgName?: string; onClose: () => void }) {
  const router = useRouter()
  const { showToast } = useApp()
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<ShareVisibility>(orgId ? 'org' : 'private')
  const [tabs, setTabs] = useState<{ file: string; tabs: ImportedTab[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const options: { v: ShareVisibility; icon: typeof LockIcon; title: string; text: string }[] = orgId
    ? [
        { v: 'org', icon: UsersThreeIcon, title: 'Toda a empresa', text: `Todos em ${orgName ?? 'na empresa'} vêem e editam.` },
        { v: 'private', icon: LockIcon, title: 'Privada', text: 'Só tu, os administradores e quem convidares.' },
      ]
    : [
        { v: 'private', icon: LockIcon, title: 'Privada', text: 'Só quem convidares (ver ou editar), ou com senha.' },
        { v: 'link', icon: GlobeIcon, title: 'Pública com link', text: 'Qualquer pessoa com o link vê, mesmo sem conta.' },
      ]

  const pick = async (f: File) => {
    try {
      const read = await readSheetFile(f)
      setTabs({ file: f.name, tabs: read })
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80))
    } catch (err) {
      showToast(errorText(err, 'Não foi possível ler o ficheiro.'), 'danger')
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const { id } = await api<{ id: string }>('/api/planilhas', { body: { title, visibility, orgId, tabs: tabs?.tabs } })
      router.push(`/planilhas/${id}`)
    } catch (err) {
      showToast(errorText(err, 'Não foi possível criar a planilha. Tenta outra vez.'), 'danger')
      setBusy(false)
    }
  }

  return (
    <Modal title="Nova planilha" onClose={onClose}
      footer={<button className="btn btn-primary w-full" disabled={busy || !title.trim()} onClick={create}><Busy busy={busy} text="A criar…">Criar planilha</Busy></button>}>
      <label className="label" htmlFor="sheet-title">Nome</label>
      <input id="sheet-title" className="input" autoFocus maxLength={80} value={title} placeholder="Ex.: Orçamento 2026"
        onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) create() }} />

      <p className="label mt-4">Começar com</p>
      {tabs ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-accent bg-accent-light p-3">
          <FileXlsIcon size={26} className="text-accent-dark" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black text-ink">{tabs.file}</span>
            <span className="block text-xs font-bold text-body">{tabs.tabs.length} folha{tabs.tabs.length === 1 ? '' : 's'} · {tabs.tabs.reduce((n, t) => n + Object.keys(t.cells).length, 0).toLocaleString('pt-PT')} células</span>
          </span>
          <button onClick={() => setTabs(null)} aria-label="Tirar o ficheiro" className="rounded-lg p-1.5 text-muted hover:bg-white cursor-pointer"><XIcon size={16} /></button>
        </div>
      ) : (
        <button onClick={() => file.current?.click()} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3 text-left hover:bg-snow cursor-pointer">
          <UploadSimpleIcon size={24} className="text-muted" />
          <span>
            <span className="block font-black text-ink">Importar um ficheiro (opcional)</span>
            <span className="block text-sm font-semibold text-muted">Excel (.xlsx) ou CSV. Sem ficheiro, começa em branco.</span>
          </span>
        </button>
      )}
      <input ref={file} type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />

      <p className="label mt-4">Visibilidade</p>
      <div className="space-y-2">
        {options.map(o => (
          <button key={o.v} onClick={() => setVisibility(o.v)} aria-pressed={visibility === o.v}
            className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left cursor-pointer ${visibility === o.v ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}>
            <o.icon size={22} className={visibility === o.v ? 'text-brand' : 'text-muted'} />
            <span>
              <span className="block font-black text-ink">{o.title}</span>
              <span className="block text-sm font-semibold text-muted">{o.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-muted">Podes mudar isto depois em Partilhar.</p>
    </Modal>
  )
}

export default function SheetsPage() {
  // no espaço da empresa, criar pode estar reservado a algumas pessoas (Definições → Permissões)
  const canCreate = useCan('planilhas')
  const org = useOrg()
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setSheets((await api<{ sheets: SheetSummary[] }>('/api/planilhas')).sheets)
    } catch (err) {
      setError(errorText(err, 'Não foi possível carregar as planilhas.'))
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
  }, [load])

  const all = sheets ?? []
  const orgSheets = org ? all.filter(s => s.orgId === org.org.id) : []
  const mine = all.filter(s => !s.orgId && s.mine)
  const shared = all.filter(s => !s.mine && (!s.orgId || s.orgId !== org?.org.id))

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Planilhas</h1>
          <p className="text-sm font-bold text-muted">Folhas de cálculo partilhadas, com fórmulas, que podes importar e exportar para Excel</p>
        </div>
        {canCreate && <button onClick={() => setCreating(true)} className="btn btn-primary shrink-0 px-4 py-2.5"><PlusIcon size={18} /> <span className="max-sm:hidden">Nova planilha</span></button>}
      </header>

      <CreateLocked feature="planilhas" />

      {error && !sheets && <p className="rounded-2xl bg-danger-light p-4 font-bold text-danger-dark">{error}</p>}
      {!sheets && !error && <ListSkeleton rows={4} />}

      {sheets && all.length === 0 && (
        <div className="mb-8 flex flex-col items-center rounded-3xl bg-snow px-6 py-10 text-center">
          <Mascot size={96} />
          <h2 className="mt-3 text-xl font-black text-ink">Ainda não tens planilhas</h2>
          <p className="mt-1 max-w-sm font-semibold text-muted">Cria uma em branco ou importa um ficheiro do Excel, e partilha-a com quem precisa de ver ou editar.</p>
          {canCreate && <button onClick={() => setCreating(true)} className="btn btn-primary mt-5"><PlusIcon size={18} /> Nova planilha</button>}
        </div>
      )}
      {org && <Section title={`Planilhas de ${org.org.name}`} hint="Os colegas vêem-nas aqui, salvo as privadas." sheets={orgSheets} />}
      <Section title="As minhas planilhas" hint={org ? 'Planilhas pessoais, fora da empresa.' : undefined} sheets={mine} />
      <Section title="Partilhadas comigo" sheets={shared} />

      {creating && <CreateDialog orgId={org?.org.id} orgName={org?.org.name} onClose={() => setCreating(false)} />}
    </div>
  )
}
