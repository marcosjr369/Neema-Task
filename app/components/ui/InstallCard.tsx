'use client'

import Image from 'next/image'
import { useState } from 'react'
import { DownloadSimpleIcon, ExportIcon, PlusSquareIcon } from '@phosphor-icons/react'
import { useInstallPrompt } from '../../lib/pwa'

/** Convite para instalar a app (some quando já está instalada) */
export default function InstallCard({ compact = false }: { compact?: boolean }) {
  const { status, install } = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)

  if (status === 'installed' || status === 'unavailable') return null

  if (compact) {
    return status === 'available' ? (
      <button onClick={install} className="btn btn-ghost w-full text-brand">
        <DownloadSimpleIcon size={18} /> Instalar app
      </button>
    ) : null
  }

  return (
    <div className="card border-b-4 p-4">
      <div className="flex items-center gap-3">
        <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="rounded-xl" />
        <div className="flex-1">
          <p className="font-black text-ink">Instalar Udacha</p>
          <p className="text-xs font-semibold text-muted">Abre como app, em ecrã inteiro, e funciona offline.</p>
        </div>
      </div>
      {status === 'available' ? (
        <button onClick={install} className="btn btn-primary mt-4 w-full">
          <DownloadSimpleIcon size={18} /> Instalar
        </button>
      ) : (
        <>
          <button onClick={() => setShowIosHelp(v => !v)} className="btn btn-ghost mt-4 w-full text-brand">
            Como instalar no iPhone
          </button>
          {showIosHelp && (
            <ol className="mt-3 space-y-2 text-sm font-semibold text-body">
              <li className="flex items-center gap-2">
                1. Toca em <ExportIcon size={16} className="text-accent" /> <b>Partilhar</b> no Safari
              </li>
              <li className="flex items-center gap-2">
                2. Escolhe <PlusSquareIcon size={16} className="text-accent" /> <b>Adicionar ao ecrã principal</b>
              </li>
              <li>3. Confirma em <b>Adicionar</b></li>
            </ol>
          )}
        </>
      )}
    </div>
  )
}
