'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BuildingsIcon, CaretRightIcon, DotsThreeIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { useOrgRequired } from '../../../context/OrgContext'
import { childDepartments, departmentPath, deptDeputyIds, deptHeadId } from '../../../lib/org'
import type { Department, Member } from '../../../types'
import Avatar from '../../../components/ui/Avatar'

const matches = (m: Member, q: string) => !q || `${m.name} ${m.jobTitle ?? ''}`.toLowerCase().includes(q.toLowerCase())

function Person({ m, badge }: { m: Member; badge?: { text: string; className: string } }) {
  return (
    <li>
      <Link href={`/empresa/membro/${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-snow">
        <Avatar name={m.name} picture={m.picture} size={40} presence={m.status === 'activo' ? m.presence : undefined} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold text-ink">{m.name}</span>
            {badge && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold ${badge.className}`}>{badge.text}</span>}
            {m.status === 'pendente' && <span className="shrink-0 rounded-md bg-warm-light px-1.5 py-0.5 text-[11px] font-extrabold text-warm-dark">Convite pendente</span>}
          </span>
          <span className="block truncate text-sm font-semibold text-muted">{m.jobTitle || 'Cargo por definir'}</span>
        </span>
      </Link>
    </li>
  )
}

/** Painel lateral com a chefia, os funcionários e os subdepartamentos do departamento escolhido */
export default function DeptPanel({ dept, onSelect, onMenu, onClose }: {
  /** null: o cartão da empresa */
  dept: Department | null
  onSelect: (id: string | null) => void
  onMenu?: (anchor: DOMRect) => void
  onClose: () => void
}) {
  const org = useOrgRequired()
  const [query, setQuery] = useState('')
  const active = org.members.filter(m => m.status === 'activo' || m.status === 'pendente')
  const ids = dept ? new Set(dept.supervisorIds) : new Set<string>()
  const head = dept ? org.memberById(deptHeadId(dept)) : undefined
  const deputies = dept ? deptDeputyIds(dept).map(id => org.memberById(id)).filter((m): m is Member => !!m) : []
  const staff = active
    .filter(m => (dept ? m.departmentId === dept.id : !m.departmentId || !org.deptById(m.departmentId)) && !ids.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const subs = childDepartments(org.departments, dept?.id)
  const path = dept ? departmentPath(org.departments, dept.id).slice(0, -1) : []
  const total = (dept ? active.filter(m => m.departmentId === dept.id).length : active.length)

  const shownHead = head && matches(head, query) ? head : undefined
  const shownDeputies = deputies.filter(m => matches(m, query))
  const shownStaff = staff.filter(m => matches(m, query))

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[72%] flex-col rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 animate-slide-up lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-3 lg:max-h-none lg:w-[380px] lg:rounded-3xl"
      aria-label={dept ? `Departamento ${dept.name}` : org.org.name}
    >
      <div className="flex items-start gap-2 px-5 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          {dept && (
            <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs font-bold text-muted" aria-label="Caminho">
              <button onClick={() => onSelect(null)} className="hover:text-body cursor-pointer">{org.org.name}</button>
              {path.map(p => (
                <span key={p.id} className="flex items-center gap-1">
                  <CaretRightIcon size={10} />
                  <button onClick={() => onSelect(p.id)} className="hover:text-body cursor-pointer">{p.name}</button>
                </span>
              ))}
            </nav>
          )}
          <h2 className="flex items-center gap-2 text-xl font-black text-ink">
            {dept ? <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dept.color }} /> : <BuildingsIcon size={22} className="shrink-0 text-accent" />}
            <span className="truncate">{dept ? dept.name : org.org.name}</span>
          </h2>
        </div>
        {onMenu && (
          <button onClick={e => onMenu(e.currentTarget.getBoundingClientRect())} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Acções">
            <DotsThreeIcon size={22} weight="bold" />
          </button>
        )}
        <button onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Fechar painel">
          <XIcon size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {dept?.description && <p className="mb-3 text-sm font-semibold text-body">{dept.description}</p>}
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-xl border-2 border-line px-3 py-1 text-sm font-bold text-body">
            {dept ? 'Funcionários' : 'Pessoas na empresa'} <span className="text-muted">{total}</span>
          </span>
          <span className="rounded-xl border-2 border-line px-3 py-1 text-sm font-bold text-body">
            {dept ? 'Subdepartamentos' : 'Departamentos'} <span className="text-muted">{subs.length}</span>
          </span>
        </div>
        <div className="relative mb-4">
          <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input rounded-full py-2.5 pl-10" placeholder="Procurar por nome ou cargo" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {dept && (
          <section className="mb-4">
            <h3 className="mb-1 font-black text-ink">Chefia <span className="font-bold text-muted">{(head ? 1 : 0) + deputies.length}</span></h3>
            <ul>
              {shownHead && <Person m={shownHead} badge={{ text: 'Chefe', className: 'bg-brand-light text-brand-dark' }} />}
              {shownDeputies.map(m => <Person key={m.id} m={m} badge={{ text: 'Adjunto', className: 'bg-accent-light text-accent-dark' }} />)}
            </ul>
            {!head && !deputies.length && <p className="px-2 text-sm font-semibold text-muted">Ainda sem chefe.</p>}
          </section>
        )}

        <section className="mb-4">
          <h3 className="mb-1 font-black text-ink">{dept ? 'Funcionários' : 'Sem departamento'} <span className="font-bold text-muted">{staff.length}</span></h3>
          <ul>{shownStaff.map(m => <Person key={m.id} m={m} />)}</ul>
          {!shownStaff.length && <p className="px-2 text-sm font-semibold text-muted">{query ? 'Ninguém encontrado.' : dept ? 'Ainda sem funcionários.' : 'Todas as pessoas têm departamento.'}</p>}
        </section>

        {subs.length > 0 && (
          <section>
            <h3 className="mb-1 font-black text-ink">{dept ? 'Subdepartamentos' : 'Departamentos'}</h3>
            <ul>
              {subs.map(d => (
                <li key={d.id}>
                  <button onClick={() => onSelect(d.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-snow cursor-pointer">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">{d.name}</span>
                    <span className="text-sm font-semibold text-muted">{active.filter(m => m.departmentId === d.id).length}</span>
                    <CaretRightIcon size={14} className="text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}
