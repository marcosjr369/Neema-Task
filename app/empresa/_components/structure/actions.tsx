'use client'

import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlassIcon, PencilSimpleIcon, TrashIcon, TreeStructureIcon, UserPlusIcon, UserSwitchIcon, type Icon } from '@phosphor-icons/react'
import { useApp } from '../../../context/AppContext'
import { useOrgRequired } from '../../../context/OrgContext'
import { api, errorText } from '../../../lib/api'
import type { Department } from '../../../types'
import Avatar from '../../../components/ui/Avatar'
import Modal from '../../../components/ui/Modal'
import { Busy } from '../../../components/ui/Spinner'

export type DeptAction = 'edit' | 'add' | 'transfer' | 'invite' | 'delete'

const ITEMS: { id: DeptAction; icon: Icon; title: string; text: string; danger?: boolean }[] = [
  { id: 'edit', icon: PencilSimpleIcon, title: 'Editar departamento', text: 'Nome, descrição, chefia e funcionários.' },
  { id: 'add', icon: TreeStructureIcon, title: 'Adicionar subdepartamento', text: 'Fica dentro deste departamento.' },
  { id: 'transfer', icon: UserSwitchIcon, title: 'Transferir para este departamento', text: 'A pessoa sai do departamento onde está.' },
  { id: 'invite', icon: UserPlusIcon, title: 'Convidar para este departamento', text: 'A pessoa nova entra já neste departamento.' },
  { id: 'delete', icon: TrashIcon, title: 'Apagar departamento', text: 'Os subdepartamentos e as pessoas passam para o de cima.', danger: true },
]

/** Menu de acções de um departamento, aberto junto ao botão ⋯ (fecha ao clicar fora ou com Esc) */
export function ActionMenu({ anchor, onPick, onClose, root = false }: {
  anchor: DOMRect
  onPick: (a: DeptAction) => void
  onClose: () => void
  /** o cartão da empresa só permite adicionar departamentos */
  root?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const items = root
    ? [{ ...ITEMS[1], title: 'Adicionar departamento', text: 'Fica no topo da estrutura, logo abaixo da empresa.' }, ITEMS[3]]
    : ITEMS
  const width = 300
  const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))
  const below = anchor.bottom + 6
  const top = below + 340 > window.innerHeight ? Math.max(8, anchor.top - 6 - items.length * 62) : below

  return (
    <div ref={ref} role="menu" className="fixed z-50 rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-black/5 animate-fade-in" style={{ left, top, width }}>
      {items.map(it => (
        <button
          key={it.id}
          role="menuitem"
          onClick={() => { onClose(); onPick(it.id) }}
          className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-snow cursor-pointer"
        >
          <it.icon size={20} className={`mt-0.5 shrink-0 ${it.danger ? 'text-danger' : 'text-accent'}`} />
          <span className="min-w-0">
            <span className={`block text-sm font-extrabold ${it.danger ? 'text-danger' : 'text-ink'}`}>{it.title}</span>
            <span className="block text-xs font-semibold text-muted">{it.text}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Transferir uma ou várias pessoas para o departamento (saem do departamento onde estavam) */
export function TransferDialog({ dept, onClose }: { dept: Department; onClose: () => void }) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const people = org.members
    .filter(m => (m.status === 'activo' || m.status === 'pendente') && m.departmentId !== dept.id)
    .filter(m => !query || `${m.name} ${m.jobTitle ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await Promise.all(picked.map(id => api(`${org.base}/members/${id}`, { method: 'PATCH', body: { departmentId: dept.id } })))
      await org.refresh()
      showToast(picked.length === 1 ? 'Pessoa transferida' : `${picked.length} pessoas transferidas`, 'success')
      onClose()
    } catch (err) {
      await org.refresh()
      setError(errorText(err, 'Não foi possível transferir. Tenta outra vez.'))
    }
    setBusy(false)
  }

  return (
    <Modal
      title={`Transferir para ${dept.name}`}
      onClose={onClose}
      footer={
        <button onClick={submit} disabled={busy || !picked.length} aria-busy={busy} className="btn btn-primary w-full">
          <Busy busy={busy} text="A transferir…">{picked.length > 1 ? `Transferir ${picked.length} pessoas` : 'Transferir'}</Busy>
        </button>
      }
    >
      <div className="relative mb-3">
        <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input py-2.5 pl-10" placeholder="Procurar por nome ou cargo" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
      </div>
      <ul className="card divide-y-2 divide-line">
        {people.map(m => {
          const on = picked.includes(m.id)
          return (
            <li key={m.id}>
              <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-snow">
                <input type="checkbox" checked={on} onChange={() => setPicked(p => (on ? p.filter(x => x !== m.id) : [...p, m.id]))} className="h-4 w-4 accent-brand" />
                <Avatar name={m.name} picture={m.picture} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{m.name}</span>
                  <span className="block truncate text-xs font-semibold text-muted">{org.deptById(m.departmentId)?.name ?? 'Sem departamento'}</span>
                </span>
              </label>
            </li>
          )
        })}
        {people.length === 0 && <li className="px-3 py-6 text-center text-sm font-semibold text-muted">Ninguém para transferir</li>}
      </ul>
      {error && <p className="mt-3 text-sm font-bold text-danger">{error}</p>}
    </Modal>
  )
}
