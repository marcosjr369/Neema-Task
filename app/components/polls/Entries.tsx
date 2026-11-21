'use client'

import { useState } from 'react'
import { ArrowFatUpIcon, DotsThreeIcon, EyeSlashIcon, FileIcon, GavelIcon, HeartIcon, LightbulbIcon, MedalIcon, TrashIcon } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import Popover, { MenuDivider, MenuItem, MenuTitle } from '../boards/Popover'
import { Busy } from '../ui/Spinner'
import { IDEA_STATUS, POLL_LIMITS } from '../../lib/polls'
import type { IdeaStatus, PollEntry, PollFile, PollView } from '../../types'
import Respond, { type Submit } from './Respond'
import { ago, fileUrl } from './look'

export type EntryMe = { entryBlock: string | null; isJury: boolean; entries: number; votesUsed: number }

type Props = {
  poll: PollView
  entries: PollEntry[]
  me: EntryMe
  manager: boolean
  onAdd: (text: string, details: string | undefined, s?: Submit) => Promise<void>
  onVote: (entryId: string, vote: number | null) => Promise<void>
  onManage: (entryId: string, patch: { status?: IdeaStatus; hidden?: boolean }) => Promise<void>
  onDelete: (entryId: string) => Promise<void>
}

const isFile = (v: unknown): v is PollFile => !!v && typeof v === 'object' && !Array.isArray(v) && 'id' in v && 'size' in v

function IdeaForm({ onAdd }: { onAdd: Props['onAdd'] }) {
  const [text, setText] = useState('')
  const [details, setDetails] = useState('')
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      await onAdd(text, details || undefined)
      setText(''); setDetails(''); setMore(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar.') }
    setBusy(false)
  }
  return (
    <form onSubmit={submit} className="rounded-3xl border-2 border-warm/40 bg-warm-light/40 p-3 sm:p-4">
      <div className="flex gap-2">
        <LightbulbIcon size={26} weight="duotone" className="mt-2 shrink-0 text-warm-dark" />
        <input className="input bg-white" maxLength={POLL_LIMITS.entryText} value={text} onChange={e => setText(e.target.value)} placeholder="A tua ideia, numa frase" aria-label="A tua ideia" />
        <button className="btn btn-warm shrink-0 px-4 py-2 text-sm" disabled={busy || !text.trim()}><Busy busy={busy}>Propor</Busy></button>
      </div>
      {more ? (
        <textarea className="input mt-2 min-h-20 bg-white animate-dg-rise" maxLength={POLL_LIMITS.entryDetails} value={details} onChange={e => setDetails(e.target.value)} placeholder="Explica melhor (opcional)" aria-label="Detalhes" />
      ) : (
        <button type="button" className="ml-9 mt-1 text-xs font-extrabold text-warm-dark hover:underline cursor-pointer" onClick={() => setMore(true)}>+ Juntar detalhes</button>
      )}
      {error && <p className="ml-9 mt-1 text-sm font-bold text-danger" role="alert">{error}</p>}
    </form>
  )
}

function EntryMenu({ entry, poll, manager, onManage, onDelete }: { entry: PollEntry; poll: PollView; manager: boolean; onManage: Props['onManage']; onDelete: Props['onDelete'] }) {
  const [menu, setMenu] = useState<DOMRect | null>(null)
  if (!manager && !entry.mine) return null
  return (
    <>
      <button onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} aria-label="Opções" className="rounded-lg p-1 text-muted hover:bg-snow cursor-pointer"><DotsThreeIcon size={20} weight="bold" /></button>
      {menu && (
        <Popover anchor={menu} title="Opções" onClose={() => setMenu(null)} width={240}>
          {manager && poll.type === 'ideas' && (
            <>
              <MenuTitle>Estado</MenuTitle>
              {(Object.keys(IDEA_STATUS) as IdeaStatus[]).map(s => (
                <MenuItem key={s} icon={<span className="h-3 w-3 rounded-full" style={{ background: IDEA_STATUS[s].color }} />} onClick={() => { setMenu(null); onManage(entry.id, { status: s }) }}>
                  {IDEA_STATUS[s].name}{(entry.status ?? 'new') === s ? ' ✓' : ''}
                </MenuItem>
              ))}
              <MenuDivider />
            </>
          )}
          {manager && <MenuItem icon={<EyeSlashIcon size={18} />} onClick={() => { setMenu(null); onManage(entry.id, { hidden: !entry.hidden }) }}>{entry.hidden ? 'Mostrar a todos' : 'Esconder'}</MenuItem>}
          <MenuItem danger icon={<TrashIcon size={18} />} onClick={() => { setMenu(null); if (confirm(`Apagar "${entry.text}"?`)) onDelete(entry.id) }}>Apagar</MenuItem>
        </Popover>
      )}
    </>
  )
}

function Author({ entry }: { entry: PollEntry }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
      {entry.author && <Avatar name={entry.author} picture={entry.authorPicture} size={18} />}
      <span className="truncate">{entry.author ?? (entry.mine ? 'Tu' : 'Anónimo')} · {ago(entry.createdAt)}</span>
    </span>
  )
}

export default function Entries({ poll, entries, me, manager, onAdd, onVote, onManage, onDelete }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [sending, setSending] = useState(false)
  const contest = poll.type === 'contest'
  const jury = contest && !!poll.settings.jury?.length
  const voting = !contest || poll.settings.phase === 'vote'
  const open = !me.entryBlock
  const limit = jury ? 0 : poll.settings.votesPerPerson ?? 0
  const canVote = open && voting && (!jury || me.isJury)

  const vote = async (e: PollEntry, v: number | null) => {
    setBusy(e.id)
    await onVote(e.id, v).catch(() => undefined)
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      {open && !contest && <IdeaForm onAdd={onAdd} />}

      {open && contest && poll.settings.phase !== 'vote' && (
        sending ? (
          <div className="rounded-3xl border-2 border-pink/40 bg-[#FCE6F2]/40 p-3 sm:p-4 animate-dg-rise">
            <Respond poll={poll} submitLabel="Enviar candidatura"
              header={(
                <div className="rounded-3xl border-2 border-line bg-white p-4 sm:p-5">
                  <label htmlFor="entry-title" className="block text-lg font-black text-ink">Título da candidatura <span className="text-danger">*</span></label>
                  <input id="entry-title" className="input mt-3" maxLength={POLL_LIMITS.entryText} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Pôr do sol na varanda" />
                </div>
              )}
              onSubmit={async s => {
                if (!title.trim()) throw new Error('Dá um título à tua candidatura')
                await onAdd(title, undefined, s)
                setTitle('')
                setSending(false)
              }} />
            <button className="mt-2 w-full rounded-xl py-2 text-sm font-extrabold text-muted hover:bg-white cursor-pointer" onClick={() => setSending(false)}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setSending(true)} className="flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-pink/50 p-4 text-left transition-colors hover:bg-[#FCE6F2]/40 cursor-pointer">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FCE6F2] text-pink-dark"><MedalIcon size={24} weight="duotone" /></span>
            <span>
              <span className="block font-black text-ink">{me.entries ? 'Enviar outra candidatura' : 'Enviar a minha candidatura'}</span>
              <span className="block text-sm font-semibold text-muted">Quando as candidaturas fecharem, todos votam{jury ? ' (só o júri dá notas)' : ''}.</span>
            </span>
          </button>
        )
      )}

      {voting && open && (
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
          {jury
            ? me.isJury ? <><GavelIcon size={16} className="text-pink-dark" /> És do júri: dá uma nota de 1 a 10 a cada candidatura.</> : <><GavelIcon size={16} /> Só o júri vota neste concurso.</>
            : limit ? `Tens ${limit} ${limit === 1 ? 'voto' : 'votos'} · usaste ${me.votesUsed}` : 'Vota em todas as que gostares.'}
        </p>
      )}
      {contest && poll.settings.phase !== 'vote' && !manager && open && (
        <p className="text-sm font-bold text-muted">Enquanto as candidaturas estiverem abertas, só vês as tuas.</p>
      )}

      {entries.length === 0 ? (
        <p className="rounded-3xl bg-snow p-6 text-center font-bold text-muted">{contest ? 'Ainda não há candidaturas.' : 'Ainda não há ideias. Sê o primeiro!'}</p>
      ) : contest ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map((e, i) => {
            const files = Object.values(e.answers).filter(isFile)
            const image = files.find(f => f.type.startsWith('image/'))
            const texts = poll.fields.filter(f => f.kind === 'long' || f.kind === 'short').map(f => e.answers[f.id]).filter((v): v is string => typeof v === 'string')
            return (
              <li key={e.id} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                className={`overflow-hidden rounded-3xl border-2 bg-white animate-dg-rise ${i === 0 && e.score ? 'border-gold' : 'border-line'} ${e.hidden ? 'opacity-50' : ''}`}>
                {image ? (
                  <a href={fileUrl(poll.id, image.id, true)} target="_blank" rel="noreferrer" className="block bg-snow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(poll.id, image.id, true)} alt={e.text} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  </a>
                ) : files[0] ? (
                  <a href={fileUrl(poll.id, files[0].id)} className="flex aspect-[4/3] flex-col items-center justify-center gap-1 bg-snow text-sm font-bold text-body hover:text-brand">
                    <FileIcon size={36} /> <span className="max-w-[80%] truncate">{files[0].name}</span>
                  </a>
                ) : null}
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-ink">{i === 0 && e.score ? '🏆 ' : ''}{e.text}</span>
                      <Author entry={e} />
                    </span>
                    <EntryMenu entry={e} poll={poll} manager={manager} onManage={onManage} onDelete={onDelete} />
                  </div>
                  {texts.map((t, k) => <p key={k} className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm font-semibold text-body">{t}</p>)}
                  <div className="mt-3 flex items-center gap-2">
                    {e.score !== undefined && <span className="text-sm font-black text-ink">{jury ? `Nota ${e.score.toLocaleString('pt-PT')} · ${e.votes} do júri` : `${e.votes} ${e.votes === 1 ? 'voto' : 'votos'}`}</span>}
                    {canVote && !e.mine && (jury ? (
                      <select className="input ml-auto w-auto py-1.5 text-sm" value={e.myVote ?? ''} disabled={busy === e.id} aria-label={`Nota para ${e.text}`}
                        onChange={ev => vote(e, ev.target.value ? Number(ev.target.value) : null)}>
                        <option value="">Dar nota…</option>
                        {Array.from({ length: 10 }, (_, k) => k + 1).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : (
                      <button disabled={busy === e.id} onClick={() => vote(e, e.myVote ? null : 1)} aria-pressed={!!e.myVote}
                        className={`ml-auto inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-extrabold transition-[transform,background] active:scale-95 cursor-pointer ${e.myVote ? 'border-pink bg-pink text-white' : 'border-line text-body hover:bg-snow'}`}>
                        <HeartIcon size={16} weight={e.myVote ? 'fill' : 'bold'} className={e.myVote ? 'tut-pop' : ''} /> {e.myVote ? 'Votado' : 'Votar'}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => {
            const st = IDEA_STATUS[e.status ?? 'new']
            return (
              <li key={e.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className={`flex gap-3 rounded-2xl border-2 border-line bg-white p-3 animate-dg-rise ${e.hidden ? 'opacity-50' : ''}`}>
                <button disabled={!canVote || busy === e.id} onClick={() => vote(e, e.myVote ? null : 1)} aria-pressed={!!e.myVote} aria-label={e.myVote ? 'Tirar o voto' : 'Votar nesta ideia'}
                  className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border-2 py-1 transition-[transform,background] active:scale-95 cursor-pointer disabled:cursor-default ${e.myVote ? 'border-warm bg-warm text-white' : 'border-line text-body enabled:hover:bg-snow'}`}>
                  <ArrowFatUpIcon size={18} weight={e.myVote ? 'fill' : 'bold'} className={e.myVote ? 'tut-pop' : ''} />
                  <span className="text-sm font-black tabular-nums">{e.score ?? '·'}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 font-black text-ink">{e.text}</p>
                    {(e.status ?? 'new') !== 'new' && <span className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-black text-white" style={{ background: st.color }}>{st.name}</span>}
                    {e.hidden && <span className="shrink-0 rounded-lg bg-snow px-2 py-0.5 text-[11px] font-black text-muted">Escondida</span>}
                    <EntryMenu entry={e} poll={poll} manager={manager} onManage={onManage} onDelete={onDelete} />
                  </div>
                  {e.details && <p className="mt-0.5 whitespace-pre-wrap text-sm font-semibold text-body">{e.details}</p>}
                  <div className="mt-1"><Author entry={e} /></div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
