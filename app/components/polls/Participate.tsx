'use client'

import { useState } from 'react'
import { ArrowCounterClockwiseIcon, CheckCircleIcon, ClockIcon, LockIcon } from '@phosphor-icons/react'
import Mascot from '../ui/Mascot'
import { canEditAccess } from './access'
import Respond, { type Submit } from './Respond'
import Results from './Results'
import Entries, { type EntryMe } from './Entries'
import { closesText } from './look'
import { RichText } from './Theme'
import { guestsNeedLogin } from '../../lib/polls'
import type { IdeaStatus, PollDetail } from '../../types'

export type EntryActions = {
  add: (text: string, details: string | undefined, s?: Submit) => Promise<void>
  vote: (entryId: string, vote: number | null) => Promise<void>
  manage: (entryId: string, patch: { status?: IdeaStatus; hidden?: boolean }) => Promise<void>
  remove: (entryId: string) => Promise<void>
}

/** Descrição, data de fecho e estado, por cima do formulário */
export function PollIntro({ d }: { d: PollDetail }) {
  const { poll } = d
  return (
    <>
      {poll.description && <RichText text={poll.description} className="mt-2 block text-[15px] font-semibold leading-relaxed text-body" />}
      {d.phase === 'open' && poll.settings.closesAt && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-snow px-3 py-1.5 text-sm font-extrabold text-body"><ClockIcon size={16} /> {closesText(poll.settings.closesAt)}</p>
      )}
      {d.phase === 'closed' && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-line px-3 py-1.5 text-sm font-extrabold text-body"><LockIcon size={16} /> Fechado: já não recebe respostas</p>
      )}
    </>
  )
}

/**
 * O que quem participa vê: o formulário, ou depois de responder o agradecimento e os resultados.
 * Nas ideias e nos concursos, o quadro das entradas.
 */
export default function Participate({ d, onSubmit, onWithdraw, entry, guest }: {
  d: PollDetail
  onSubmit: (s: Submit) => Promise<void>
  /** retirar a minha resposta (se puder mudá-la) */
  onWithdraw?: () => Promise<void>
  entry?: EntryActions
  guest?: boolean
}) {
  const { poll, me } = d
  const [changing, setChanging] = useState(false)
  const [justSent, setJustSent] = useState(false)
  const manager = canEditAccess(d.access)

  if (poll.type === 'ideas' || poll.type === 'contest') {
    if (!entry) return <p className="rounded-3xl bg-white p-6 text-center font-bold text-muted">Entra na tua conta para participar.</p>
    const em: EntryMe = { entryBlock: me.entryBlock, isJury: me.isJury, entries: me.entries, votesUsed: me.votesUsed }
    return <Entries poll={poll} entries={d.entries} me={em} manager={manager} onAdd={entry.add} onVote={entry.vote} onManage={entry.manage} onDelete={entry.remove} />
  }

  const canAnswer = !me.block || (changing && !!me.response && d.phase === 'open')
  if (canAnswer && !justSent && (!me.answered || changing)) {
    return (
      <Respond key={changing ? 'change' : 'new'} poll={poll} guest={guest} candidates={d.candidates}
        initial={changing ? me.response : undefined}
        submitLabel={changing ? 'Guardar a minha resposta' : undefined}
        onSubmit={async s => {
          await onSubmit(s)
          setChanging(false)
          setJustSent(true)
        }} />
    )
  }

  return (
    <div className="space-y-4">
      {me.answered || justSent ? (
        <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-7 text-center tut-pop">
          {justSent ? <Mascot size={84} mood="happy" /> : <CheckCircleIcon size={48} weight="duotone" className="text-accent-dark" />}
          <h2 className="mt-2 text-xl font-black text-ink">{justSent ? (poll.type === 'election' ? 'Voto registado!' : 'Resposta enviada!') : 'Já respondeste'}</h2>
          <p className="mt-1 max-w-md whitespace-pre-wrap font-semibold text-body">
            {poll.settings.thanks || (d.results ? 'Obrigado! Vê abaixo como vão os resultados.' : resultsHint(poll.settings.results))}
          </p>
          {me.response && d.phase === 'open' && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => { setChanging(true); setJustSent(false) }}><ArrowCounterClockwiseIcon size={16} /> Mudar a minha resposta</button>
              {onWithdraw && <button className="rounded-xl px-3 py-2 text-sm font-extrabold text-muted hover:bg-white hover:text-danger cursor-pointer" onClick={() => { if (confirm('Retirar a tua resposta?')) onWithdraw() }}>Retirar</button>}
            </div>
          )}
          {guest && !guestsNeedLogin(poll) && d.phase === 'open' && (
            <button className="btn btn-ghost mt-4 px-4 py-2 text-sm" onClick={() => setJustSent(false)}>Enviar outra resposta</button>
          )}
        </div>
      ) : (
        <p className="rounded-3xl bg-white p-5 text-center font-bold text-body">{me.block}</p>
      )}
      {d.results && <Results poll={poll} results={d.results} candidates={d.candidates} manager={manager} />}
    </div>
  )
}

function resultsHint(r: PollDetail['poll']['settings']['results']) {
  if (r === 'closed') return 'Obrigado! Os resultados aparecem quando o inquérito fechar.'
  if (r === 'managers') return 'Obrigado! A tua resposta chegou a quem fez o inquérito.'
  return 'Obrigado pela tua resposta!'
}
