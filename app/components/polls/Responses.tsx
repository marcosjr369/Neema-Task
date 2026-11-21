'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretDownIcon, DownloadSimpleIcon, TableIcon, TrashIcon, UserCircleIcon } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import { ListSkeleton } from '../ui/Skeleton'
import { Busy } from '../ui/Spinner'
import { api, errorText } from '../../lib/api'
import { download } from '../../lib/sheets/files'
import { answerText, responseTable, toCsv } from '../../lib/polls'
import { useApp } from '../../context/AppContext'
import type { AnswerValue, PollFile, PollView } from '../../types'
import { ago, fileUrl } from './look'

type Row = {
  id: string; name?: string; picture?: string; guest: boolean
  answers: Record<string, AnswerValue>; other?: Record<string, string>; createdAt: number; updatedAt: number
}

const isFile = (v: unknown): v is PollFile => !!v && typeof v === 'object' && !Array.isArray(v) && 'id' in v && 'size' in v

/** Exportar para CSV ou Planilha (também usado nas ideias e concursos, só com a planilha) */
export function ExportButtons({ poll, rows }: { poll: PollView; rows?: Row[] }) {
  const router = useRouter()
  const { showToast } = useApp()
  const [busy, setBusy] = useState(false)
  const toSheet = async () => {
    setBusy(true)
    try {
      const { id } = await api<{ id: string }>(`/api/inqueritos/${poll.id}/exportar`, { method: 'POST' })
      showToast('Planilha criada com as respostas', 'success')
      router.push(`/planilhas/${id}`)
    } catch (err) {
      showToast(errorText(err, 'Não foi possível criar a planilha.'), 'danger')
      setBusy(false)
    }
  }
  const csv = () => {
    if (!rows) return
    const table = responseTable(poll, [...rows].reverse(), !poll.settings.anonymous)
    download(`${poll.title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'respostas'}.csv`, toCsv(table), 'text/csv;charset=utf-8')
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-ghost px-3 py-2 text-xs" onClick={toSheet} disabled={busy}><Busy busy={busy} text="A criar…"><TableIcon size={16} /> Abrir em Planilha</Busy></button>
      {rows && <button className="btn btn-ghost px-3 py-2 text-xs" onClick={csv} disabled={!rows.length}><DownloadSimpleIcon size={16} /> CSV (Excel)</button>}
    </div>
  )
}

export default function Responses({ poll, onChanged }: { poll: PollView; onChanged: () => void }) {
  const { showToast } = useApp()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRows((await api<{ responses: Row[] }>(`/api/inqueritos/${poll.id}/respostas`)).responses)
    } catch (err) {
      showToast(errorText(err, 'Não foi possível carregar as respostas.'), 'danger')
    }
  }, [poll.id, showToast])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
  }, [load, poll.count])

  const remove = async (r: Row) => {
    if (!confirm('Apagar esta resposta? Não dá para desfazer.')) return
    try {
      await api(`/api/inqueritos/${poll.id}/respostas?responseId=${r.id}`, { method: 'DELETE' })
      setRows(list => list?.filter(x => x.id !== r.id) ?? null)
      onChanged()
    } catch (err) { showToast(errorText(err, 'Não foi possível apagar a resposta.'), 'danger') }
  }

  if (!rows) return <ListSkeleton rows={4} />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-extrabold text-muted">{rows.length === 1 ? '1 resposta' : `${rows.length} respostas`}{poll.settings.anonymous ? ' · anónimas' : ''}</p>
        <ExportButtons poll={poll} rows={rows} />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-3xl bg-snow p-6 text-center font-bold text-muted">Ainda ninguém respondeu. Partilha o link ou avisa a equipa.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => {
            const expanded = open === r.id
            const who = poll.settings.anonymous ? 'Anónimo' : r.name ?? (r.guest ? 'Visitante sem nome' : 'Sem nome')
            return (
              <li key={r.id} className="overflow-hidden rounded-2xl border-2 border-line bg-white animate-dg-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-snow cursor-pointer" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                  {poll.settings.anonymous || !r.name ? <UserCircleIcon size={32} className="text-muted" /> : <Avatar name={r.name} picture={r.picture} size={32} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-ink">{who}{r.guest && !poll.settings.anonymous ? <span className="ml-1.5 rounded-md bg-snow px-1.5 py-0.5 text-[11px] font-black text-muted">sem conta</span> : null}</span>
                    <span className="block text-xs font-bold text-muted">{ago(r.createdAt)}{r.updatedAt - r.createdAt > 60_000 ? ' · alterada' : ''}</span>
                  </span>
                  <CaretDownIcon size={18} className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="border-t-2 border-line p-3 animate-dg-rise">
                    <dl className="space-y-2.5">
                      {poll.fields.filter(f => r.answers[f.id] !== undefined).map(f => {
                        const v = r.answers[f.id]
                        return (
                          <div key={f.id}>
                            <dt className="text-xs font-extrabold text-muted">{f.title || 'Pergunta'}</dt>
                            <dd className="whitespace-pre-wrap break-words text-sm font-bold text-ink">
                              {isFile(v)
                                ? <a className="text-brand underline" href={fileUrl(poll.id, v.id)}>{v.name}</a>
                                : answerText(f, v, r.other?.[f.id])}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                    <button className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-danger hover:bg-danger-light cursor-pointer" onClick={() => remove(r)}>
                      <TrashIcon size={14} /> Apagar resposta
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
