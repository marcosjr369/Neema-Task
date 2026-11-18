'use client'

import { useMemo, useState } from 'react'
import { BuildingsIcon, CaretRightIcon, MagnifyingGlassIcon, TrashIcon } from '@phosphor-icons/react'
import { useApp } from '../../../context/AppContext'
import { useOrgRequired } from '../../../context/OrgContext'
import { api, errorText } from '../../../lib/api'
import { DEPT_COLORS, deptDeputyIds, deptHeadId, departmentPath, departmentTree, descendantIds, indentedName, parentOf } from '../../../lib/org'
import type { Department, Member } from '../../../types'
import Avatar from '../../../components/ui/Avatar'
import Modal from '../../../components/ui/Modal'
import { Busy } from '../../../components/ui/Spinner'

type Step = 'nome' | 'pessoas'
const STEPS: { id: Step; label: string }[] = [
  { id: 'nome', label: 'Nome' },
  { id: 'pessoas', label: 'Pessoas' },
]

const matches = (m: Member, q: string) => !q || `${m.name} ${m.jobTitle ?? ''} ${m.email}`.toLowerCase().includes(q.toLowerCase())

/** Criar ou editar um departamento. "parentId" pré-escolhe o departamento superior (botão +). */
export default function DeptForm({ dept, parentId: presetParent, onClose, onSaved }: {
  dept: Department | null
  parentId?: string
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [step, setStep] = useState<Step>('nome')
  const [parentId, setParentId] = useState(dept ? (parentOf(org.departments, dept)?.id ?? '') : (presetParent ?? ''))
  const [name, setName] = useState(dept?.name ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [color, setColor] = useState(dept?.color ?? DEPT_COLORS[org.departments.length % DEPT_COLORS.length])
  const [headId, setHeadId] = useState(dept ? (deptHeadId(dept) ?? '') : '')
  const [deputies, setDeputies] = useState<string[]>(dept ? deptDeputyIds(dept) : [])
  const [memberIds, setMemberIds] = useState<string[]>(() => (dept ? org.members.filter(m => m.departmentId === dept.id).map(m => m.id) : []))
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const people = useMemo(
    () => org.members.filter(m => m.status === 'activo' || m.status === 'pendente').sort((a, b) => a.name.localeCompare(b.name)),
    [org.members],
  )
  // não pode ficar dentro de si próprio nem de um subdepartamento seu
  const blocked = dept ? descendantIds(org.departments, dept.id) : new Set<string>()
  const parents = departmentTree(org.departments).filter(({ dept: d }) => !blocked.has(d.id))
  const path = departmentPath(org.departments, parentId || undefined)
  const filtered = people.filter(m => matches(m, query))

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const submit = async () => {
    if (!name.trim()) {
      setStep('nome')
      setError('Indica o nome do departamento.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = {
        name,
        description,
        color,
        parentId: parentId || null,
        supervisorIds: [headId, ...deputies.filter(id => id !== headId)].filter(Boolean),
        memberIds,
      }
      const res = dept
        ? await api<{ department: Department }>(`${org.base}/departments/${dept.id}`, { method: 'PATCH', body })
        : await api<{ department: Department }>(`${org.base}/departments`, { body })
      await org.refresh()
      showToast(dept ? 'Departamento actualizado' : 'Departamento criado', 'success')
      onSaved?.(res.department.id)
      onClose()
    } catch (err) {
      setError(errorText(err, 'Não foi possível guardar o departamento. Tenta outra vez.'))
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!dept) return
    const parent = parentOf(org.departments, dept)
    const where = parent ? `passam para ${parent.name}` : 'passam para o topo da estrutura'
    if (!confirm(`Apagar o departamento ${dept.name}? Os subdepartamentos e os funcionários ${where}.`)) return
    setBusy(true)
    try {
      await api(`${org.base}/departments/${dept.id}`, { method: 'DELETE' })
      await org.refresh()
      showToast('Departamento apagado', 'success')
      onClose()
    } catch (err) {
      setError(errorText(err, 'Não foi possível apagar o departamento. Tenta outra vez.'))
    }
    setBusy(false)
  }

  const last = step === 'pessoas'

  return (
    <Modal
      wide
      title={dept ? 'Editar departamento' : 'Novo departamento'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {step === 'pessoas' ? (
            <button type="button" onClick={() => setStep('nome')} className="btn btn-ghost px-4">Voltar</button>
          ) : dept ? (
            <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost px-4 text-danger" aria-label="Apagar departamento">
              <TrashIcon size={18} />
            </button>
          ) : null}
          <div className="flex-1" />
          {dept && !last && (
            <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className="btn btn-ghost">Guardar</button>
          )}
          {last ? (
            <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className="btn btn-primary">
              <Busy busy={busy} text="A guardar…">{dept ? 'Guardar' : 'Criar departamento'}</Busy>
            </button>
          ) : (
            <button type="button" onClick={() => (name.trim() ? setStep('pessoas') : setError('Indica o nome do departamento.'))} className="btn btn-primary">
              Seguinte
            </button>
          )}
        </div>
      }
    >
      <nav className="mb-4 flex items-center gap-1.5 text-sm font-extrabold" aria-label="Passos">
        {STEPS.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1.5">
            {i > 0 && <CaretRightIcon size={12} className="text-muted" />}
            <button
              type="button"
              onClick={() => (s.id === 'nome' || name.trim() ? setStep(s.id) : undefined)}
              className={`rounded-lg px-1.5 py-0.5 cursor-pointer ${step === s.id ? 'text-ink' : 'text-muted hover:text-body'}`}
              aria-current={step === s.id ? 'step' : undefined}
            >
              {s.label}
            </button>
          </span>
        ))}
      </nav>

      {step === 'nome' ? (
        <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="d-parent">Departamento superior</label>
              <select id="d-parent" className="input" value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">{org.org.name} (topo)</option>
                {parents.map(({ dept: d, depth }) => <option key={d.id} value={d.id}>{indentedName(d.name, depth)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-name">Nome</label>
              <input id="d-name" className="input" value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="Ex: Tecnologia" autoFocus maxLength={60} />
            </div>
            <div>
              <label className="label" htmlFor="d-desc">Descrição</label>
              <textarea id="d-desc" className="input min-h-24 resize-y" value={description} onChange={e => setDescription(e.target.value)} placeholder="O que faz este departamento (opcional)" maxLength={500} />
            </div>
            <div>
              <span className="label">Cor</span>
              <div className="flex flex-wrap gap-2">
                {DEPT_COLORS.map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`Cor ${c}`}
                    aria-pressed={color === c}
                    className="h-8 w-8 rounded-full cursor-pointer"
                    style={{ background: c, outline: color === c ? `3px solid ${c}` : undefined, outlineOffset: 2 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* onde fica na estrutura */}
          <div className="hidden sm:block">
            <span className="label">Na estrutura</span>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-ink"><BuildingsIcon size={16} className="shrink-0 text-accent" /> {org.org.name}</p>
              {path.map((d, i) => (
                <div key={d.id} className="card truncate border-l-4 px-2.5 py-2 text-xs font-extrabold text-ink" style={{ marginLeft: Math.min(i, 4) * 10, borderLeftColor: d.color }}>
                  {d.name}
                  <span className="block truncate font-semibold text-muted">{org.memberById(deptHeadId(d))?.name ?? 'Sem chefe'}</span>
                </div>
              ))}
              <div className="rounded-2xl border-2 border-dashed px-2.5 py-2 text-xs font-extrabold" style={{ marginLeft: Math.min(path.length, 4) * 10, borderColor: color, color }}>
                {name.trim() || 'Novo departamento'}
                <span className="block font-semibold text-muted">{org.memberById(headId)?.name ?? 'Sem chefe'}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="d-head">Chefe do departamento</label>
            <select id="d-head" className="input" value={headId} onChange={e => { setHeadId(e.target.value); setDeputies(d => d.filter(x => x !== e.target.value)) }}>
              <option value="">Sem chefe</option>
              {people.map(m => <option key={m.id} value={m.id}>{m.name}{m.jobTitle ? ` · ${m.jobTitle}` : ''}</option>)}
            </select>
            <p className="mt-1.5 text-xs font-semibold text-muted">O chefe e os adjuntos gerem este departamento e todos os subdepartamentos dele.</p>
          </div>

          <div className="relative">
            <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input py-2.5 pl-10" placeholder="Procurar por nome ou cargo" value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <PeoplePicker
            label="Adjuntos"
            hint="Substituem o chefe e têm as mesmas permissões."
            people={filtered.filter(m => m.id !== headId)}
            selected={deputies}
            onToggle={id => setDeputies(d => toggle(d, id))}
          />
          <PeoplePicker
            label="Funcionários"
            hint="Quem escolheres é transferido para este departamento."
            people={filtered}
            selected={memberIds}
            onToggle={id => setMemberIds(d => toggle(d, id))}
            note={m => {
              if (!m.departmentId || m.departmentId === dept?.id) return undefined
              return org.deptById(m.departmentId)?.name
            }}
          />
        </div>
      )}
      {error && <p className="mt-4 text-sm font-bold text-danger">{error}</p>}
    </Modal>
  )
}

function PeoplePicker({ label, hint, people, selected, onToggle, note }: {
  label: string
  hint: string
  people: Member[]
  selected: string[]
  onToggle: (id: string) => void
  note?: (m: Member) => string | undefined
}) {
  return (
    <div>
      <span className="label">{label} · {selected.length}</span>
      <p className="-mt-1 mb-2 text-xs font-semibold text-muted">{hint}</p>
      <ul className="card max-h-56 divide-y-2 divide-line overflow-y-auto">
        {people.map(m => {
          const on = selected.includes(m.id)
          const n = note?.(m)
          return (
            <li key={m.id}>
              <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-snow">
                <input type="checkbox" checked={on} onChange={() => onToggle(m.id)} className="h-4 w-4 accent-brand" />
                <Avatar name={m.name} picture={m.picture} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{m.name}</span>
                  {m.jobTitle && <span className="block truncate text-xs font-semibold text-muted">{m.jobTitle}</span>}
                </span>
                {n && <span className="max-w-[40%] truncate text-xs font-bold text-muted" title={on ? `Sai de ${n}` : n}>{on ? `sai de ${n}` : n}</span>}
              </label>
            </li>
          )
        })}
        {people.length === 0 && <li className="px-3 py-4 text-center text-sm font-semibold text-muted">Ninguém encontrado</li>}
      </ul>
    </div>
  )
}
