import { LockSimpleIcon, PencilSimpleLineIcon } from '@phosphor-icons/react'
import type { PollSummary } from '../../types'

const LOOK = {
  draft: { text: 'Rascunho', cls: 'border-line bg-white text-muted' },
  open: { text: 'Aberto', cls: 'border-accent/30 bg-accent-light text-accent-dark' },
  closed: { text: 'Fechado', cls: 'border-line bg-snow text-body' },
}

/** Selo do estado: "Aberto" (com ponto a pulsar), "Rascunho" ou "Fechado" */
export default function StatusPill({ status }: { status: PollSummary['status'] }) {
  const look = LOOK[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold leading-none ${look.cls}`}>
      {status === 'open' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
      )}
      {status === 'draft' && <PencilSimpleLineIcon size={12} weight="bold" />}
      {status === 'closed' && <LockSimpleIcon size={12} weight="bold" />}
      {look.text}
    </span>
  )
}
