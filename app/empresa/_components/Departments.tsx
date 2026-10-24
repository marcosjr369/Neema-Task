'use client'

import { useState } from 'react'
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import { DEPT_COLORS } from '../../lib/org'
import type { Department } from '../../types'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'

function DepartmentForm({ dept, onClose }: { dept: Department | null; onClose: () => void }) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [name, setName] = useState(dept?.name ?? '')
  const [color, setColor] = useState(dept?.color ?? DEPT_COLORS[org.departments.length % DEPT_COLORS.length])
  const [supervisors, setSupervisors] = useState<string[]>(dept?.supervisorIds ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const candidates = org.members.filter(m => m.status === 'activo' || m.status === 'pendente').sort((a, b) => a.name.localeCompare(b.name))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { name, color, supervisorIds: supervisors }
      if (dept) await api(`${org.base}/departments/${dept.id}`, { method: 'PATCH', body })
      else await api(`${org.base}/departments`, { body })
      await org.refresh()
      showToast(dept ? 'Departamento actualizado' : 'Departamento criado', 'success')
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!dept || !confirm(`Apagar o departamento ${dept.name}? Os funcionários ficam sem departamento.`)) return
    setBusy(true)
    try {
      await api(`${org.base}/departments/${dept.id}`, { method: 'DELETE' })
      await org.refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <Modal
      title={dept ? 'Editar departamento' : 'Novo departamento'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {dept && (
            <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost px-4 text-danger" aria-label="Apagar">
              <TrashIcon size={18} />
            </button>
          )}
          <button type="submit" form="dept-form" disabled={busy || !name.trim()} className="btn btn-primary flex-1">
            {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <form id="dept-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="d-name">Nome</label>
          <input id="d-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Comercial" autoFocus required maxLength={60} />
        </div>
        <div>
          <span className="label">Cor</span>
          <div className="flex flex-wrap gap-2">
            {DEPT_COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                className="h-9 w-9 rounded-full cursor-pointer"
                style={{ background: c, outline: color === c ? `3px solid ${c}` : undefined, outlineOffset: 2 }}
              />
            ))}
          </div>
        </div>
        <div>
          <span className="label">Supervisores</span>
          <p className="mb-2 text-xs font-semibold text-muted">Podem atribuir tarefas, aprovar trabalho e ver o tempo deste departamento.</p>
          <ul className="card max-h-64 divide-y-2 divide-line overflow-y-auto">
            {candidates.map(m => {
              const on = supervisors.includes(m.id)
              return (
                <li key={m.id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-snow">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSupervisors(s => (on ? s.filter(x => x !== m.id) : [...s, m.id]))}
                      className="h-4 w-4 accent-brand"
                    />
                    <Avatar name={m.name} picture={m.picture} size={28} />
                    <span className="flex-1 truncate font-bold text-ink">{m.name}</span>
                    <span className="truncate text-xs font-semibold text-muted">{org.deptById(m.departmentId)?.name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
        {error && <p className="text-sm font-bold text-danger">{error}</p>}
      </form>
    </Modal>
  )
}

export default function Departments() {
  const org = useOrgRequired()
  const [editing, setEditing] = useState<Department | null | 'new'>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-muted">Agrupa os funcionários e define quem supervisiona cada grupo.</p>
        <button onClick={() => setEditing('new')} className="btn btn-primary shrink-0">
          <PlusIcon size={18} /> Novo
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {org.departments.map(d => {
          const people = org.members.filter(m => m.departmentId === d.id)
          const sups = d.supervisorIds.map(id => org.memberById(id)).filter(Boolean)
          return (
            <button key={d.id} onClick={() => setEditing(d)} className="card overflow-hidden border-b-4 text-left hover:bg-snow cursor-pointer">
              <div className="h-2" style={{ background: d.color }} />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="truncate text-lg font-black text-ink">{d.name}</h3>
                  <PencilSimpleIcon size={16} className="text-muted" />
                </div>
                <p className="text-sm font-bold text-muted">{people.length} pessoa{people.length === 1 ? '' : 's'}</p>
                <div className="mt-3 flex -space-x-2">
                  {people.slice(0, 6).map(m => (
                    <span key={m.id} className="rounded-full ring-2 ring-white"><Avatar name={m.name} picture={m.picture} size={30} /></span>
                  ))}
                  {people.length > 6 && <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-snow text-xs font-black text-muted ring-2 ring-white">+{people.length - 6}</span>}
                </div>
                <p className="mt-3 truncate text-xs font-bold text-muted">
                  Supervisão: <span className="text-body">{sups.length ? sups.map(m => m!.name).join(', ') : '—'}</span>
                </p>
              </div>
            </button>
          )
        })}
        {org.departments.length === 0 && (
          <p className="card col-span-full p-6 text-center font-semibold text-muted">Ainda sem departamentos. Cria o primeiro ou importa funcionários com a coluna “departamento”.</p>
        )}
      </div>
      {editing && <DepartmentForm dept={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
