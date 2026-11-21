'use client'

import { useMemo, useState } from 'react'
import {
  CalendarBlankIcon, CaretDownIcon, CheckSquareIcon, FlowArrowIcon, FloppyDiskIcon, GlobeIcon, KanbanIcon, MagnifyingGlassIcon, PuzzlePieceIcon,
  ShieldCheckIcon, TableIcon, TrophyIcon, XIcon, type Icon,
} from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import { FEATURES, FEATURE_KEYS, MODE_TEXT, canUse } from '../../lib/permissions'
import { departmentTree } from '../../lib/org'
import Avatar from '../../components/ui/Avatar'
import { Busy } from '../../components/ui/Spinner'
import type { FeatureKey, FeatureRule, OrgPermissions } from '../../types'

const ICON: Record<FeatureKey, Icon> = {
  inqueritos: CheckSquareIcon,
  quadros: KanbanIcon,
  planilhas: TableIcon,
  diagramas: FlowArrowIcon,
  reunioes: CalendarBlankIcon,
  formulariosPublicos: GlobeIcon,
  jogos: PuzzlePieceIcon,
  ranking: TrophyIcon,
}

const GROUPS: { id: 'criar' | 'partilhar' | 'ver'; title: string }[] = [
  { id: 'criar', title: 'Criar' },
  { id: 'partilhar', title: 'Partilhar fora da empresa' },
  { id: 'ver', title: 'Ver no menu' },
]

const MODES: FeatureRule['mode'][] = ['all', 'managers', 'admins', 'some']

/** Escolher pessoas e departamentos (modo "Escolher pessoas") */
function Picker({ rule, onChange }: { rule: FeatureRule; onChange: (r: FeatureRule) => void }) {
  const org = useOrgRequired()
  const [q, setQ] = useState('')
  const people = org.members.filter(m => m.status === 'activo' && m.role !== 'admin' && m.userId !== org.org.createdBy)
  const shown = people.filter(m => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()))
  const depts = departmentTree(org.departments)
  const toggle = (list: 'memberIds' | 'departmentIds', id: string) => {
    const cur = rule[list] ?? []
    onChange({ ...rule, [list]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 text-xs font-extrabold text-muted">Departamentos <span className="font-semibold">(incluem os subdepartamentos)</span></p>
        {depts.length ? (
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border-2 border-line p-1.5">
            {depts.map(({ dept, depth }) => {
              const on = !!rule.departmentIds?.includes(dept.id)
              return (
                <li key={dept.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-snow" style={{ paddingLeft: 8 + depth * 14 }}>
                    <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={() => toggle('departmentIds', dept.id)} />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dept.color }} />
                    <span className="truncate text-sm font-bold text-ink">{dept.name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        ) : <p className="rounded-2xl bg-snow p-3 text-sm font-semibold text-muted">Ainda não há departamentos.</p>}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-extrabold text-muted">Pessoas</p>
        <div className="rounded-2xl border-2 border-line p-1.5">
          <label className="mb-1 flex items-center gap-2 rounded-xl bg-snow px-2">
            <MagnifyingGlassIcon size={15} className="text-muted" />
            <input className="w-full bg-transparent py-1.5 text-sm font-semibold outline-none" placeholder="Procurar" value={q} onChange={e => setQ(e.target.value)} aria-label="Procurar pessoas" />
          </label>
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {shown.map(m => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 hover:bg-snow">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!rule.memberIds?.includes(m.id)} onChange={() => toggle('memberIds', m.id)} />
                  <Avatar name={m.name} picture={m.picture} size={22} />
                  <span className="truncate text-sm font-bold text-ink">{m.name}</span>
                </label>
              </li>
            ))}
            {!shown.length && <li className="px-2 py-1.5 text-sm font-semibold text-muted">Ninguém com esse nome.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function Permissions() {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [draft, setDraft] = useState<OrgPermissions>(() => org.org.permissions ?? {})
  const [open, setOpen] = useState<FeatureKey | null>(null)
  const [busy, setBusy] = useState(false)
  const saved = JSON.stringify(org.org.permissions ?? {})
  const dirty = JSON.stringify(draft) !== saved
  // quem conta: pessoas activas, sem a conta da empresa
  const people = useMemo(() => org.members.filter(m => m.status === 'activo' && m.userId !== org.org.createdBy), [org.members, org.org.createdBy])

  const setRule = (key: FeatureKey, rule: FeatureRule) => setDraft(d => {
    const next = { ...d }
    if (rule.mode === 'all') delete next[key]
    else next[key] = rule
    return next
  })

  const save = async () => {
    setBusy(true)
    try {
      await api(org.base, { method: 'PATCH', body: { permissions: draft } })
      await org.refresh()
      showToast('Permissões guardadas', 'success')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível guardar as permissões.'), 'danger')
    }
    setBusy(false)
  }

  return (
    <div className="max-w-3xl space-y-5 pb-24">
      <div className="flex items-start gap-3 rounded-3xl bg-brand-light/60 p-4">
        <ShieldCheckIcon size={26} weight="duotone" className="mt-0.5 shrink-0 text-brand" />
        <p className="text-sm font-semibold text-body">
          Escolhe quem pode usar cada funcionalidade no espaço da empresa. Os <b>administradores podem sempre tudo</b>.
          Tirar a permissão não apaga nada: a pessoa continua a ver o que lhe partilham e a responder a inquéritos.
        </p>
      </div>

      {GROUPS.map(g => (
        <section key={g.id}>
          <h2 className="mb-2 font-black text-ink">{g.title}</h2>
          <ul className="space-y-2">
            {FEATURE_KEYS.filter(k => FEATURES[k].group === g.id).map(key => {
              const f = FEATURES[key]
              const Icon = ICON[key]
              const rule: FeatureRule = draft[key] ?? { mode: 'all' }
              const allowed = people.filter(m => canUse(draft, org.departments, m, key)).length
              const expanded = open === key
              return (
                <li key={key} className={`rounded-3xl border-2 bg-white transition-colors ${rule.mode === 'all' ? 'border-line' : 'border-brand/40'}`}>
                  <button type="button" onClick={() => setOpen(expanded ? null : key)} aria-expanded={expanded}
                    className="flex w-full items-center gap-3 p-3 text-left sm:p-4 cursor-pointer">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-snow text-body"><Icon size={22} weight="duotone" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-ink">{f.name}</span>
                      <span className="block truncate text-xs font-bold text-muted">{f.text}</span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      <span className={`block text-sm font-extrabold ${rule.mode === 'all' ? 'text-accent-dark' : 'text-brand-dark'}`}>{MODE_TEXT[rule.mode]}</span>
                      <span className="block text-xs font-bold text-muted">{allowed} de {people.length} pessoas</span>
                    </span>
                    <CaretDownIcon size={18} className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="border-t-2 border-line p-3 animate-dg-rise sm:p-4">
                      <p className="mb-2 text-sm font-semibold text-body sm:hidden">{MODE_TEXT[rule.mode]} · {allowed} de {people.length} pessoas</p>
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Quem pode ${f.action}`}>
                        {MODES.map(mode => (
                          <button key={mode} type="button" role="radio" aria-checked={rule.mode === mode}
                            onClick={() => setRule(key, mode === 'some' ? { mode, memberIds: rule.memberIds ?? [], departmentIds: rule.departmentIds ?? [] } : { mode })}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold transition-colors cursor-pointer ${rule.mode === mode ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-body hover:bg-snow'}`}>
                            {MODE_TEXT[mode]}
                          </button>
                        ))}
                      </div>
                      {rule.mode === 'some' && <Picker rule={rule} onChange={r => setRule(key, r)} />}
                      {rule.mode === 'some' && !rule.memberIds?.length && !rule.departmentIds?.length && (
                        <p className="mt-2 text-xs font-bold text-gold-dark">Ainda não escolheste ninguém: por agora só os administradores podem.</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-3xl border-2 border-line bg-white/95 p-3 shadow-[0_10px_30px_-18px_rgb(43_40_64/0.5)] backdrop-blur lg:bottom-4">
        <span className="min-w-0 flex-1 text-xs font-bold text-muted">{dirty ? 'Tens alterações por guardar.' : 'Tudo guardado.'}</span>
        {dirty && <button type="button" className="btn btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => setDraft(org.org.permissions ?? {})}><XIcon size={14} /> Descartar</button>}
        <button type="button" className="btn btn-primary px-4 py-2 text-xs" disabled={busy || !dirty} onClick={save}>
          <Busy busy={busy} text="A guardar…"><FloppyDiskIcon size={16} /> Guardar</Busy>
        </button>
      </div>
    </div>
  )
}
