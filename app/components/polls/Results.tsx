'use client'

import { useState } from 'react'
import { BellRingingIcon, CrownSimpleIcon, DownloadSimpleIcon, ProhibitIcon, TrophyIcon } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import { Busy } from '../ui/Spinner'
import { slotLabel } from '../../lib/polls'
import type { FieldResult, PollField, PollResults, PollView } from '../../types'
import { BAR_COLORS, fileUrl } from './look'

type Turnout = { total: number; answered: number; missing: { userId: string; name: string; picture?: string }[] }

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

function Bar({ label, count, of, color, win, icon, picture, delay = 0 }: {
  label: React.ReactNode; count: number; of: number; color: string; win?: boolean; icon?: React.ReactNode; picture?: string | null; delay?: number
}) {
  const p = pct(count, of)
  return (
    <li className="animate-dg-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-1 flex items-center gap-2 text-sm">
        {picture !== undefined && <Avatar name={typeof label === 'string' ? label : '?'} picture={picture ?? undefined} size={24} />}
        {icon}
        <span className={`min-w-0 flex-1 truncate font-extrabold ${win ? 'text-ink' : 'text-body'}`}>{label}</span>
        {win && <span className="inline-flex items-center gap-1 rounded-lg bg-gold/20 px-1.5 py-0.5 text-[11px] font-black text-gold-dark"><CrownSimpleIcon size={12} weight="fill" /> À frente</span>}
        <span className="shrink-0 font-black tabular-nums text-ink">{p}%</span>
        <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-muted">{count}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-snow">
        <div className="h-full origin-left rounded-full animate-[tut-fill_.7s_cubic-bezier(.2,.8,.2,1)_both]" style={{ width: `${p}%`, background: color, animationDelay: `${delay + 120}ms` }} />
      </div>
    </li>
  )
}

function Texts({ texts, label = 'respostas' }: { texts: string[]; label?: string }) {
  const [all, setAll] = useState(false)
  const shown = all ? texts : texts.slice(0, 5)
  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((t, i) => <li key={i} className="whitespace-pre-wrap break-words rounded-xl bg-snow px-3 py-2 text-sm font-semibold text-body">{t}</li>)}
      </ul>
      {texts.length > 5 && (
        <button className="mt-2 text-sm font-extrabold text-brand hover:underline cursor-pointer" onClick={() => setAll(v => !v)}>
          {all ? 'Mostrar menos' : `Ver as ${texts.length} ${label}`}
        </button>
      )}
    </div>
  )
}

function FieldBlock({ poll, field, res, candidates, manager }: { poll: PollView; field: PollField; res: FieldResult; candidates?: Record<string, string>; manager: boolean }) {
  const election = poll.type === 'election'
  if (!res.answered) return <p className="text-sm font-semibold text-muted">Ainda sem respostas.</p>

  if (res.counts && (field.kind === 'single' || field.kind === 'multi' || field.kind === 'dropdown')) {
    const rows = [
      ...(field.options ?? []).map((o, i) => ({ key: o.id, label: o.label, color: BAR_COLORS[i % BAR_COLORS.length], picture: election ? candidates?.[o.id] ?? null : undefined })),
      ...(field.other ? [{ key: 'other', label: 'Outra', color: '#A3A0B8', picture: undefined }] : []),
      ...(field.blank ? [{ key: 'blank', label: 'Em branco', color: '#D7D3E6', picture: undefined }] : []),
    ]
    // na votação e na eleição, a mais votada primeiro; no formulário, pela ordem das opções
    if (poll.type !== 'form') rows.sort((a, z) => (res.counts![z.key] ?? 0) - (res.counts![a.key] ?? 0) || (a.key === 'blank' ? 1 : 0))
    const tie = (res.winner?.length ?? 0) > 1
    return (
      <>
        {election && res.winner?.length ? (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gold/15 p-3 tut-pop">
            <TrophyIcon size={28} weight="duotone" className="text-gold-dark" />
            <span className="min-w-0">
              <span className="block text-xs font-extrabold uppercase tracking-wide text-gold-dark">{tie ? 'Empate' : poll.status === 'closed' ? 'Eleito' : 'Vai à frente'}</span>
              <span className="block font-black text-ink">{res.winner.map(id => field.options?.find(o => o.id === id)?.label).join(' · ')}</span>
            </span>
          </div>
        ) : null}
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <Bar key={r.key} label={r.label} count={res.counts![r.key] ?? 0} of={res.answered} color={r.color} picture={r.picture} delay={i * 50}
              win={!election && !tie && res.winner?.[0] === r.key} icon={r.key === 'blank' ? <ProhibitIcon size={16} className="text-muted" /> : undefined} />
          ))}
        </ul>
        {field.kind === 'multi' && <p className="mt-2 text-xs font-semibold text-muted">Cada pessoa podia escolher várias: as percentagens não somam 100%.</p>}
        {!!res.others?.length && <div className="mt-4"><p className="label">Respostas em &ldquo;Outra&rdquo;</p><Texts texts={res.others} /></div>}
      </>
    )
  }

  if (field.kind === 'yesno' && res.counts) {
    return (
      <ul className="space-y-3">
        <Bar label="Sim" count={res.counts.yes} of={res.answered} color="#12B5A6" win={res.counts.yes > res.counts.no} />
        <Bar label="Não" count={res.counts.no} of={res.answered} color="#F2545B" win={res.counts.no > res.counts.yes} delay={50} />
      </ul>
    )
  }

  if (field.kind === 'scale' && res.counts) {
    const max = field.max ?? 5
    const top = Math.max(1, ...Object.values(res.counts))
    return (
      <div className="flex items-end gap-5">
        <div className="shrink-0 text-center">
          <p className="text-4xl font-black tabular-nums text-brand">{res.avg?.toLocaleString('pt-PT')}</p>
          <p className="text-xs font-extrabold text-muted">média de {max}</p>
        </div>
        <div className="flex h-24 flex-1 items-end gap-1.5">
          {Array.from({ length: max }, (_, i) => String(i + 1)).map((k, i) => (
            <div key={k} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] font-bold tabular-nums text-muted">{res.counts![k] || ''}</span>
              <div className="w-full origin-bottom rounded-t-lg bg-brand animate-[tut-grow_.6s_cubic-bezier(.2,.8,.2,1)_both]"
                style={{ height: `${Math.max(4, (res.counts![k] / top) * 64)}px`, opacity: 0.35 + (i + 1) / max * 0.65, animationDelay: `${i * 40}ms` }} />
              <span className="text-xs font-black text-body">{k}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (field.kind === 'nps' && res.nps) {
    const { score, promoters, passives, detractors } = res.nps
    const color = score >= 30 ? '#12B5A6' : score >= 0 ? '#E0A419' : '#F2545B'
    const parts = [
      { k: 'Promotores (9-10)', n: promoters, c: '#12B5A6' },
      { k: 'Neutros (7-8)', n: passives, c: '#E0A419' },
      { k: 'Detractores (0-6)', n: detractors, c: '#F2545B' },
    ]
    return (
      <div className="flex flex-wrap items-center gap-5">
        <div className="text-center">
          <p className="text-4xl font-black tabular-nums" style={{ color }}>{score > 0 ? `+${score}` : score}</p>
          <p className="text-xs font-extrabold text-muted">NPS (de −100 a +100)</p>
        </div>
        <div className="min-w-48 flex-1">
          <div className="flex h-4 overflow-hidden rounded-full bg-snow">
            {parts.map(p => <span key={p.k} className="h-full transition-[width] duration-700" style={{ width: `${pct(p.n, res.answered)}%`, background: p.c }} />)}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs font-bold text-body">
            {parts.map(p => <li key={p.k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.c }} />{p.k}: {p.n} ({pct(p.n, res.answered)}%)</li>)}
          </ul>
        </div>
      </div>
    )
  }

  if (field.kind === 'ranking' && res.ranks) {
    const rows = [...(field.options ?? [])].sort((a, z) => (res.ranks![a.id] ?? 99) - (res.ranks![z.id] ?? 99))
    const n = rows.length
    return (
      <ol className="space-y-2">
        {rows.map((o, i) => {
          const avg = res.ranks![o.id] ?? n
          return (
            <li key={o.id} className="flex items-center gap-3 animate-dg-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${i === 0 ? 'bg-gold text-ink' : 'bg-snow text-body'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-ink">{o.label}</span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-snow">
                  <span className="block h-full rounded-full" style={{ width: `${((n - avg + 1) / n) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                </span>
              </span>
              <span className="w-24 shrink-0 text-right text-xs font-bold text-muted">posição média {avg.toLocaleString('pt-PT')}</span>
            </li>
          )
        })}
      </ol>
    )
  }

  if (field.kind === 'likert' && res.grid) {
    return (
      <div className="space-y-3">
        {field.rows?.map(r => {
          const counts = res.grid![r.id] ?? {}
          const total = Object.values(counts).reduce((a, n) => a + n, 0)
          return (
            <div key={r.id}>
              <p className="mb-1 text-sm font-extrabold text-ink">{r.label}</p>
              <div className="flex h-5 overflow-hidden rounded-full bg-snow">
                {field.options?.map((o, i) => (
                  <span key={o.id} title={`${o.label}: ${counts[o.id] ?? 0}`} className="h-full transition-[width] duration-700"
                    style={{ width: `${pct(counts[o.id] ?? 0, total)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                ))}
              </div>
            </div>
          )
        })}
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-body">
          {field.options?.map((o, i) => <li key={o.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />{o.label}</li>)}
        </ul>
      </div>
    )
  }

  if (field.kind === 'number') {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Média', res.avg], ['Mínimo', res.min], ['Máximo', res.max]].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl bg-snow p-3">
            <p className="text-xl font-black tabular-nums text-ink">{(v as number | undefined)?.toLocaleString('pt-PT') ?? '—'}</p>
            <p className="text-xs font-extrabold text-muted">{k}</p>
          </div>
        ))}
      </div>
    )
  }

  if (field.kind === 'slots' && res.slots) {
    const best = new Set(res.winner ?? [])
    return (
      <ul className="space-y-2">
        {(field.options ?? []).map((o, i) => {
          const s = res.slots![o.id] ?? { yes: 0, maybe: 0, no: 0 }
          const win = best.has(o.id) && (s.yes > 0 || s.maybe > 0)
          return (
            <li key={o.id} style={{ animationDelay: `${i * 40}ms` }}
              className={`rounded-2xl border-2 p-3 animate-dg-rise ${win ? 'border-accent bg-accent-light/60' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-black capitalize text-ink">{slotLabel(o)}</span>
                {win && <span className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-0.5 text-[11px] font-black text-white"><CrownSimpleIcon size={12} weight="fill" /> Melhor data</span>}
                <span className="text-xs font-extrabold text-accent-dark">{s.yes} sim</span>
                <span className="text-xs font-extrabold text-gold-dark">{s.maybe} talvez</span>
                <span className="text-xs font-extrabold text-danger">{s.no} não</span>
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-snow">
                <span className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct(s.yes, res.answered)}%` }} />
                <span className="h-full bg-gold transition-[width] duration-500" style={{ width: `${pct(s.maybe, res.answered)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  if (field.kind === 'file') {
    if (!manager) return <p className="text-sm font-semibold text-muted">{res.answered} {res.answered === 1 ? 'ficheiro enviado' : 'ficheiros enviados'}.</p>
    return (
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {res.files?.map(f => (
          <li key={f.id}>
            <a href={fileUrl(poll.id, f.id)} className="flex items-center gap-2 rounded-xl border-2 border-line p-2 text-sm font-bold text-body hover:bg-snow">
              {f.type.startsWith('image/')
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={fileUrl(poll.id, f.id, true)} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                : <DownloadSimpleIcon size={20} className="text-muted" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
            </a>
          </li>
        ))}
      </ul>
    )
  }

  return res.texts?.length ? <Texts texts={res.texts} /> : null
}

export function TurnoutCard({ t, onRemind, canRemind }: { t: Turnout; onRemind?: () => Promise<void>; canRemind: boolean }) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const p = pct(t.answered, t.total)
  return (
    <section className="rounded-3xl border-2 border-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="label mb-0">Participação</p>
          <p className="text-2xl font-black text-ink">{t.answered} <span className="text-base text-muted">de {t.total} colegas · {p}%</span></p>
        </div>
        {canRemind && t.missing.length > 0 && onRemind && (
          <button className="btn btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={async () => { setBusy(true); await onRemind().catch(() => undefined); setBusy(false) }}>
            <Busy busy={busy} text="A avisar…"><BellRingingIcon size={16} /> Lembrar quem falta</Busy>
          </button>
        )}
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-snow">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${p}%` }} />
      </div>
      {t.missing.length > 0 && (
        <button className="mt-3 flex items-center gap-2 text-sm font-bold text-muted hover:text-ink cursor-pointer" onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <span className="flex -space-x-2">{t.missing.slice(0, 6).map(m => <span key={m.userId} className="rounded-full ring-2 ring-white"><Avatar name={m.name} picture={m.picture} size={24} /></span>)}</span>
          Faltam {t.missing.length}
        </button>
      )}
      {open && (
        <ul className="mt-2 flex flex-wrap gap-1.5 animate-dg-rise">
          {t.missing.map(m => <li key={m.userId} className="rounded-lg bg-snow px-2 py-1 text-xs font-bold text-body">{m.name}</li>)}
        </ul>
      )}
    </section>
  )
}

export default function Results({ poll, results, candidates, manager }: { poll: PollView; results: PollResults; candidates?: Record<string, string>; manager: boolean }) {
  return (
    <div className="space-y-4">
      <p className="inline-block rounded-xl bg-white/90 px-3 py-1 text-sm font-extrabold text-muted">{results.total === 1 ? '1 resposta' : `${results.total} respostas`}</p>
      {poll.fields.map((f, i) => {
        const res = results.fields.find(r => r.fieldId === f.id)
        if (!res) return null
        return (
          <section key={f.id} className="rounded-3xl border-2 border-line bg-white p-4 animate-dg-rise sm:p-5" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
            {poll.type !== 'schedule' && <h3 className="font-black text-ink">{f.title || `Pergunta ${results.fields.findIndex(r => r.fieldId === f.id) + 1}`}</h3>}
            <p className="mb-3 text-xs font-bold text-muted">{res.answered === 1 ? '1 resposta' : `${res.answered} respostas`}{f.showIf ? ' · pergunta condicional' : ''}</p>
            <FieldBlock poll={poll} field={f} res={res} candidates={candidates} manager={manager} />
          </section>
        )
      })}
    </div>
  )
}
