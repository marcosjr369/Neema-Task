'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import {
  CaretLeftIcon, CloudCheckIcon, CloudSlashIcon, DotsThreeIcon, DownloadSimpleIcon, EyeIcon, GlobeIcon, LockIcon,
  ShareNetworkIcon, SignOutIcon, TrashIcon, UsersThreeIcon, WarningIcon,
} from '@phosphor-icons/react'
import DrawioFrame, { type DrawioHandle, type ExportFormat } from '../../components/diagrams/DrawioFrame'
import { useDiagram } from '../../components/diagrams/useDiagram'
import ShareDialog from '../../components/boards/ShareDialog'
import Popover, { MenuDivider, MenuItem, MenuTitle } from '../../components/boards/Popover'
import Avatar from '../../components/ui/Avatar'
import Mascot from '../../components/ui/Mascot'
import { api, errorText } from '../../lib/api'
import { downloadDataUri, downloadXml, safeName } from '../../lib/diagrams'
import { useApp } from '../../context/AppContext'
import type { DiagramView } from '../../types'
import { SheetSkeleton } from '../../components/ui/Skeleton'

function Visibility({ diagram, orgName }: { diagram: DiagramView; orgName?: string }) {
  const v = diagram.sharing.visibility
  const Icon = v === 'org' ? UsersThreeIcon : v === 'link' ? GlobeIcon : LockIcon
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body">
      <Icon size={14} /> {v === 'org' ? orgName ?? 'Empresa' : v === 'link' ? 'Público com link' : 'Privado'}
    </span>
  )
}

export default function DiagramPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useApp()
  const editor = useRef<DrawioHandle>(null)
  const { data, error, state, conflict, remote, load, changed, saveNow, resolve, rename } = useDiagram(id, editor)
  const [share, setShare] = useState(() => typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('partilha'))
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [title, setTitle] = useState<string | null>(null)

  if (error && !data) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={100} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">{error.status === 403 ? 'Sem acesso' : error.status === 404 ? 'Diagrama não encontrado' : 'Algo correu mal'}</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">{error.text}</p>
        <Link href="/diagramas" className="btn btn-primary mt-6">Ver os meus diagramas</Link>
      </div>
    )
  }
  if (!data) return <div className="h-[calc(100dvh-84px)] lg:h-dvh"><SheetSkeleton /></div>

  const { diagram, access, people, orgName, requests } = data
  const readOnly = access === 'view'

  const exportImage = async (format: ExportFormat) => {
    try {
      const out = await editor.current!.exportAs(format)
      await downloadDataUri(`${safeName(diagram.title)}.${format === 'svg' ? 'svg' : 'png'}`, out.data)
    } catch (err) {
      showToast(errorText(err, 'Não foi possível exportar o diagrama.'), 'danger')
    }
  }
  const exportFile = async () => {
    // o XML do editor (com o que ainda não foi gravado); se não responder, o último gravado
    const out = await editor.current?.exportAs('svg').catch(() => null)
    downloadXml(diagram.title, out?.xml || diagram.xml)
  }

  const leave = async () => {
    if (!confirm('Sair deste diagrama? Deixas de o ver até alguém te convidar outra vez.')) return
    try {
      await api(`/api/diagramas/${id}/share`, { method: 'DELETE' })
      router.replace('/diagramas')
    } catch (err) { showToast(errorText(err, 'Não foi possível sair do diagrama. Tenta outra vez.'), 'danger') }
  }
  const remove = async () => {
    if (!confirm(`Apagar o diagrama "${diagram.title}"? Não dá para desfazer.`)) return
    try {
      await api(`/api/diagramas/${id}`, { method: 'DELETE' })
      showToast('Diagrama apagado', 'success')
      router.replace('/diagramas')
    } catch (err) { showToast(errorText(err, 'Não foi possível apagar o diagrama. Tenta outra vez.'), 'danger') }
  }

  const status = {
    saved: <span key="saved" className="inline-flex items-center gap-1 text-accent-dark animate-fade-in"><CloudCheckIcon size={16} weight="bold" /> Guardado</span>,
    pending: <span key="pending" className="inline-flex items-center gap-1.5 animate-fade-in"><span className="h-2 w-2 rounded-full bg-gold" /> Por guardar…</span>,
    saving: <span key="saving" className="inline-flex items-center gap-1.5 text-brand animate-fade-in"><span className="dg-pulse h-2 w-2 rounded-full bg-brand" /> A guardar…</span>,
    error: <span key="error" className="inline-flex items-center gap-1 text-danger animate-fade-in"><CloudSlashIcon size={16} /> Não guardado</span>,
  }[state]

  return (
    <div className="flex h-[calc(100dvh-84px)] flex-col bg-white lg:h-dvh">
      <header className="flex flex-wrap items-center gap-2 border-b-2 border-line px-3 py-2 lg:px-5">
        <Link href="/diagramas" aria-label="Voltar aos diagramas" className="rounded-xl p-2 text-muted hover:bg-snow"><CaretLeftIcon size={20} /></Link>
        {title !== null && !readOnly ? (
          <input className="input w-auto min-w-0 py-1.5 text-lg font-black" value={title} autoFocus maxLength={80} aria-label="Nome do diagrama"
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title.trim() !== diagram.title) rename(title); setTitle(null) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTitle(null) }} />
        ) : (
          <h1 className={`min-w-0 truncate rounded-xl px-2 py-1 text-xl font-black text-ink ${readOnly ? '' : 'cursor-text hover:bg-snow'}`} onClick={() => { if (!readOnly) setTitle(diagram.title) }}>
            {diagram.title}
          </h1>
        )}
        <Visibility diagram={diagram} orgName={orgName} />
        {readOnly && <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body"><EyeIcon size={14} /> Só ver</span>}
        {!readOnly && <span className="inline-flex items-center gap-1 text-xs font-bold text-muted" aria-live="polite">{status}</span>}
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
          <button onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} aria-label="Menu do diagrama" className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer"><DotsThreeIcon size={22} weight="bold" /></button>
        </div>
      </header>

      {conflict && (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-line bg-danger-light px-4 py-2 text-sm font-bold text-danger-dark animate-dg-rise" role="alert">
          <WarningIcon size={18} /> <span className="min-w-0 flex-1">{conflict}. As tuas últimas alterações ainda não foram gravadas.</span>
          <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => resolve('theirs')}>Abrir a versão gravada</button>
          <button className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => { if (confirm('Gravar a tua versão por cima? As alterações da outra pessoa perdem-se.')) resolve('mine') }}>Manter a minha</button>
        </div>
      )}
      {remote && !conflict && (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-line bg-accent-light px-4 py-2 text-sm font-bold text-accent-dark animate-dg-rise" role="status">
          <span className="min-w-0 flex-1">{remote.name ?? 'Alguém'} gravou uma versão nova deste diagrama.</span>
          <button className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => resolve('theirs')}>Ver a versão nova</button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <DrawioFrame ref={editor} xml={diagram.xml} readOnly={readOnly} onChange={changed} onSaveRequest={saveNow} />
      </div>

      {menu && (
        <Popover anchor={menu} title="Menu" onClose={() => setMenu(null)} width={280}>
          {access === 'owner' && <MenuItem icon={<ShareNetworkIcon size={18} />} onClick={() => { setMenu(null); setShare(true) }}>Partilhar</MenuItem>}
          <MenuTitle>Descarregar</MenuTitle>
          <MenuItem icon={<DownloadSimpleIcon size={18} />} onClick={() => { setMenu(null); exportFile() }}>Ficheiro draw.io (.drawio)</MenuItem>
          <MenuItem icon={<DownloadSimpleIcon size={18} />} onClick={() => { setMenu(null); exportImage('png') }}>Imagem (.png)</MenuItem>
          <MenuItem icon={<DownloadSimpleIcon size={18} />} onClick={() => { setMenu(null); exportImage('svg') }}>Imagem vectorial (.svg)</MenuItem>
          {access !== 'owner' && diagram.sharing.visibility !== 'org' && (<><MenuDivider /><MenuItem icon={<SignOutIcon size={18} />} onClick={() => { setMenu(null); leave() }}>Sair do diagrama</MenuItem></>)}
          {access === 'owner' && (<><MenuDivider /><MenuItem danger icon={<TrashIcon size={18} />} onClick={() => { setMenu(null); remove() }}>Apagar diagrama</MenuItem></>)}
        </Popover>
      )}

      {share && <ShareDialog endpoint={`/api/diagramas/${id}/share`} noun="diagrama" isOrg={!!diagram.orgId} orgName={orgName} onClose={() => setShare(false)} onChanged={load} />}
    </div>
  )
}
