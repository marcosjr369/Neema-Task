'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, EyeIcon, FileDashedIcon, FlowArrowIcon, GlobeIcon, LightbulbIcon, LockIcon, PlusIcon, RowsIcon, TreeStructureIcon, UploadSimpleIcon, UsersThreeIcon, XIcon, type Icon as PhIcon } from '@phosphor-icons/react'
import Modal from '../components/ui/Modal'
import Mascot from '../components/ui/Mascot'
import { api, errorText } from '../lib/api'
import { readDiagramFile } from '../lib/diagrams'
import { TEMPLATES, type TemplateId } from '../components/diagrams/templates'
import { useApp } from '../context/AppContext'
import { useOrg } from '../context/OrgContext'
import type { DiagramSummary, ShareVisibility } from '../types'
import { CardGridSkeleton } from '../components/ui/Skeleton'
import { Busy } from '../components/ui/Spinner'

const VIS_ICON = { org: UsersThreeIcon, link: GlobeIcon, private: LockIcon }

const TEMPLATE_LOOK: Record<TemplateId, { icon: PhIcon; bg: string; fg: string }> = {
  blank: { icon: FileDashedIcon, bg: 'bg-snow', fg: 'text-muted' },
  flowchart: { icon: FlowArrowIcon, bg: 'bg-brand-light', fg: 'text-brand' },
  lanes: { icon: RowsIcon, bg: 'bg-accent-light', fg: 'text-accent-dark' },
  org: { icon: TreeStructureIcon, bg: 'bg-warm-light', fg: 'text-warm-dark' },
  mind: { icon: LightbulbIcon, bg: 'bg-[#FCE6F2]', fg: 'text-pink-dark' },
}

const ago = (t: number) => {
  const d = Math.round((Date.now() - t) / 60000)
  if (d < 1) return 'agora mesmo'
  if (d < 60) return `há ${d} min`
  if (d < 1440) return `há ${Math.round(d / 60)} h`
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(t)
}

function Card({ d, i }: { d: DiagramSummary; i: number }) {
  const Icon = VIS_ICON[d.visibility]
  return (
    <li className="animate-dg-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
      <Link href={`/diagramas/${d.id}`}
        className="group block overflow-hidden rounded-2xl border-2 border-line bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_12px_28px_-12px_rgb(123_97_255/0.35)] active:translate-y-0">
        <span className="relative flex h-40 items-center justify-center overflow-hidden bg-snow p-3 [background-image:radial-gradient(#E3E0F0_1px,transparent_1px)] [background-size:14px_14px]">
          {d.preview
            // miniatura SVG gravada pelo editor; dentro de <img> não corre scripts
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={d.preview} alt="" className="max-h-full max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.06]" loading="lazy" />
            : <FlowArrowIcon size={40} className="text-muted/50 transition-transform duration-300 group-hover:scale-110" />}
          {d.access === 'view' && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-extrabold text-body shadow-sm"><EyeIcon size={13} /> Só ver</span>}
        </span>
        <span className="block border-t-2 border-line px-3 py-2.5">
          <span className="block truncate font-black text-ink group-hover:text-brand-dark">{d.title}</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
            <Icon size={13} /> <span className="truncate">{ago(d.updatedAt)}{!d.mine && d.ownerName ? ` · ${d.ownerName}` : ''}</span>
          </span>
        </span>
      </Link>
    </li>
  )
}

function Section({ title, hint, diagrams }: { title: string; hint?: string; diagrams: DiagramSummary[] }) {
  if (!diagrams.length) return null
  return (
    <section className="mb-7">
      <h2 className="font-black text-ink">{title}</h2>
      {hint && <p className="text-sm font-semibold text-muted">{hint}</p>}
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{diagrams.map((d, i) => <Card key={d.id} d={d} i={i} />)}</ul>
    </section>
  )
}

function CreateDialog({ orgId, orgName, onClose }: { orgId?: string; orgName?: string; onClose: () => void }) {
  const router = useRouter()
  const { showToast } = useApp()
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<ShareVisibility>(orgId ? 'org' : 'private')
  const [imported, setImported] = useState<{ file: string; xml: string } | null>(null)
  const [template, setTemplate] = useState<TemplateId>('flowchart')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const options: { v: ShareVisibility; icon: typeof LockIcon; title: string; text: string }[] = orgId
    ? [
        { v: 'org', icon: UsersThreeIcon, title: 'Toda a empresa', text: `Todos em ${orgName ?? 'na empresa'} vêem e editam.` },
        { v: 'private', icon: LockIcon, title: 'Privado', text: 'Só tu, os administradores e quem convidares.' },
      ]
    : [
        { v: 'private', icon: LockIcon, title: 'Privado', text: 'Só quem convidares (ver ou editar), ou com senha.' },
        { v: 'link', icon: GlobeIcon, title: 'Público com link', text: 'Qualquer pessoa com o link vê, mesmo sem conta.' },
      ]

  const pick = async (f: File) => {
    try {
      setImported({ file: f.name, xml: await readDiagramFile(f) })
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80))
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const { id } = await api<{ id: string }>('/api/diagramas', { body: { title, visibility, orgId, xml: imported?.xml ?? TEMPLATES.find(t => t.id === template)?.xml() } })
      router.push(`/diagramas/${id}`)
    } catch (err) {
      showToast(errorText(err), 'danger')
      setBusy(false)
    }
  }

  return (
    <Modal title="Novo diagrama" onClose={onClose} wide
      footer={<button className="btn btn-primary w-full" disabled={busy || !title.trim()} onClick={create}><Busy busy={busy} text="A criar…">Criar diagrama</Busy></button>}>
      <label className="label" htmlFor="diagram-title">Nome</label>
      <input id="diagram-title" className="input" autoFocus maxLength={80} value={title} placeholder="Ex.: Processo de vendas"
        onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) create() }} />

      <p className="label mt-4">Começar com</p>
      {imported ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-accent bg-accent-light p-3 animate-dg-rise">
          <FlowArrowIcon size={26} className="text-accent-dark" />
          <span className="min-w-0 flex-1 truncate font-black text-ink">{imported.file}</span>
          <button onClick={() => setImported(null)} aria-label="Tirar o ficheiro" className="rounded-lg p-1.5 text-muted hover:bg-white cursor-pointer"><XIcon size={16} /></button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t, i) => {
            const look = TEMPLATE_LOOK[t.id]
            const on = template === t.id
            return (
              <button key={t.id} onClick={() => setTemplate(t.id)} aria-pressed={on} style={{ animationDelay: `${i * 40}ms` }}
                className={`group relative flex flex-col items-start rounded-2xl border-2 p-3 text-left transition-[transform,border-color,background] duration-200 cursor-pointer animate-dg-rise hover:-translate-y-0.5 active:scale-[0.97] ${on ? 'border-brand bg-brand-light/50' : 'border-line hover:bg-snow'}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110 ${look.bg} ${look.fg}`}><look.icon size={22} weight="bold" /></span>
                <span className="mt-2 block text-sm font-black text-ink">{t.title}</span>
                <span className="block text-xs font-semibold leading-snug text-muted">{t.text}</span>
                {on && <CheckCircleIcon size={20} weight="fill" className="absolute right-2 top-2 text-brand animate-pop-in" />}
              </button>
            )
          })}
          <button onClick={() => file.current?.click()} style={{ animationDelay: `${TEMPLATES.length * 40}ms` }}
            className="group flex flex-col items-start rounded-2xl border-2 border-dashed border-line p-3 text-left transition-[transform,background] duration-200 cursor-pointer animate-dg-rise hover:-translate-y-0.5 hover:bg-snow active:scale-[0.97]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-snow text-muted transition-transform duration-300 group-hover:-translate-y-0.5"><UploadSimpleIcon size={22} weight="bold" /></span>
            <span className="mt-2 block text-sm font-black text-ink">Importar</span>
            <span className="block text-xs font-semibold leading-snug text-muted">Um ficheiro .drawio</span>
          </button>
        </div>
      )}
      <input ref={file} type="file" accept=".drawio,.xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />

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

export default function DiagramsPage() {
  const org = useOrg()
  const [diagrams, setDiagrams] = useState<DiagramSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setDiagrams((await api<{ diagrams: DiagramSummary[] }>('/api/diagramas')).diagrams)
    } catch (err) {
      setError(errorText(err))
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
  }, [load])

  const all = diagrams ?? []
  const orgDiagrams = org ? all.filter(d => d.orgId === org.org.id) : []
  const mine = all.filter(d => !d.orgId && d.mine)
  const shared = all.filter(d => !d.mine && (!d.orgId || d.orgId !== org?.org.id))

  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Diagramas</h1>
          <p className="text-sm font-bold text-muted">Fluxogramas, organogramas, processos e esquemas, desenhados em equipa</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary shrink-0 px-4 py-2.5"><PlusIcon size={18} /> <span className="max-sm:hidden">Novo diagrama</span></button>
      </header>

      {error && !diagrams && <p className="rounded-2xl bg-danger-light p-4 font-bold text-danger-dark">{error}</p>}
      {!diagrams && !error && <CardGridSkeleton count={6} height={190} />}

      {diagrams && all.length === 0 && (
        <div className="mb-8 flex flex-col items-center rounded-3xl bg-snow px-6 py-10 text-center">
          <Mascot size={96} />
          <h2 className="mt-3 text-xl font-black text-ink">Ainda não tens diagramas</h2>
          <p className="mt-1 max-w-sm font-semibold text-muted">Desenha um fluxo de trabalho, um organograma ou um processo, ou importa um ficheiro do draw.io, e partilha-o com quem precisa.</p>
          <button onClick={() => setCreating(true)} className="btn btn-primary mt-5"><PlusIcon size={18} /> Novo diagrama</button>
        </div>
      )}
      {org && <Section title={`Diagramas de ${org.org.name}`} hint="Os colegas vêem-nos aqui, salvo os privados." diagrams={orgDiagrams} />}
      <Section title="Os meus diagramas" hint={org ? 'Diagramas pessoais, fora da empresa.' : undefined} diagrams={mine} />
      <Section title="Partilhados comigo" diagrams={shared} />

      {creating && <CreateDialog orgId={org?.org.id} orgName={org?.org.name} onClose={() => setCreating(false)} />}
    </div>
  )
}
