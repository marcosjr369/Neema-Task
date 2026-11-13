'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react'
import { useOrg } from '../../context/OrgContext'
import type { Member } from '../../types'
import Avatar from './Avatar'

export default function MemberPicker({
  people, value, onChange, label, summary,
}: { people: Member[]; value: string[]; onChange: (ids: string[]) => void; label: string; summary: (n: number) => string }) {
  const org = useOrg()!
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = people.filter(m => !q || m.name.toLowerCase().includes(q) || org.deptById(m.departmentId)?.name.toLowerCase().includes(q))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  const depts = org.departments
    .map(d => ({ d, ids: people.filter(m => m.departmentId === d.id && m.status === 'activo').map(m => m.id) }))
    .filter(x => x.ids.length > 1)

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label mb-0">{label}</span>
        <span className="text-xs font-bold text-muted">{summary(value.length)}</span>
      </div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map(id => {
            const m = org.memberById(id)
            return (
              <button
                type="button"
                key={id}
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-light py-0.5 pl-0.5 pr-2 text-xs font-bold text-accent-dark cursor-pointer"
                aria-label={`Retirar ${m?.name ?? 'pessoa'}`}
              >
                <Avatar name={m?.name ?? '?'} picture={m?.picture} size={22} />
                {m ? (m.id === org.me.id ? `${m.name} (eu)` : m.name) : 'Removido'}
                <XIcon size={12} />
              </button>
            )
          })}
        </div>
      )}
      {depts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {depts.map(({ d, ids }) => {
            const all = ids.every(id => value.includes(id))
            return (
              <button
                type="button"
                key={d.id}
                onClick={() => onChange(all ? value.filter(id => !ids.includes(id)) : [...new Set([...value, ...ids])])}
                className={`chip text-xs ${all ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}
              >
                <UsersThreeIcon size={14} /> {all ? 'Tirar' : 'Todo o'} {d.name} ({ids.length})
              </button>
            )
          })}
        </div>
      )}
      <div className="rounded-xl border-2 border-line">
        <div className="relative border-b-2 border-line">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="w-full rounded-t-xl bg-transparent py-2 pl-9 pr-3 text-sm font-semibold outline-none" placeholder="Procurar pessoa ou departamento" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <ul className="max-h-48 overflow-y-auto py-1">
          {shown.map(m => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-snow">
                <input type="checkbox" checked={value.includes(m.id)} onChange={() => toggle(m.id)} className="h-4 w-4 accent-brand" />
                <Avatar name={m.name} picture={m.picture} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                  {m.id === org.me.id ? `${m.name} (eu)` : m.name}
                  {org.deptById(m.departmentId) && <span className="font-semibold text-muted"> · {org.deptById(m.departmentId)!.name}</span>}
                </span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2 text-sm font-semibold text-muted">Ninguém encontrado.</li>}
        </ul>
      </div>
    </div>
  )
}
