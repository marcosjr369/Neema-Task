'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BuildingsIcon, EyeSlashIcon, MagnifyingGlassIcon, ProhibitIcon, TrashIcon, UserIcon } from '@phosphor-icons/react'
import Avatar from '../../../components/ui/Avatar'
import { formatShort } from '../../../lib/stats'
import { ROLE_LABEL, type DeletedUser } from '../../../types'
import type { PanelOrg, PanelUser } from '../../../lib/server/panelStats'
import { ago, date, TYPE } from './format'

type Filter = 'todos' | 'personal' | 'business' | 'none' | 'disabled'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'personal', label: 'Pessoais' },
  { id: 'business', label: 'Empresa' },
  { id: 'none', label: 'Por escolher' },
  { id: 'disabled', label: 'Desactivados' },
]

export function UsersTable({
  users, now, days, onToggle, onDelete,
}: { users: PanelUser[]; now: number; days: number; onToggle: (u: PanelUser) => void; onDelete: (u: PanelUser) => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return users.filter(u => {
      if (filter === 'disabled' ? !u.disabled : filter !== 'todos' && u.type !== filter) return false
      return !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.orgs.some(o => o.name.toLowerCase().includes(term))
    })
  }, [users, q, filter])

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-line p-4">
        <h2 className="mr-auto text-lg font-black text-ink">Utilizadores <span className="text-muted">({list.length})</span></h2>
        <label className="relative w-full sm:w-64">
          <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input py-2 pl-9" placeholder="Nome, email ou empresa" value={q} onChange={e => setQ(e.target.value)} aria-label="Procurar utilizadores" />
        </label>
        <div className="no-scrollbar -mx-1 flex w-full gap-2 overflow-x-auto px-1 sm:w-auto">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`chip shrink-0 text-xs ${filter === f.id ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-snow text-left text-xs font-extrabold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Utilizador</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Empresa</th>
              <th className="px-3 py-2.5">Registo</th>
              <th className="px-3 py-2.5">Última actividade</th>
              <th className="px-3 py-2.5 text-right">Foco ({days}d)</th>
              <th className="px-3 py-2.5 text-right">XP ({days}d)</th>
              <th className="px-4 py-2.5 text-right">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-line">
            {list.map(u => (
              <tr key={u.id} className={u.disabled ? 'bg-danger-light/40' : ''}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={u.name} picture={u.picture} size={36} />
                    <span className="min-w-0">
                      <Link href={`/marcos/faz/utilizadores/${u.id}`} className="block max-w-[220px] truncate font-black text-ink hover:text-brand">{u.name}</Link>
                      <span className="block max-w-[220px] truncate text-xs font-semibold text-muted">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${TYPE[u.type].cls}`}>{TYPE[u.type].label}</span>
                </td>
                <td className="px-3 py-3 font-semibold text-body">
                  {u.orgs.length ? u.orgs.map(o => (
                    <span key={o.id} className="block truncate"><Link href={`/marcos/faz/empresas/${o.id}`} className="hover:text-brand">{o.name}</Link> <span className="text-xs text-muted">· {ROLE_LABEL[o.role]}</span></span>
                  )) : <span className="text-muted">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-body">{date(u.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-body">{ago(u.lastActive, now)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{formatShort(u.focusSeconds)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{u.points}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => onToggle(u)}
                    className={`chip text-xs ${u.disabled ? 'border-accent! text-accent-dark!' : 'border-danger/40! text-danger!'}`}
                  >
                    {u.disabled ? 'Reactivar' : (<><ProhibitIcon size={14} /> Desactivar</>)}
                  </button>
                  <button onClick={() => onDelete(u)} className="chip ml-2 border-danger/40! px-2! text-danger!" aria-label={`Eliminar ${u.name}`} title="Eliminar">
                    <TrashIcon size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center font-semibold text-muted"><UserIcon size={28} className="mx-auto mb-2" />Nenhum utilizador com estes filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function OrgsTable({ orgs, days }: { orgs: PanelOrg[]; days: number }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b-2 border-line p-4">
        <h2 className="text-lg font-black text-ink">Empresas <span className="text-muted">({orgs.length})</span></h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-snow text-left text-xs font-extrabold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Empresa</th>
              <th className="px-3 py-2.5">Administradores</th>
              <th className="px-3 py-2.5 text-right">Pessoas</th>
              <th className="px-3 py-2.5">Criada</th>
              <th className="px-3 py-2.5 text-right">Foco ({days}d)</th>
              <th className="px-3 py-2.5 text-right">Tarefas ({days}d)</th>
              <th className="px-4 py-2.5 text-right">XP ({days}d)</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-line">
            {orgs.map(o => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-dark"><BuildingsIcon size={20} /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-black text-ink">
                        <Link href={`/marcos/faz/empresas/${o.id}`} className="max-w-[220px] truncate hover:text-brand">{o.name}</Link>
                        {o.hidden && <EyeSlashIcon size={14} className="text-muted" aria-label="Escondida do ranking" />}
                      </span>
                      <span className="block text-xs font-semibold text-muted">{o.sector || 'Sem sector'}</span>
                    </span>
                  </span>
                </td>
                <td className="max-w-[200px] truncate px-3 py-3 font-semibold text-body">{o.admins.join(', ') || '—'}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">
                  {o.members}{o.pending > 0 && <span className="text-xs font-semibold text-muted"> +{o.pending} pend.</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-body">{date(o.createdAt)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{formatShort(o.focusSeconds)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{o.tasksDone}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-ink">{o.points}</td>
              </tr>
            ))}
            {orgs.length === 0 && <tr><td colSpan={7} className="p-8 text-center font-semibold text-muted">Ainda não há empresas.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Registo de utilizadores eliminados (os dados já não existem; fica o resumo do momento) */
export function DeletedTable({ list }: { list: DeletedUser[] }) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const rows = term ? list.filter(d => d.name.toLowerCase().includes(term) || d.email.toLowerCase().includes(term)) : list
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-line p-4">
        <h2 className="mr-auto text-lg font-black text-ink">Utilizadores eliminados <span className="text-muted">({rows.length})</span></h2>
        <label className="relative w-full sm:w-64">
          <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input py-2 pl-9" placeholder="Nome ou email" value={q} onChange={e => setQ(e.target.value)} aria-label="Procurar eliminados" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-snow text-left text-xs font-extrabold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Utilizador</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Empresas</th>
              <th className="px-3 py-2.5">Registo</th>
              <th className="px-3 py-2.5">Eliminado</th>
              <th className="px-3 py-2.5 text-right">Foco total</th>
              <th className="px-3 py-2.5 text-right">Tarefas</th>
              <th className="px-4 py-2.5">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-line">
            {rows.map(d => (
              <tr key={`${d.id}-${d.deletedAt}`}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="opacity-60 grayscale"><Avatar name={d.name} picture={d.picture} size={36} /></span>
                    <span className="min-w-0">
                      <span className="block max-w-[220px] truncate font-black text-ink">{d.name}</span>
                      <span className="block max-w-[220px] truncate text-xs font-semibold text-muted">{d.email}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${TYPE[d.type].cls}`}>{TYPE[d.type].label}</span>
                </td>
                <td className="px-3 py-3 font-semibold text-body">
                  {d.orgs.length ? d.orgs.map(o => <span key={o} className="block truncate">{o}</span>) : <span className="text-muted">—</span>}
                  {d.deletedOrgs.length > 0 && (
                    <span className="mt-1 block text-xs font-bold text-danger">Empresa apagada: {d.deletedOrgs.join(', ')}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-body">{date(d.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-body">
                  {date(d.deletedAt)}
                  <span className="block text-xs text-muted">{new Date(d.deletedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{formatShort(d.focusSeconds)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{d.tasksDone}</td>
                <td className="max-w-[240px] px-4 py-3 font-semibold text-body">{d.reason || <span className="text-muted">—</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center font-semibold text-muted"><TrashIcon size={28} className="mx-auto mb-2" />{list.length ? 'Nenhum resultado.' : 'Ainda ninguém foi eliminado.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
