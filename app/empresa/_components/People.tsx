'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CopyIcon, DownloadSimpleIcon, LinkIcon, MagnifyingGlassIcon, ShareNetworkIcon, TrashIcon, UploadSimpleIcon, UserPlusIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import { parseCsv } from '../../lib/org'
import { ROLE_LABEL, type Member, type Role } from '../../types'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'

type Row = { name: string; email: string; jobTitle?: string; department?: string; phone?: string; role?: Role }

const HEADERS: Record<keyof Row, string[]> = {
  name: ['nome', 'name', 'funcionario', 'funcionário'],
  email: ['email', 'e-mail', 'correio'],
  jobTitle: ['cargo', 'funcao', 'função', 'jobtitle', 'job title', 'posição'],
  department: ['departamento', 'department', 'sector', 'setor', 'grupo', 'equipa'],
  phone: ['telefone', 'telemovel', 'telemóvel', 'phone', 'contacto'],
  role: ['papel', 'role', 'perfil'],
}

const ROLE_ALIASES: Record<string, Role> = {
  admin: 'admin', administrador: 'admin',
  supervisor: 'supervisor', chefe: 'supervisor', gestor: 'supervisor',
  membro: 'membro', funcionario: 'membro', funcionário: 'membro', colaborador: 'membro',
}

/** Converte o CSV em funcionários (com ou sem linha de cabeçalho) */
function rowsFromCsv(text: string): Row[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const head = rows[0].map(h => h.toLowerCase().trim())
  const hasHeader = head.some(h => HEADERS.email.includes(h) || HEADERS.name.includes(h))
  const order: (keyof Row)[] = ['name', 'email', 'jobTitle', 'department', 'phone', 'role']
  const index = (key: keyof Row) => (hasHeader ? head.findIndex(h => HEADERS[key].includes(h)) : order.indexOf(key))
  const cols = Object.fromEntries(order.map(k => [k, index(k)])) as Record<keyof Row, number>
  return (hasHeader ? rows.slice(1) : rows)
    .map(r => ({
      name: r[cols.name] ?? '',
      email: (r[cols.email] ?? '').toLowerCase(),
      jobTitle: cols.jobTitle >= 0 ? r[cols.jobTitle] : undefined,
      department: cols.department >= 0 ? r[cols.department] : undefined,
      phone: cols.phone >= 0 ? r[cols.phone] : undefined,
      role: cols.role >= 0 ? ROLE_ALIASES[(r[cols.role] ?? '').toLowerCase()] : undefined,
    }))
    .filter(r => r.email || r.name)
}

function downloadTemplate() {
  const csv = 'nome;email;cargo;departamento;telefone;papel\nAna Silva;ana@empresa.com;Analista;Financeiro;900 000 000;funcionario\nJoão Costa;joao@empresa.com;Chefe de vendas;Comercial;;supervisor\n'
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'funcionarios-modelo.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function InviteCard() {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [busy, setBusy] = useState(false)
  if (!org.org.inviteCode) return null
  const link = `${window.location.origin}/convite/${org.org.inviteCode}`

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copiado', 'success')
    } catch {
      showToast(text)
    }
  }

  return (
    <section className="card flex flex-col gap-4 border-b-4 p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <h2 className="font-black text-ink">Convidar para a equipa</h2>
        <p className="text-sm font-semibold text-muted">Partilha o link ou o código. Quem entrar fica como funcionário.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => copy(org.org.inviteCode)} className="rounded-xl border-2 border-dashed border-accent bg-accent-light px-4 py-2 font-mono text-lg font-black tracking-[0.2em] text-accent-dark cursor-pointer" title="Copiar código">
          {org.org.inviteCode}
        </button>
        <button onClick={() => copy(link)} className="btn btn-ghost px-3" aria-label="Copiar link">
          <LinkIcon size={18} />
        </button>
        {'share' in navigator && (
          <button
            onClick={() => navigator.share({ title: `Junta-te à ${org.org.name}`, text: `Código: ${org.org.inviteCode}`, url: link }).catch(() => undefined)}
            className="btn btn-ghost px-3"
            aria-label="Partilhar"
          >
            <ShareNetworkIcon size={18} />
          </button>
        )}
        {org.isAdmin && (
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm('Gerar um novo código? O código e o link actuais deixam de funcionar.')) return
              setBusy(true)
              try {
                await api(org.base, { method: 'PATCH', body: { regenerateCode: true } })
                await org.refresh()
              } catch (err) {
                showToast(errorText(err), 'danger')
              }
              setBusy(false)
            }}
            className="text-xs font-extrabold uppercase text-muted hover:text-body cursor-pointer"
          >
            Novo código
          </button>
        )}
      </div>
    </section>
  )
}

function MemberForm({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [jobTitle, setJobTitle] = useState(member?.jobTitle ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [departmentId, setDepartmentId] = useState(member?.departmentId ?? '')
  const [role, setRole] = useState<Role>(member?.role ?? 'membro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSelf = member?.id === org.me.id

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (member) {
        await api(`${org.base}/members/${member.id}`, {
          method: 'PATCH',
          body: { name, jobTitle, phone, departmentId: departmentId || null, role },
        })
        showToast('Funcionário actualizado', 'success')
      } else {
        const res = await api<{ added: Member[]; skipped: { reason: string }[] }>(`${org.base}/members`, {
          body: { members: [{ name, email, jobTitle, phone, departmentId: departmentId || undefined, role }] },
        })
        if (res.skipped.length) throw new Error(res.skipped[0].reason === 'Já existe' ? 'Já existe um funcionário com este email' : res.skipped[0].reason)
        showToast(res.added[0]?.status === 'activo' ? 'Adicionado' : 'Adicionado. Fica activo quando entrar com este email', 'success')
      }
      await org.refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!member || !confirm(`Remover ${member.name} da empresa?`)) return
    setBusy(true)
    try {
      await api(`${org.base}/members/${member.id}`, { method: 'DELETE' })
      await org.refresh()
      showToast('Funcionário removido', 'danger')
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <Modal
      title={member ? 'Editar funcionário' : 'Adicionar funcionário'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {member && !isSelf && (
            <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost px-4 text-danger" aria-label="Remover">
              <TrashIcon size={18} />
            </button>
          )}
          <button type="submit" form="member-form" disabled={busy || !email.trim()} className="btn btn-primary flex-1">
            {busy ? 'A guardar…' : member ? 'Guardar' : 'Adicionar'}
          </button>
        </div>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="m-name">Nome</label>
          <input id="m-name" className="input" value={name} onChange={e => setName(e.target.value)} autoFocus={!member} />
        </div>
        <div>
          <label className="label" htmlFor="m-email">Email</label>
          <input id="m-email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} disabled={!!member} required />
          {!member && <p className="mt-1 text-xs font-semibold text-muted">A pessoa entra com este email (Google) e fica logo ligada à empresa.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-job">Cargo</label>
            <input id="m-job" className="input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Analista" />
          </div>
          <div>
            <label className="label" htmlFor="m-phone">Telefone</label>
            <input id="m-phone" className="input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="m-dept">Departamento</label>
          <select id="m-dept" className="input" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
            <option value="">Sem departamento</option>
            {org.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Papel</span>
          <div className="grid grid-cols-3 gap-2">
            {(['membro', 'supervisor', 'admin'] as Role[]).map(r => (
              <button type="button" key={r} onClick={() => setRole(r)} className={`chip justify-center text-xs ${role === r ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">
            {role === 'supervisor'
              ? 'Cria e atribui tarefas, aprova trabalho e vê o tempo do seu departamento.'
              : role === 'admin'
                ? 'Acesso total: funcionários, departamentos, relatórios e definições.'
                : 'Vê as suas tarefas, regista o tempo e participa no ranking.'}
          </p>
        </div>
        {member && (
          <Link href={`/empresa/membro/${member.id}`} className="block text-sm font-extrabold uppercase tracking-wide text-accent">
            Ver relatório de tempo →
          </Link>
        )}
        {error && <p className="text-sm font-bold text-danger">{error}</p>}
      </form>
    </Modal>
  )
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: { email: string; reason: string }[] } | null>(null)
  const rows = useMemo(() => rowsFromCsv(text), [text])

  const submit = async () => {
    setBusy(true)
    try {
      const res = await api<{ added: Member[]; skipped: { email: string; reason: string }[] }>(`${org.base}/members`, { body: { members: rows } })
      setResult({ added: res.added.length, skipped: res.skipped })
      await org.refresh()
      showToast(`${res.added.length} funcionário${res.added.length === 1 ? '' : 's'} importado${res.added.length === 1 ? '' : 's'}`, 'success')
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
    setBusy(false)
  }

  return (
    <Modal
      title="Importar funcionários"
      onClose={onClose}
      wide
      footer={
        result ? (
          <button onClick={onClose} className="btn btn-primary w-full">Fechar</button>
        ) : (
          <button onClick={submit} disabled={busy || rows.length === 0} className={`btn w-full ${rows.length ? 'btn-primary' : 'btn-disabled'}`}>
            {busy ? 'A importar…' : `Importar ${rows.length || ''}`}
          </button>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="font-black text-ink">{result.added} adicionado{result.added === 1 ? '' : 's'}</p>
          {result.skipped.length > 0 && (
            <ul className="card divide-y-2 divide-line text-sm">
              {result.skipped.map((s, i) => (
                <li key={i} className="flex justify-between px-3 py-2 font-semibold">
                  <span className="truncate text-body">{s.email || '(sem email)'}</span>
                  <span className="text-danger">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted">
            Ficheiro CSV (exportado do Excel) com as colunas <b>nome, email, cargo, departamento, telefone, papel</b>. Só o email é obrigatório.
            Os departamentos que não existirem são criados.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-accent cursor-pointer">
              <UploadSimpleIcon size={18} /> Escolher ficheiro
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) setText(await f.text())
                }}
              />
            </label>
            <button onClick={downloadTemplate} className="btn btn-ghost">
              <DownloadSimpleIcon size={18} /> Modelo
            </button>
          </div>
          <textarea
            className="input min-h-28 font-mono text-xs"
            placeholder={'Ou cola aqui:\nnome;email;cargo;departamento\nAna Silva;ana@empresa.com;Analista;Financeiro'}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-extrabold uppercase text-muted">
                  <tr><th className="py-1 pr-3">Nome</th><th className="pr-3">Email</th><th className="pr-3">Cargo</th><th className="pr-3">Departamento</th><th>Papel</th></tr>
                </thead>
                <tbody className="font-semibold text-body">
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t-2 border-line">
                      <td className="py-1.5 pr-3">{r.name}</td>
                      <td className={`pr-3 ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ? '' : 'text-danger'}`}>{r.email || '—'}</td>
                      <td className="pr-3">{r.jobTitle}</td>
                      <td className="pr-3">{r.department}</td>
                      <td>{r.role ? ROLE_LABEL[r.role] : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && <p className="mt-2 text-xs font-bold text-muted">+ {rows.length - 50} linhas</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function People() {
  const org = useOrgRequired()
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState('all')
  const [editing, setEditing] = useState<Member | null | 'new'>(null)
  const [importing, setImporting] = useState(false)

  const scope = org.scope
  const q = query.trim().toLowerCase()
  const list = org.members
    .filter(m => scope === 'all' || m.id === org.me.id || (!!m.departmentId && scope.has(m.departmentId)))
    .filter(m => dept === 'all' || (dept === 'none' ? !m.departmentId : m.departmentId === dept))
    .filter(m => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.jobTitle?.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined)

  return (
    <div className="space-y-4">
      <InviteCard />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input py-2.5 pl-10" placeholder="Pesquisar por nome, email ou cargo" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="input py-2.5 lg:w-56" aria-label="Departamento">
          <option value="all">Todos os departamentos</option>
          {org.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          <option value="none">Sem departamento</option>
        </select>
        {org.isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setImporting(true)} className="btn btn-ghost flex-1 lg:flex-none">
              <UploadSimpleIcon size={18} /> Importar
            </button>
            <button onClick={() => setEditing('new')} className="btn btn-primary flex-1 lg:flex-none">
              <UserPlusIcon size={18} /> Adicionar
            </button>
          </div>
        )}
      </div>

      <p className="text-sm font-bold text-muted">{list.length} pessoa{list.length === 1 ? '' : 's'}</p>

      <ul className="card divide-y-2 divide-line">
        {list.map(m => {
          const d = org.deptById(m.departmentId)
          const content = (
            <>
              <Avatar name={m.name} picture={m.picture} size={44} presence={m.status === 'activo' ? m.presence : undefined} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-black text-ink">{m.name}</span>
                  {m.id === org.me.id && <span className="text-xs font-bold text-muted">(tu)</span>}
                </span>
                <span className="block truncate text-xs font-semibold text-muted">
                  {[m.jobTitle, m.email].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {d && (
                    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-extrabold text-white" style={{ background: d.color }}>{d.name}</span>
                  )}
                  {m.role !== 'membro' && (
                    <span className="rounded-md bg-brand-light px-1.5 py-0.5 text-[11px] font-extrabold text-brand-dark">{ROLE_LABEL[m.role]}</span>
                  )}
                  {m.status === 'pendente' && (
                    <span className="rounded-md bg-gold/20 px-1.5 py-0.5 text-[11px] font-extrabold text-gold-dark">Convite pendente</span>
                  )}
                </span>
              </span>
            </>
          )
          return (
            <li key={m.id}>
              {org.isAdmin ? (
                <button onClick={() => setEditing(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-snow cursor-pointer">{content}</button>
              ) : (
                <Link href={`/empresa/membro/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-snow">{content}</Link>
              )}
            </li>
          )
        })}
        {list.length === 0 && <li className="p-6 text-center font-semibold text-muted">Ninguém encontrado.</li>}
      </ul>

      {org.isAdmin && org.members.some(m => m.status === 'pendente') && (
        <p className="flex items-center gap-2 text-xs font-semibold text-muted">
          <CopyIcon size={14} /> Convites pendentes ficam activos quando a pessoa entrar com o email indicado.
          <button onClick={() => copy(`${window.location.origin}/entrar`)} className="font-extrabold text-accent underline cursor-pointer">Copiar link de entrada</button>
        </p>
      )}

      {editing && <MemberForm member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  )
}
