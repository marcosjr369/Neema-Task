'use client'

import { useRef, useState } from 'react'
import {
  ArrowDownIcon, ArrowUpIcon, ArrowBendDownRightIcon, CopyIcon, HashIcon, HeartIcon, ImageIcon, PlusIcon, ShuffleIcon, SmileyIcon, StarIcon, TrashIcon, UserPlusIcon, XIcon,
} from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import { CONTENT_KINDS, FORM_KINDS, KIND_INFO, POLL_LIMITS, RESULTS_TEXT, SCALE_STYLES, hasOptions, isContent, pid, slotLabel } from '../../lib/polls'
import type { FieldKind, PollField, PollImage, PollOption, PollSettings, PollTheme, PollType, ResultsWhen, ScaleStyle } from '../../types'
import { KIND_ICON, TYPE_LOOK, imageUrl } from './look'
import { RichInput } from './Theme'
import { useCan } from '../layout/useCan'

export type Draft = { title: string; description: string; fields: PollField[]; settings: PollSettings; theme: PollTheme }
export type Person = { userId: string; name: string; picture?: string }

export function Toggle({ on, onChange, label, text, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; text?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-snow cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
      <span className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-brand' : 'bg-line'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : ''}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-ink">{label}</span>
        {text && <span className="block text-xs font-semibold text-muted">{text}</span>}
      </span>
    </button>
  )
}

const IconBtn = ({ label, onClick, children, disabled, danger }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
    className={`rounded-lg p-1.5 text-muted transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${danger ? 'hover:bg-danger-light hover:text-danger' : 'hover:bg-snow hover:text-ink'}`}>
    {children}
  </button>
)

const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Opções de uma pergunta. Colar várias linhas cria várias opções. */
function OptionsEditor({ options, onChange, placeholder = 'Opção', people, pickLabel }: {
  options: PollOption[]; onChange: (o: PollOption[]) => void; placeholder?: string; people?: Person[]; pickLabel?: string
}) {
  const [picking, setPicking] = useState(false)
  const add = (labels: string[], at = options.length) => {
    const next = [...options]
    next.splice(at, 0, ...labels.map(label => ({ id: pid(), label: label.slice(0, POLL_LIMITS.option) })))
    onChange(next.slice(0, POLL_LIMITS.options))
  }
  const used = new Set(options.map(o => o.userId).filter(Boolean))
  return (
    <div className="space-y-1.5" data-options>
      {options.map((o, i) => (
        <div key={o.id} className="group flex items-center gap-1.5">
          {o.userId ? <Avatar name={o.label} picture={people?.find(p => p.userId === o.userId)?.picture} size={26} /> : <span className="w-5 text-center text-xs font-black text-muted">{i + 1}</span>}
          <input className="input py-1.5" value={o.label} maxLength={POLL_LIMITS.option} placeholder={`${placeholder} ${i + 1}`} aria-label={`${placeholder} ${i + 1}`}
            onChange={e => onChange(options.map(x => (x.id === o.id ? { ...x, label: e.target.value } : x)))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const box = e.currentTarget.closest('[data-options]')
                add([''], i + 1)
                // a opção nova aparece no próximo desenho
                setTimeout(() => box?.querySelectorAll('input')[i + 1]?.focus(), 0)
              }
            }}
            onPaste={e => {
              const lines = e.clipboardData.getData('text').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
              if (lines.length < 2) return
              e.preventDefault()
              const rest = options.filter(x => x.id !== o.id || x.label)
              onChange(rest)
              add(lines, rest.length)
            }} />
          <IconBtn label="Subir" onClick={() => onChange(move(options, i, -1))} disabled={i === 0}><ArrowUpIcon size={15} /></IconBtn>
          <IconBtn label="Tirar opção" danger onClick={() => onChange(options.filter(x => x.id !== o.id))}><XIcon size={15} /></IconBtn>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => add([''])} className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-extrabold text-brand hover:bg-brand-light cursor-pointer">
          <PlusIcon size={15} weight="bold" /> {placeholder === 'Candidato' ? 'Candidato' : 'Opção'}
        </button>
        {people && people.length > 0 && (
          <button type="button" onClick={() => setPicking(v => !v)} className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-extrabold text-accent-dark hover:bg-accent-light cursor-pointer">
            <UserPlusIcon size={15} weight="bold" /> {pickLabel ?? 'Escolher colega'}
          </button>
        )}
        <span className="self-center text-xs font-semibold text-muted">Dica: cola uma lista para criar várias de uma vez.</span>
      </div>
      {picking && people && (
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-2xl bg-snow p-2 animate-dg-rise">
          {people.filter(p => !used.has(p.userId)).map(p => (
            <button key={p.userId} type="button" onClick={() => onChange([...options.filter(o => o.label || o.userId), { id: pid(), label: p.name, userId: p.userId }])}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line bg-white px-2 py-1 text-sm font-bold text-body hover:border-accent cursor-pointer">
              <Avatar name={p.name} picture={p.picture} size={20} /> {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Envia uma imagem para o inquérito e devolve o id (a página trata do pedido) */
export type Upload = (file: File) => Promise<string>

/** Botão para escolher/trocar/tirar uma imagem */
export function ImagePicker({ pollId, image, onChange, onUpload, label = 'Imagem', big = false }: {
  pollId: string; image?: PollImage; onChange: (img: PollImage | undefined) => void; onUpload: Upload; label?: string; big?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (f: File) => {
    setBusy(true)
    setError('')
    try { onChange({ id: await onUpload(f), alt: image?.alt }) } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem') }
    setBusy(false)
  }
  return (
    <div>
      {image ? (
        <div className="group relative overflow-hidden rounded-2xl border-2 border-line bg-snow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(pollId, image.id)} alt={image.alt ?? ''} className={`w-full object-cover ${big ? 'max-h-48' : 'max-h-40'}`} />
          <span className="absolute right-2 top-2 flex gap-1">
            <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-white/95 px-2 py-1 text-xs font-extrabold text-ink shadow hover:bg-white cursor-pointer">{busy ? 'A enviar…' : 'Trocar'}</button>
            <button type="button" onClick={() => onChange(undefined)} aria-label="Tirar imagem" className="rounded-lg bg-white/95 p-1 text-danger shadow hover:bg-white cursor-pointer"><XIcon size={14} weight="bold" /></button>
          </span>
          <input className="w-full border-t-2 border-line bg-white px-3 py-1.5 text-xs font-semibold text-body outline-none" placeholder="Descrição da imagem (para leitores de ecrã)" maxLength={200}
            value={image.alt ?? ''} onChange={e => onChange({ ...image, alt: e.target.value })} aria-label="Descrição da imagem" />
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line font-extrabold text-muted transition-colors hover:bg-snow hover:text-ink cursor-pointer ${big ? 'py-8 text-sm' : 'py-2 text-xs'}`}>
          <ImageIcon size={big ? 24 : 16} /> {busy ? 'A enviar…' : label}
        </button>
      )}
      {error && <p className="mt-1 text-xs font-bold text-danger" role="alert">{error}</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />
    </div>
  )
}

function FieldCard({ field, index, total, fields, onChange, onMove, onCopy, onRemove, kinds, pollId, onUpload, number }: {
  field: PollField; index: number; total: number; fields: PollField[]
  onChange: (f: PollField) => void; onMove: (d: number) => void; onCopy: () => void; onRemove: () => void; kinds: FieldKind[]
  pollId: string; onUpload: Upload; number: number
}) {
  const [help, setHelp] = useState(!!field.help)
  const [withImage, setWithImage] = useState(!!field.image)
  const Icon = KIND_ICON[field.kind]
  const content = isContent(field)
  const sources = fields.slice(0, index).filter(f => KIND_INFO[f.kind].choice && (f.options?.length ?? 0) > 0)
  const setKind = (kind: FieldKind) => {
    const fresh = newField(kind)
    const next: PollField = { ...field, kind }
    if (hasOptions(kind)) next.options = field.options?.length ? field.options : fresh.options
    else delete next.options
    if (kind === 'likert') next.rows = field.rows?.length ? field.rows : fresh.rows
    else delete next.rows
    if (kind === 'scale') { next.max = 5; next.style = field.style ?? 'stars' } else { delete next.style; if (kind !== 'multi') delete next.max }
    if (kind !== 'single' && kind !== 'multi') delete next.other
    if (!KIND_INFO[kind].choice && kind !== 'ranking') delete next.shuffle
    onChange(next)
  }
  const sectionLook = field.kind === 'section'
  return (
    <li className={`rounded-3xl border-2 bg-white p-3 animate-dg-rise sm:p-4 ${sectionLook ? 'border-brand/50 bg-brand-light/30' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${content ? 'bg-snow text-body' : 'bg-brand-light text-brand'}`}><Icon size={18} weight="bold" /></span>
        {!content && <span className="text-xs font-black text-muted">{number}</span>}
        {content
          ? <span className="text-sm font-black text-ink">{KIND_INFO[field.kind].name}</span>
          : (
            <select className="input w-auto py-1.5 text-sm" value={field.kind} onChange={e => setKind(e.target.value as FieldKind)} aria-label="Tipo de pergunta">
              {kinds.map(k => <option key={k} value={k}>{KIND_INFO[k].name}</option>)}
            </select>
          )}
        <span className="ml-auto flex items-center">
          <IconBtn label="Subir" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUpIcon size={16} /></IconBtn>
          <IconBtn label="Descer" onClick={() => onMove(1)} disabled={index === total - 1}><ArrowDownIcon size={16} /></IconBtn>
          <IconBtn label="Duplicar" onClick={onCopy}><CopyIcon size={16} /></IconBtn>
          <IconBtn label="Apagar" danger onClick={onRemove}><TrashIcon size={16} /></IconBtn>
        </span>
      </div>

      {field.kind === 'image' ? (
        <div className="mt-3 space-y-2">
          <ImagePicker pollId={pollId} image={field.image} onUpload={onUpload} big label="Escolher imagem" onChange={image => onChange({ ...field, image })} />
          <input className="input py-1.5 text-sm" value={field.title} maxLength={POLL_LIMITS.fieldTitle} placeholder="Legenda (opcional)" aria-label="Legenda" onChange={e => onChange({ ...field, title: e.target.value })} />
        </div>
      ) : (
        <>
          <input className={`input mt-3 font-black ${sectionLook ? 'text-lg' : 'text-base'}`} value={field.title} maxLength={POLL_LIMITS.fieldTitle}
            placeholder={sectionLook ? 'Título da secção' : field.kind === 'text' ? 'Título (opcional)' : 'Escreve a pergunta'}
            aria-label={sectionLook ? 'Título da secção' : `Pergunta ${number}`} onChange={e => onChange({ ...field, title: e.target.value })} />
          {help || content ? (
            <RichInput className="mt-2" value={field.help ?? ''} max={POLL_LIMITS.help} rows={field.kind === 'text' ? 4 : 2}
              label={field.kind === 'text' ? 'Texto' : 'Explicação'}
              placeholder={field.kind === 'text' ? 'Escreve o texto. Usa os botões para negrito, itálico, sublinhado e links.' : sectionLook ? 'Descrição da secção (opcional)' : 'Explicação (opcional)'}
              onChange={v => onChange({ ...field, help: v })} />
          ) : (
            <span className="mt-1 flex flex-wrap gap-3">
              <button type="button" className="text-xs font-extrabold text-muted hover:text-brand cursor-pointer" onClick={() => setHelp(true)}>+ Explicação</button>
              {!withImage && <button type="button" className="text-xs font-extrabold text-muted hover:text-brand cursor-pointer" onClick={() => setWithImage(true)}>+ Imagem</button>}
            </span>
          )}
          {!content && help && !withImage && (
            <button type="button" className="mt-1 text-xs font-extrabold text-muted hover:text-brand cursor-pointer" onClick={() => setWithImage(true)}>+ Imagem</button>
          )}
          {!content && withImage && (
            <div className="mt-2"><ImagePicker pollId={pollId} image={field.image} onUpload={onUpload} onChange={image => { onChange({ ...field, image }); if (!image) setWithImage(false) }} /></div>
          )}
        </>
      )}

      {(KIND_INFO[field.kind].choice || field.kind === 'ranking') && <div className="mt-3"><OptionsEditor options={field.options ?? []} onChange={options => onChange({ ...field, options })} /></div>}
      {field.kind === 'likert' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><p className="label">Afirmações (linhas)</p><OptionsEditor options={field.rows ?? []} placeholder="Afirmação" onChange={rows => onChange({ ...field, rows })} /></div>
          <div><p className="label">Escala (colunas)</p><OptionsEditor options={field.options ?? []} onChange={options => onChange({ ...field, options })} /></div>
        </div>
      )}
      {field.kind === 'scale' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-body">
          <span className="flex gap-1" role="radiogroup" aria-label="Estilo">
            {(Object.keys(SCALE_STYLES) as ScaleStyle[]).map(s => {
              const S = s === 'stars' ? StarIcon : s === 'hearts' ? HeartIcon : s === 'faces' ? SmileyIcon : HashIcon
              const on = (field.style ?? 'numbers') === s
              return (
                <button key={s} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...field, style: s, max: s === 'faces' ? 5 : field.max ?? 5 })}
                  className={`inline-flex items-center gap-1 rounded-xl border-2 px-2 py-1 text-xs font-extrabold cursor-pointer ${on ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-body hover:bg-snow'}`}>
                  <S size={14} weight={on ? 'fill' : 'bold'} /> {SCALE_STYLES[s]}
                </button>
              )
            })}
          </span>
          {field.style !== 'faces' && (
            <>
              de 1 a
              <select className="input w-auto py-1 text-sm" value={field.max ?? 5} onChange={e => onChange({ ...field, max: Number(e.target.value) })} aria-label="Valor máximo">
                <option value={5}>5</option><option value={10}>10</option>
              </select>
            </>
          )}
        </div>
      )}
      {field.kind === 'nps' && <p className="mt-3 rounded-xl bg-snow p-2 text-xs font-bold text-muted">De 0 a 10. Nos resultados aparece o NPS: % de promotores (9-10) menos % de detractores (0-6).</p>}
      {field.kind === 'multi' && (
        <div className="mt-3 flex items-center gap-2 text-sm font-bold text-body">
          No máximo
          <input className="input w-20 py-1.5 text-sm" type="number" min={0} max={field.options?.length ?? 0} value={field.max || ''} placeholder="∞"
            onChange={e => onChange({ ...field, max: Number(e.target.value) || 0 })} aria-label="Máximo de escolhas" />
          escolhas
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-line pt-2">
        {!content && (
          <label className="inline-flex items-center gap-2 text-sm font-bold text-body cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!field.required} onChange={e => onChange({ ...field, required: e.target.checked })} /> Obrigatória
          </label>
        )}
        {(field.kind === 'single' || field.kind === 'multi') && (
          <label className="inline-flex items-center gap-2 text-sm font-bold text-body cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!field.other} onChange={e => onChange({ ...field, other: e.target.checked })} /> Opção &ldquo;Outra&rdquo;
          </label>
        )}
        {(KIND_INFO[field.kind].choice || field.kind === 'ranking') && (
          <label className="inline-flex items-center gap-2 text-sm font-bold text-body cursor-pointer" title="Cada pessoa vê as opções numa ordem diferente">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!field.shuffle} onChange={e => onChange({ ...field, shuffle: e.target.checked })} /> <ShuffleIcon size={15} /> Baralhar opções
          </label>
        )}
        {sources.length > 0 && (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-sm font-bold text-body">
            <ArrowBendDownRightIcon size={16} className="text-brand" /> {sectionLook ? 'Mostrar a secção só se' : 'Mostrar só se'}
            <select className="input w-auto max-w-56 py-1 text-sm" aria-label="Condição"
              value={field.showIf ? `${field.showIf.fieldId}|${field.showIf.optionId}` : ''}
              onChange={e => {
                const [fieldId, optionId] = e.target.value.split('|')
                const next = { ...field }
                if (e.target.value) next.showIf = { fieldId, optionId }
                else delete next.showIf
                onChange(next)
              }}>
              <option value="">sempre</option>
              {sources.map(s => (
                <optgroup key={s.id} label={s.title || `Pergunta ${fields.indexOf(s) + 1}`}>
                  {s.options!.map(o => <option key={o.id} value={`${s.id}|${o.id}`}>responder &ldquo;{o.label}&rdquo;</option>)}
                </optgroup>
              ))}
            </select>
          </span>
        )}
      </div>
    </li>
  )
}

function AddField({ kinds, onAdd }: { kinds: FieldKind[]; onAdd: (k: FieldKind) => void }) {
  const Btn = ({ k }: { k: FieldKind }) => {
    const Icon = KIND_ICON[k]
    return (
      <button type="button" onClick={() => onAdd(k)} title={KIND_INFO[k].text}
        className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-extrabold text-body transition-colors hover:bg-brand-light hover:text-brand-dark cursor-pointer">
        <Icon size={18} className="shrink-0" /> <span className="min-w-0 truncate">{KIND_INFO[k].name}</span>
      </button>
    )
  }
  return (
    <div className="rounded-3xl border-2 border-dashed border-line p-3">
      <p className="label">Juntar pergunta</p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{kinds.map(k => <Btn key={k} k={k} />)}</div>
      <p className="label mt-3">Juntar conteúdo</p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{CONTENT_KINDS.map(k => <Btn key={k} k={k} />)}</div>
    </div>
  )
}

const newField = (kind: FieldKind): PollField => ({
  id: pid(), kind, title: '',
  ...(KIND_INFO[kind].choice || kind === 'ranking' ? { options: [{ id: pid(), label: 'Opção 1' }, { id: pid(), label: 'Opção 2' }] } : {}),
  ...(kind === 'likert' ? {
    options: ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente'].map(label => ({ id: pid(), label })),
    rows: [{ id: pid(), label: 'Afirmação 1' }, { id: pid(), label: 'Afirmação 2' }],
  } : {}),
  ...(kind === 'scale' ? { max: 5, style: 'stars' as const } : {}),
})

function SlotsEditor({ field, onChange }: { field: PollField; onChange: (f: PollField) => void }) {
  const [date, setDate] = useState('')
  const [times, setTimes] = useState('10:00')
  const options = field.options ?? []
  const add = () => {
    if (!date) return
    const list = times.split(/[,\s]+/).map(t => t.trim()).filter(t => /^\d{1,2}:\d{2}$/.test(t)).map(t => t.padStart(5, '0'))
    const have = new Set(options.map(o => o.at))
    const next = [...options, ...(list.length ? list : ['09:00']).filter(t => !have.has(`${date}T${t}`)).map(t => ({ id: pid(), label: '', at: `${date}T${t}` }))]
    next.sort((a, z) => (a.at ?? '').localeCompare(z.at ?? ''))
    onChange({ ...field, options: next.slice(0, POLL_LIMITS.slots) })
  }
  return (
    <div className="rounded-3xl border-2 border-line p-4">
      <p className="label">Datas e horas propostas</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-muted">Dia<input className="input mt-1 py-1.5" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="text-xs font-bold text-muted">Horas (separa com vírgulas)<input className="input mt-1 py-1.5" value={times} onChange={e => setTimes(e.target.value)} placeholder="10:00, 15:00" /></label>
        <button type="button" className="btn btn-primary px-4 py-2 text-sm" disabled={!date} onClick={add}><PlusIcon size={16} /> Juntar</button>
      </div>
      {options.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-muted">Escolhe um dia e as horas, e carrega em Juntar. Podes juntar vários dias.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {options.map(o => (
            <li key={o.id} className="flex items-center gap-2 rounded-xl bg-snow px-3 py-1.5 animate-dg-rise">
              <span className="min-w-0 flex-1 truncate text-sm font-black capitalize text-ink">{slotLabel(o)}</span>
              <IconBtn label="Tirar" danger onClick={() => onChange({ ...field, options: options.filter(x => x.id !== o.id) })}><XIcon size={14} /></IconBtn>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Perguntas, cargos ou datas, conforme o tipo */
export function QuestionsEditor({ type, fields, onChange, people, pollId, onUpload }: {
  type: PollType; fields: PollField[]; onChange: (f: PollField[]) => void; people: Person[]; pollId: string; onUpload: Upload
}) {
  const set = (i: number, f: PollField) => onChange(fields.map((x, k) => (k === i ? f : x)))

  if (type === 'ideas') {
    return <p className="rounded-3xl bg-warm-light/60 p-4 text-sm font-bold text-warm-dark">Nas ideias não há perguntas: cada pessoa propõe ideias e vota nas dos outros. Escreve na descrição o tema e as regras.</p>
  }
  if (type === 'schedule') return fields[0] ? <SlotsEditor field={fields[0]} onChange={f => set(0, f)} /> : null

  if (type === 'vote') {
    const f = fields[0]
    if (!f) return null
    return (
      <div className="rounded-3xl border-2 border-line p-4">
        <label className="label" htmlFor="vote-q">Pergunta</label>
        <input id="vote-q" className="input text-base font-black" value={f.title} maxLength={POLL_LIMITS.fieldTitle} placeholder="Ex.: Qual o melhor dia para a reunião?" onChange={e => set(0, { ...f, title: e.target.value })} />
        <p className="label mt-4">Opções</p>
        <OptionsEditor options={f.options ?? []} onChange={options => set(0, { ...f, options })} />
        <div className="mt-3 space-y-1 border-t-2 border-line pt-2">
          <Toggle on={f.kind === 'multi'} label="Permitir várias escolhas" onChange={v => set(0, { ...f, kind: v ? 'multi' : 'single', max: v ? f.max ?? 0 : undefined })} />
          {f.kind === 'multi' && (
            <div className="flex items-center gap-2 pl-14 text-sm font-bold text-body">
              No máximo <input className="input w-20 py-1 text-sm" type="number" min={0} value={f.max || ''} placeholder="∞" onChange={e => set(0, { ...f, max: Number(e.target.value) || 0 })} aria-label="Máximo de escolhas" /> escolhas
            </div>
          )}
          <Toggle on={!!f.other} label="Opção &quot;Outra&quot;" text="Quem vota pode escrever a sua própria resposta." onChange={v => set(0, { ...f, other: v })} />
        </div>
      </div>
    )
  }

  if (type === 'election') {
    return (
      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="rounded-3xl border-2 border-line p-4 animate-dg-rise">
            <div className="flex items-center gap-2">
              <input className="input text-base font-black" value={f.title} maxLength={POLL_LIMITS.fieldTitle} placeholder="Cargo (ex.: Presidente)" aria-label={`Cargo ${i + 1}`} onChange={e => set(i, { ...f, title: e.target.value })} />
              <IconBtn label="Subir" onClick={() => onChange(move(fields, i, -1))} disabled={i === 0}><ArrowUpIcon size={16} /></IconBtn>
              <IconBtn label="Apagar cargo" danger onClick={() => onChange(fields.filter(x => x.id !== f.id))} disabled={fields.length === 1}><TrashIcon size={16} /></IconBtn>
            </div>
            <p className="label mt-3">Candidatos</p>
            <OptionsEditor options={f.options ?? []} placeholder="Candidato" people={people} pickLabel="Candidato da empresa" onChange={options => set(i, { ...f, options })} />
            <div className="mt-2 border-t-2 border-line pt-1">
              <Toggle on={f.blank !== false} label="Permitir voto em branco" onChange={v => set(i, { ...f, blank: v })} />
            </div>
          </div>
        ))}
        {fields.length < POLL_LIMITS.positions && (
          <button type="button" onClick={() => onChange([...fields, { id: pid(), kind: 'single', title: '', required: true, blank: true, options: [] }])}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line p-3 font-extrabold text-brand hover:bg-snow cursor-pointer">
            <PlusIcon size={18} weight="bold" /> Juntar cargo
          </button>
        )}
      </div>
    )
  }

  // formulário e concurso
  const kinds = FORM_KINDS
  return (
    <div className="space-y-3">
      {type === 'contest' && <p className="text-sm font-bold text-muted">Cada candidatura tem sempre um título. Junta aqui o que mais queres pedir (foto, descrição…).</p>}
      <ul className="space-y-3">
        {fields.map((f, i) => (
          <FieldCard key={f.id} field={f} index={i} total={fields.length} fields={fields} kinds={kinds} pollId={pollId} onUpload={onUpload}
            number={fields.slice(0, i + 1).filter(x => !isContent(x)).length}
            onChange={x => set(i, x)}
            onMove={d => onChange(move(fields, i, d))}
            onCopy={() => { const next = [...fields]; next.splice(i + 1, 0, { ...f, id: pid(), options: f.options?.map(o => ({ ...o, id: pid() })), rows: f.rows?.map(o => ({ ...o, id: pid() })), showIf: undefined }); onChange(next) }}
            onRemove={() => onChange(fields.filter(x => x.id !== f.id).map(x => (x.showIf?.fieldId === f.id ? { ...x, showIf: undefined } : x)))} />
        ))}
      </ul>
      {fields.length < POLL_LIMITS.fields && <AddField kinds={kinds} onAdd={k => onChange([...fields, newField(k)])} />}
    </div>
  )
}

const toLocal = (t?: number) => {
  if (!t) return ''
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Definições: quem responde, anonimato, resultados, fecho */
export function SettingsEditor({ type, settings, onChange, hasAnswers, isOrg, people }: {
  type: PollType; settings: PollSettings; onChange: (s: PollSettings) => void; hasAnswers: boolean; isOrg: boolean; people: Person[]
}) {
  const s = settings
  const set = (patch: Partial<PollSettings>) => onChange({ ...s, ...patch })
  // abrir a pessoas de fora pode estar reservado (Definições → Permissões); já aberto, dá sempre para fechar
  const canPublic = useCan('formulariosPublicos') || !isOrg
  const entriesType = type === 'ideas' || type === 'contest'
  const look = TYPE_LOOK[type]
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border-2 border-line p-3">
        <p className="label px-2 pt-1">Respostas</p>
        <Toggle on={s.anonymous} disabled={type === 'election' || hasAnswers} onChange={v => set({ anonymous: v })}
          label={type === 'election' ? 'Voto secreto (sempre nas eleições)' : 'Anónimo'}
          text={hasAnswers ? 'Já há respostas: o anonimato já não muda.' : 'Ninguém, nem tu, vê quem respondeu o quê.'} />
        {!entriesType && type !== 'election' && (
          <>
            <Toggle on={s.onePerPerson} onChange={v => set({ onePerPerson: v })} label="Uma resposta por pessoa"
              text={!s.publicLink ? 'Cada pessoa responde só uma vez.' : type === 'form' ? 'Vale para quem tem conta. Pessoas sem conta preenchem sempre pelo link.' : 'Quem não tem conta tem de entrar para responder.'} />
            {s.onePerPerson && <Toggle on={s.canChange} onChange={v => set({ canChange: v })} label="Pode mudar a resposta" text="Enquanto o inquérito estiver aberto." />}
            <Toggle on={s.publicLink} disabled={!canPublic && !s.publicLink} onChange={v => set({ publicLink: v })} label="Aceitar respostas pelo link, sem conta"
              text={!canPublic && !s.publicLink ? 'A tua empresa reservou esta opção a algumas pessoas.' : isOrg ? 'Para clientes e pessoas de fora da empresa (como um formulário no teu site).' : 'Qualquer pessoa com o link responde.'} />
          </>
        )}
        <Toggle on={s.notify} onChange={v => set({ notify: v })} label="Avisar-me a cada resposta" text="Recebes uma notificação." />
      </section>

      {entriesType && (
        <section className="rounded-3xl border-2 border-line p-4">
          <p className="label">Votos</p>
          {type === 'contest' && (
            <div className="mb-3">
              <p className="text-sm font-black text-ink">Júri <span className="font-semibold text-muted">(opcional)</span></p>
              <p className="mb-2 text-xs font-semibold text-muted">Com júri, só estas pessoas votam e dão notas de 1 a 10. Sem júri, votam todos.</p>
              <div className="flex flex-wrap gap-1.5">
                {people.map(p => {
                  const on = !!s.jury?.includes(p.userId)
                  return (
                    <button key={p.userId} type="button" aria-pressed={on}
                      onClick={() => set({ jury: on ? s.jury!.filter(x => x !== p.userId) : [...(s.jury ?? []), p.userId] })}
                      className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-2 py-1 text-sm font-bold cursor-pointer ${on ? 'border-pink bg-[#FCE6F2] text-pink-dark' : 'border-line text-body hover:bg-snow'}`}>
                      <Avatar name={p.name} picture={p.picture} size={20} /> {p.name}
                    </button>
                  )
                })}
                {!people.length && <span className="text-sm font-semibold text-muted">Nos inquéritos da empresa podes escolher colegas para o júri.</span>}
              </div>
            </div>
          )}
          {!(type === 'contest' && s.jury?.length) && (
            <label className="flex items-center gap-2 text-sm font-bold text-body">
              Votos por pessoa
              <input className="input w-20 py-1.5 text-sm" type="number" min={0} max={50} value={s.votesPerPerson || ''} placeholder="∞"
                onChange={e => set({ votesPerPerson: Number(e.target.value) || 0 })} />
              <span className="text-xs font-semibold text-muted">(vazio = sem limite)</span>
            </label>
          )}
        </section>
      )}

      <section className="rounded-3xl border-2 border-line p-4">
        <label className="label" htmlFor="poll-results">Os participantes vêem os resultados</label>
        <select id="poll-results" className="input" value={s.results} onChange={e => set({ results: e.target.value as ResultsWhen })}>
          {(Object.keys(RESULTS_TEXT) as ResultsWhen[]).map(r => <option key={r} value={r}>{RESULTS_TEXT[r]}</option>)}
        </select>
        <p className="mt-1 text-xs font-semibold text-muted">Tu (e quem gere) vês sempre os resultados.</p>
      </section>

      <section className="rounded-3xl border-2 border-line p-4">
        <p className="label">Fecho automático</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-muted">Fecha a
            <span className="mt-1 flex gap-1">
              <input className="input py-1.5" type="datetime-local" value={toLocal(s.closesAt)} onChange={e => set({ closesAt: e.target.value ? new Date(e.target.value).getTime() : undefined })} />
              {s.closesAt && <IconBtn label="Sem data de fecho" onClick={() => set({ closesAt: undefined })}><XIcon size={16} /></IconBtn>}
            </span>
          </label>
          {!entriesType && (
            <label className="text-xs font-bold text-muted">Ou ao chegar a
              <input className="input mt-1 py-1.5" type="number" min={1} value={s.maxResponses ?? ''} placeholder="sem limite" onChange={e => set({ maxResponses: Number(e.target.value) || undefined })} />
            </label>
          )}
        </div>
      </section>

      {!entriesType && (
        <section className="rounded-3xl border-2 border-line p-4">
          <label className="label" htmlFor="poll-thanks">Mensagem depois de responder</label>
          <textarea id="poll-thanks" className="input min-h-16" maxLength={POLL_LIMITS.thanks} value={s.thanks ?? ''} placeholder="Obrigado pela tua resposta!" onChange={e => set({ thanks: e.target.value })} />
        </section>
      )}
      <p className="text-center text-xs font-bold" style={{ color: look.color }}>As alterações só contam depois de carregares em Guardar.</p>
    </div>
  )
}
