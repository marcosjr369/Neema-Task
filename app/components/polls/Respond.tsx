'use client'

import { useMemo, useRef, useState } from 'react'
import {
  ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, CheckIcon, DotsSixVerticalIcon, HeartIcon, PaperclipIcon, ProhibitIcon, QuestionIcon,
  SmileyAngryIcon, SmileyIcon, SmileyMehIcon, SmileySadIcon, SmileyWinkIcon, StarIcon, XIcon,
} from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import { Busy } from '../ui/Spinner'
import { PollError, POLL_LIMITS, cleanAnswers, isContent, pagesOf, slotLabel, visibleFields } from '../../lib/polls'
import type { AnswerValue, PollField, PollFile, PollOption, PollView, SlotAnswer } from '../../types'
import { RichText } from './Theme'
import { imageUrl } from './look'
import './polls.css'

export type Submit = { answers: Record<string, AnswerValue>; other: Record<string, string>; name?: string; files: Record<string, File> }

type Props = {
  poll: PollView
  initial?: { answers: Record<string, AnswerValue>; other?: Record<string, string> }
  /** fotos dos candidatos que são colegas (eleições) */
  candidates?: Record<string, string>
  /** visitante sem conta: pode deixar o nome (se o inquérito não for anónimo) */
  guest?: boolean
  submitLabel?: string
  /** pré-visualização de quem gere: não envia */
  preview?: boolean
  /** antes das perguntas (ex.: título da candidatura) */
  header?: React.ReactNode
  onSubmit: (s: Submit) => Promise<void>
}

const SLOT_WORD: Record<SlotAnswer, { text: string; on: string }> = {
  yes: { text: 'Sim', on: 'border-accent bg-accent text-white' },
  maybe: { text: 'Talvez', on: 'border-gold bg-gold text-ink' },
  no: { text: 'Não', on: 'border-danger bg-danger text-white' },
}

const FACES = [
  { icon: SmileyAngryIcon, label: 'Muito mau', color: '#F2545B' },
  { icon: SmileySadIcon, label: 'Mau', color: '#FF8A3D' },
  { icon: SmileyMehIcon, label: 'Assim-assim', color: '#E0A419' },
  { icon: SmileyIcon, label: 'Bom', color: '#7FBF3F' },
  { icon: SmileyWinkIcon, label: 'Muito bom', color: '#12B5A6' },
]

function shuffled<T>(list: T[]) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function Choice({ on, multi, onClick, children, disabled }: { on: boolean; multi?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left font-bold transition-[background,border-color,transform] duration-150 active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'pf-on text-ink' : 'pf-hover border-line text-body'}`}>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors ${multi ? 'rounded-md' : 'rounded-full'} ${on ? 'pf-fill' : 'border-line bg-white'}`}>
        {on && <CheckIcon size={12} weight="bold" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

/** Ordenar opções: arrastar (rato/toque) ou setas */
function Ranking({ field, value, order, onChange }: { field: PollField; value: string[] | undefined; order: string[]; onChange: (v: string[]) => void }) {
  const list = value ?? order
  const [drag, setDrag] = useState<number | null>(null)
  const label = (id: string) => field.options?.find(o => o.id === id)?.label ?? ''
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return
    const next = [...list]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-muted">Arrasta (ou usa as setas) para pôr por ordem: o 1.º é o que preferes.</p>
      <ol className="space-y-1.5">
        {list.map((id, i) => (
          <li key={id} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
            onDragOver={e => { e.preventDefault(); if (drag !== null && drag !== i) { move(drag, i); setDrag(i) } }}
            className={`flex items-center gap-2 rounded-2xl border-2 bg-white px-2 py-2 transition-shadow ${drag === i ? 'pf-on shadow-lg' : value ? 'border-line' : 'border-dashed border-line'}`}>
            <DotsSixVerticalIcon size={18} className="shrink-0 cursor-grab text-muted" />
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${value ? 'pf-fill' : 'bg-snow text-muted'}`}>{i + 1}</span>
            <span className="min-w-0 flex-1 font-bold text-ink">{label(id)}</span>
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-lg p-1 text-muted hover:bg-snow disabled:opacity-30 cursor-pointer"><ArrowUpIcon size={16} /></button>
            <button type="button" aria-label="Descer" disabled={i === list.length - 1} onClick={() => move(i, i + 1)} className="rounded-lg p-1 text-muted hover:bg-snow disabled:opacity-30 cursor-pointer"><ArrowDownIcon size={16} /></button>
          </li>
        ))}
      </ol>
      {!value && <button type="button" onClick={() => onChange(list)} className="mt-2 text-sm font-extrabold pf-dark hover:underline cursor-pointer">Esta ordem está bem</button>}
    </div>
  )
}

function FieldInput({ field, value, other, onChange, onOther, file, onFile, candidates, pollType, order }: {
  field: PollField
  value: AnswerValue | undefined
  other?: string
  onChange: (v: AnswerValue | undefined) => void
  onOther: (t: string) => void
  file?: File | PollFile
  onFile: (f: File | undefined) => void
  candidates?: Record<string, string>
  pollType: PollView['type']
  /** ordem em que as opções aparecem (baralhadas ou não) */
  order: string[]
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const id = `f-${field.id}`
  const str = typeof value === 'string' ? value : ''
  const options = order.map(o => field.options?.find(x => x.id === o)).filter((o): o is PollOption => !!o)
  switch (field.kind) {
    case 'short': case 'email': case 'phone':
      return <input id={id} className="input" type={field.kind === 'email' ? 'email' : field.kind === 'phone' ? 'tel' : 'text'} maxLength={POLL_LIMITS.short}
        value={str} onChange={e => onChange(e.target.value)} placeholder={field.kind === 'email' ? 'nome@exemplo.com' : field.kind === 'phone' ? '+244 9xx xxx xxx' : 'A tua resposta'} />
    case 'long':
      return <textarea id={id} className="input min-h-28" maxLength={POLL_LIMITS.long} value={str} onChange={e => onChange(e.target.value)} placeholder="A tua resposta" />
    case 'number':
      return <input id={id} className="input sm:w-56" type="number" inputMode="decimal" value={typeof value === 'number' ? value : str}
        onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)} placeholder="0" />
    case 'date':
      return <input id={id} className="input sm:w-56" type="date" value={str} onChange={e => onChange(e.target.value || undefined)} />
    case 'time':
      return <input id={id} className="input sm:w-40" type="time" value={str} onChange={e => onChange(e.target.value || undefined)} />
    case 'dropdown':
      return (
        <select id={id} className="input" value={str} onChange={e => onChange(e.target.value || undefined)}>
          <option value="">Escolhe…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )
    case 'single': case 'multi': {
      const multi = field.kind === 'multi'
      const list = multi ? (Array.isArray(value) ? value : []) : str ? [str] : []
      const full = multi && !!field.max && list.length >= field.max
      const toggle = (k: string) => {
        if (!multi) return onChange(list[0] === k ? undefined : k)
        onChange(list.includes(k) ? list.filter(x => x !== k) : [...list, k])
      }
      return (
        <div className="space-y-2">
          {multi && !!field.max && <p className="text-xs font-bold text-muted">Escolhe até {field.max} ({list.length}/{field.max})</p>}
          {options.map(o => (
            <Choice key={o.id} on={list.includes(o.id)} multi={multi} disabled={full && !list.includes(o.id)} onClick={() => toggle(o.id)}>
              <span className="flex items-center gap-2">
                {pollType === 'election' && <Avatar name={o.label} picture={candidates?.[o.id]} size={30} />}
                <span>{o.label}</span>
              </span>
            </Choice>
          ))}
          {field.other && (
            <>
              <Choice on={list.includes('other')} multi={multi} disabled={full && !list.includes('other')} onClick={() => toggle('other')}>Outra</Choice>
              {list.includes('other') && (
                <input className="input ml-8 w-[calc(100%-2rem)] animate-dg-rise" autoFocus maxLength={POLL_LIMITS.other} value={other ?? ''}
                  onChange={e => onOther(e.target.value)} placeholder="Escreve a tua resposta" aria-label="Outra resposta" />
              )}
            </>
          )}
          {field.blank && (
            <Choice on={list.includes('blank')} onClick={() => toggle('blank')}>
              <span className="flex items-center gap-2 text-muted"><ProhibitIcon size={20} /> Votar em branco</span>
            </Choice>
          )}
        </div>
      )
    }
    case 'scale': {
      const max = field.max ?? 5
      const n = typeof value === 'number' ? value : Number(value) || 0
      const style = field.style ?? 'numbers'
      if (style === 'faces') {
        return (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={field.title}>
            {FACES.map((f, i) => (
              <button key={i} type="button" role="radio" aria-checked={n === i + 1} aria-label={f.label} title={f.label} onClick={() => onChange(n === i + 1 ? undefined : i + 1)}
                className={`flex flex-col items-center rounded-2xl border-2 px-2.5 py-1.5 transition-[transform,background] duration-150 hover:-translate-y-0.5 cursor-pointer ${n === i + 1 ? 'pf-on' : 'border-transparent'}`}>
                <f.icon size={40} weight={n === i + 1 ? 'fill' : 'duotone'} style={{ color: n === i + 1 || !n ? f.color : '#C9C6D6' }} className={n === i + 1 ? 'tut-pop' : ''} />
                <span className="text-[11px] font-extrabold text-muted">{f.label}</span>
              </button>
            ))}
          </div>
        )
      }
      if (style === 'stars' || style === 'hearts') {
        const Icon = style === 'stars' ? StarIcon : HeartIcon
        const color = style === 'stars' ? '#FFC53D' : '#F2545B'
        return (
          <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={field.title}>
            {Array.from({ length: max }, (_, i) => i + 1).map(v => (
              <button key={v} type="button" role="radio" aria-checked={n === v} aria-label={`${v} de ${max}`} onClick={() => onChange(n === v ? undefined : v)}
                className="rounded-lg p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer">
                <Icon size={max === 10 ? 28 : 36} weight={v <= n ? 'fill' : 'regular'} style={{ color: v <= n ? color : '#C9C6D6' }} className={v === n ? 'tut-pop' : ''} />
              </button>
            ))}
            {n > 0 && <span className="ml-2 text-sm font-black text-body">{n}/{max}</span>}
          </div>
        )
      }
      return (
        <div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={field.title}>
            {Array.from({ length: max }, (_, i) => i + 1).map(v => (
              <button key={v} type="button" role="radio" aria-checked={n === v} onClick={() => onChange(n === v ? undefined : v)}
                className={`h-11 min-w-11 flex-1 rounded-xl border-2 text-base font-black transition-[background,transform] duration-150 active:scale-95 cursor-pointer sm:flex-none sm:px-3 ${n === v ? 'pf-fill' : n > v ? 'pf-half' : 'pf-hover border-line text-body'}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs font-bold text-muted"><span>Nada</span><span>Muito</span></div>
        </div>
      )
    }
    case 'nps': {
      const n = typeof value === 'number' ? value : value === undefined ? -1 : Number(value)
      const tone = (v: number) => (v <= 6 ? '#F2545B' : v <= 8 ? '#E0A419' : '#12B5A6')
      return (
        <div>
          <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={field.title}>
            {Array.from({ length: 11 }, (_, v) => (
              <button key={v} type="button" role="radio" aria-checked={n === v} onClick={() => onChange(n === v ? undefined : v)}
                className="h-10 rounded-lg border-2 text-sm font-black transition-[transform,background] duration-150 active:scale-95 cursor-pointer sm:h-11"
                style={n === v ? { background: tone(v), borderColor: tone(v), color: '#fff' } : { borderColor: '#E9E7F2', color: '#4A4763' }}>
                {v}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs font-bold text-muted"><span>Nada provável</span><span>Muito provável</span></div>
        </div>
      )
    }
    case 'ranking':
      return <Ranking field={field} order={order} value={Array.isArray(value) ? value : undefined} onChange={onChange} />
    case 'likert': {
      const map = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>
      const set = (row: string, o: string) => onChange({ ...map, [row]: o })
      return (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[480px] border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr>
                <th />
                {field.options?.map(o => <th key={o.id} className="px-1 pb-1 text-center text-xs font-extrabold text-muted">{o.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {field.rows?.map(r => (
                <tr key={r.id} className="bg-snow">
                  <th scope="row" className="rounded-l-xl px-3 py-2 text-left font-bold text-ink">{r.label}</th>
                  {field.options?.map((o, k) => (
                    <td key={o.id} className={`text-center ${k === (field.options?.length ?? 0) - 1 ? 'rounded-r-xl' : ''}`}>
                      <button type="button" role="radio" aria-checked={map[r.id] === o.id} aria-label={`${r.label}: ${o.label}`} onClick={() => set(r.id, o.id)}
                        className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors cursor-pointer ${map[r.id] === o.id ? 'pf-fill' : 'border-line bg-white hover:border-muted'}`}>
                        {map[r.id] === o.id && <CheckIcon size={12} weight="bold" />}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'yesno':
      return (
        <div className="flex gap-2">
          {[true, false].map(v => (
            <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(value === v ? undefined : v)}
              className={`flex-1 rounded-2xl border-2 py-2.5 font-black transition-colors cursor-pointer sm:flex-none sm:px-8 ${value === v ? (v ? 'border-accent bg-accent text-white' : 'border-danger bg-danger text-white') : 'pf-hover border-line text-body'}`}>
              {v ? 'Sim' : 'Não'}
            </button>
          ))}
        </div>
      )
    case 'file':
      return (
        <div>
          {file ? (
            <div className="pf-on flex items-center gap-2 rounded-2xl border-2 p-2.5 animate-dg-rise">
              <PaperclipIcon size={20} className="pf-dark" />
              <span className="min-w-0 flex-1 truncate text-sm font-black text-ink">{file.name}</span>
              <span className="text-xs font-bold text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => onFile(undefined)} aria-label="Tirar o ficheiro" className="rounded-lg p-1 text-muted hover:bg-white cursor-pointer"><XIcon size={16} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="pf-hover flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center transition-colors cursor-pointer">
              <PaperclipIcon size={26} className="text-muted" />
              <span className="mt-1 font-black text-ink">Escolher ficheiro</span>
              <span className="text-xs font-semibold text-muted">Imagem, PDF ou documento do Office · até {POLL_LIMITS.file / 1024 / 1024} MB</span>
            </button>
          )}
          <input ref={fileInput} type="file" className="hidden" accept="image/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx,.pptx"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
        </div>
      )
    case 'slots': {
      const map = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, SlotAnswer>
      const set = (k: string, a: SlotAnswer) => {
        const next = { ...map }
        if (next[k] === a) delete next[k]
        else next[k] = a
        onChange(Object.keys(next).length ? next : undefined)
      }
      return (
        <ul className="space-y-2">
          {field.options?.map(o => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-line p-2 pl-3">
              <span className="min-w-0 flex-1 font-black capitalize text-ink">{slotLabel(o)}</span>
              <span className="flex gap-1">
                {(Object.keys(SLOT_WORD) as SlotAnswer[]).map(a => (
                  <button key={a} type="button" aria-pressed={map[o.id] === a} onClick={() => set(o.id, a)}
                    className={`rounded-xl border-2 px-3 py-1.5 text-sm font-extrabold transition-colors cursor-pointer ${map[o.id] === a ? SLOT_WORD[a].on : 'border-line text-body hover:bg-snow'}`}>
                    {SLOT_WORD[a].text}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )
    }
    default:
      return null
  }
}

/** Bloco de conteúdo (não é pergunta): texto ou imagem */
function ContentBlock({ poll, f }: { poll: PollView; f: PollField }) {
  if (f.kind === 'image' && f.image) {
    return (
      <figure className="overflow-hidden rounded-3xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl(poll.id, f.image.id)} alt={f.image.alt ?? f.title} className="max-h-[420px] w-full object-contain" loading="lazy" />
        {(f.title || f.help) && (
          <figcaption className="px-4 py-3">
            {f.title && <span className="block font-black text-ink">{f.title}</span>}
            {f.help && <RichText text={f.help} className="block text-sm font-semibold text-body" />}
          </figcaption>
        )}
      </figure>
    )
  }
  return (
    <div className="rounded-3xl bg-white p-4 sm:p-5">
      {f.title && <h3 className="text-xl font-black text-ink">{f.title}</h3>}
      {f.help && <RichText text={f.help} className="mt-1 block font-semibold leading-relaxed text-body" />}
    </div>
  )
}

/** Formulário para responder (votação, eleição, formulário, agendar), com páginas quando há secções */
export default function Respond({ poll, initial, candidates, guest, submitLabel, preview, header, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue | undefined>>(() => ({ ...(initial?.answers ?? {}) }))
  const [other, setOther] = useState<Record<string, string>>(() => ({ ...(initial?.other ?? {}) }))
  const [files, setFiles] = useState<Record<string, File>>({})
  const [name, setName] = useState('')
  /** ficheiros já enviados que a pessoa tirou */
  const [dropped, setDropped] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<{ fieldId?: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const top = useRef<HTMLFormElement>(null)
  // ordem das opções de cada pergunta: baralhada uma vez por pessoa, se o dono pediu
  const [orders] = useState<Record<string, string[]>>(() => Object.fromEntries(poll.fields.map(f => {
    const ids = (f.options ?? []).map(o => o.id)
    return [f.id, f.shuffle ? shuffled(ids) : ids]
  })))
  const orderOf = (f: PollField) => {
    const ids = (f.options ?? []).map(o => o.id)
    const known = (orders[f.id] ?? []).filter(id => ids.includes(id))
    return [...known, ...ids.filter(id => !known.includes(id))]
  }

  // os ficheiros já enviados (mudar a resposta) contam como respondidos
  const known = useMemo(() => {
    const out: Record<string, PollFile> = {}
    for (const f of poll.fields) {
      const v = initial?.answers[f.id]
      if (f.kind === 'file' && v && typeof v === 'object' && 'id' in v) out[f.id] = v as PollFile
    }
    return out
  }, [poll.fields, initial])
  const fileOf = (id: string): File | PollFile | undefined => files[id] ?? (dropped.has(id) ? undefined : known[id])
  const shown = visibleFields(poll.fields, { ...answers, ...Object.fromEntries(Object.keys(files).map(k => [k, 'x'])) })
  const pages = pagesOf(shown)
  const current = Math.min(page, pages.length - 1)
  const last = current === pages.length - 1
  const questions = shown.filter(f => !isContent(f))
  const done = questions.filter(f => {
    const v = f.kind === 'file' ? fileOf(f.id) : answers[f.id]
    return v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)
  }).length

  const set = (id: string, v: AnswerValue | undefined) => {
    setAnswers(a => ({ ...a, [id]: v }))
    if (error?.fieldId === id) setError(null)
  }

  /** Valida até à página actual (as seguintes ainda não contam como obrigatórias) */
  const check = (upTo: number) => {
    const later = new Set(pages.slice(upTo + 1).flatMap(p => p.fields.map(f => f.id)))
    const placeholders: Record<string, PollFile> = {}
    for (const f of poll.fields) {
      const x = fileOf(f.id)
      if (x) placeholders[f.id] = { id: 'local', name: x.name, size: x.size, type: 'type' in x ? x.type : '' }
    }
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(answers)) if (v !== undefined) clean[k] = v
    try {
      cleanAnswers({ fields: poll.fields.map(f => (later.has(f.id) ? { ...f, required: false } : f)) }, { answers: clean, other }, placeholders)
      return clean
    } catch (err) {
      if (err instanceof PollError) {
        const field = shown.find(f => f.title && err.message.includes(`"${f.title}"`))
        setError({ fieldId: field?.id, text: err.message })
        if (field) document.getElementById(`q-${field.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return null
      }
      throw err
    }
  }

  const goTo = (n: number) => {
    setPage(n)
    setError(null)
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!last) {
      if (check(current)) goTo(current + 1)
      return
    }
    const clean = check(pages.length - 1)
    if (!clean || preview) return
    setBusy(true)
    setError(null)
    try {
      // ficheiros já enviados ficam como estavam (só se reenviam os novos)
      const keep = Object.fromEntries(Object.entries(known).filter(([k]) => !files[k] && !dropped.has(k)))
      await onSubmit({ answers: { ...(clean as Record<string, AnswerValue>), ...keep }, other, name: guest && !poll.settings.anonymous ? name : undefined, files })
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : 'Não foi possível enviar. Tenta outra vez.' })
    }
    setBusy(false)
  }

  const label = submitLabel ?? (poll.type === 'election' ? 'Votar' : poll.type === 'vote' ? 'Votar' : 'Enviar resposta')
  const p = pages[current] ?? { fields: [] }
  // número de cada pergunta no formulário inteiro (os blocos de texto e imagem não contam)
  const numbers = new Map(shown.filter(f => !isContent(f)).map((f, i) => [f.id, i + 1]))

  return (
    <form ref={top} onSubmit={submit} noValidate className="pf scroll-mt-4 space-y-3">
      {header}
      {(pages.length > 1 || questions.length > 3) && (
        <div className="sticky top-0 z-10 rounded-2xl bg-white/90 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-extrabold text-muted">
            <span>{pages.length > 1 ? `Página ${current + 1} de ${pages.length}` : `${done} de ${questions.length} respondidas`}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-snow">
              <span className="pf-bar block h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(pages.length > 1 ? (current + 1) / pages.length : done / Math.max(1, questions.length)) * 100}%` }} />
            </span>
          </div>
        </div>
      )}

      <div key={current} className={pages.length > 1 ? 'pf-page space-y-3' : 'space-y-3'}>
        {p.section && (
          <div className="pf-on rounded-3xl border-2 p-4 sm:p-5">
            <h2 className="pf-dark text-xl font-black">{p.section.title || 'Secção'}</h2>
            {p.section.help && <RichText text={p.section.help} className="mt-1 block font-semibold text-body" />}
          </div>
        )}
        {p.fields.map((f, i) => {
          if (isContent(f)) return <ContentBlock key={f.id} poll={poll} f={f} />
          return (
            <fieldset key={f.id} id={`q-${f.id}`} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              className={`rounded-3xl border-2 bg-white p-4 animate-dg-rise sm:p-5 ${error?.fieldId === f.id ? 'border-danger' : 'border-transparent'}`}>
              <legend className="sr-only">{f.title}</legend>
              {poll.type !== 'schedule' && (
                <label htmlFor={`f-${f.id}`} className="flex gap-2 text-lg font-black leading-snug text-ink">
                  {poll.type === 'form' && <span className="pf-text shrink-0">{numbers.get(f.id)}.</span>}
                  <span>
                    {f.title || <span className="text-muted">Pergunta sem título</span>}
                    {f.required && poll.type !== 'election' && <span className="ml-1 text-danger" aria-label="obrigatória">*</span>}
                  </span>
                </label>
              )}
              {f.help && <RichText text={f.help} className="mt-0.5 block text-sm font-semibold text-muted" />}
              {f.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl(poll.id, f.image.id)} alt={f.image.alt ?? ''} className="mt-3 max-h-72 rounded-2xl object-contain" loading="lazy" />
              )}
              {f.showIf && <p className="pf-text mt-1 inline-flex items-center gap-1 text-xs font-bold"><QuestionIcon size={13} /> Apareceu por causa da tua resposta anterior</p>}
              <div className="mt-3">
                <FieldInput field={f} value={answers[f.id]} other={other[f.id]} pollType={poll.type} candidates={candidates} order={orderOf(f)}
                  onChange={v => set(f.id, v)} onOther={t => setOther(o => ({ ...o, [f.id]: t }))}
                  file={fileOf(f.id)} onFile={x => {
                    setFiles(prev => { const next = { ...prev }; if (x) next[f.id] = x; else delete next[f.id]; return next })
                    if (!x) setDropped(d => new Set(d).add(f.id))
                    if (error?.fieldId === f.id) setError(null)
                  }} />
              </div>
              {error?.fieldId === f.id && <p className="mt-2 text-sm font-bold text-danger" role="alert">{error.text}</p>}
            </fieldset>
          )
        })}
      </div>

      {last && guest && !poll.settings.anonymous && (
        <div className="rounded-3xl bg-white p-4 sm:p-5">
          <label htmlFor="guest-name" className="label">O teu nome <span className="font-semibold normal-case text-muted">(opcional)</span></label>
          <input id="guest-name" className="input" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Ana Silva" />
        </div>
      )}

      {error && !error.fieldId && <p className="rounded-2xl bg-danger-light p-3 text-sm font-bold text-danger-dark" role="alert">{error.text}</p>}
      {last && poll.settings.anonymous && (
        <p className="rounded-2xl bg-white/80 px-3 py-1.5 text-center text-xs font-bold text-muted">{poll.type === 'election' ? 'Voto secreto: ' : 'Resposta anónima: '}ninguém, nem quem criou, sabe o que respondeste.</p>
      )}
      <div className="flex gap-2">
        {current > 0 && (
          <button type="button" className="btn btn-ghost px-4" onClick={() => goTo(current - 1)}><ArrowLeftIcon size={18} weight="bold" /> <span className="max-sm:hidden">Anterior</span></button>
        )}
        <button className="btn pf-btn flex-1" disabled={busy || (preview && last)}>
          {last
            ? <Busy busy={busy} text="A enviar…">{preview ? 'Pré-visualização' : label}</Busy>
            : <>Seguinte <ArrowRightIcon size={18} weight="bold" /></>}
        </button>
      </div>
    </form>
  )
}
