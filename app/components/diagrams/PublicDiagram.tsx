'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { DownloadSimpleIcon, EyeIcon } from '@phosphor-icons/react'
import DrawioFrame, { type DrawioHandle } from './DrawioFrame'
import Mascot from '../ui/Mascot'
import { downloadXml } from '../../lib/diagrams'
import type { DiagramView } from '../../types'

/** Diagrama aberto por link (sem conta ou sem convite): só leitura, mas pode descarregar */
export default function PublicDiagram({ diagram, signedIn }: { diagram: DiagramView; signedIn: boolean }) {
  const viewer = useRef<DrawioHandle>(null)
  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b-2 border-line px-4 py-2.5">
        <Link href="/" className="flex items-center gap-1.5 rounded-xl px-1 py-1" aria-label="Udacha">
          <Mascot size={26} />
          <span className="text-sm font-black text-brand">udacha</span>
        </Link>
        <h1 className="min-w-0 truncate px-2 text-xl font-black text-ink">{diagram.title}</h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body"><EyeIcon size={14} /> Só ver</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => downloadXml(diagram.title, diagram.xml)} className="chip text-xs"><DownloadSimpleIcon size={16} /> Descarregar</button>
          {!signedIn && <Link href="/entrar" className="btn btn-primary px-3 py-2 text-xs">Criar os teus diagramas</Link>}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <DrawioFrame ref={viewer} xml={diagram.xml} readOnly />
      </div>
    </div>
  )
}
