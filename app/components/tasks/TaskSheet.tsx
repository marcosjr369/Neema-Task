'use client'

import { useEffect, useState } from 'react'
import { MinusIcon, PaperclipIcon, PlusIcon, RepeatIcon, ShieldCheckIcon, XIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { CATEGORIES, CATEGORY_CONFIG, ChecklistItem, COMPANY_ACCOUNT_LABEL, Priority, PRIORITY_CONFIG, Recurrence, ROLE_LABEL, Task, TaskCategory } from '../../types'
import { canSuperviseTask } from '../../lib/org'
import Avatar from '../ui/Avatar'
import { CategoryGlyph } from '../ui/icons'

const RECURRENCES: { id: Recurrence; label: string }[] = [
  { id: 'diaria', label: 'Diária' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal', label: 'Mensal' },
]

const itemId = () => Math.random().toString(36).slice(2, 10)

/** Converte ISO → valor aceite por <input type="datetime-local"> */
function toLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

function TaskForm({ task, onDone }: { task: Task | null; onDone: () => void }) {
  const { addTask, updateTask, settings, showToast } = useApp()
  const org = useOrg()
  const canAssign = !!org?.isManager
  // a conta da empresa não faz tarefas: tem de escolher o responsável
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? (org?.isCompany ? '' : org?.me.id) ?? '')
  const [reviewerId, setReviewerId] = useState(task?.reviewerId ?? '')
  const [requiresApproval, setRequiresApproval] = useState<boolean | null>(task?.requiresApproval ?? null)
  const [requiresAttachment, setRequiresAttachment] = useState(task?.requiresAttachment ?? false)
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(task?.recurrence)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? [])
  const [checkInput, setCheckInput] = useState('')
  // por omissão, tarefas atribuídas a outra pessoa precisam de aprovação
  const approval = requiresApproval ?? (!!org && assigneeId !== org.me.id)
  const assignee = org?.memberById(assigneeId)
  const assigningOther = !!org && assigneeId !== org.me.id
  // quem pode aprovar: supervisores, administradores e a conta da empresa (nunca o próprio responsável)
  const supervisors = org
    ? [...(org.isCompany ? [org.me] : []), ...org.members].filter(m => canSuperviseTask(m, org.org) && m.id !== assigneeId)
    : []

  const addCheck = () => {
    if (checkInput.trim()) setChecklist(l => [...l, { id: itemId(), text: checkInput.trim(), done: false }])
    setCheckInput('')
  }
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'trabalho')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'media')
  const [focus, setFocus] = useState(task?.focusDuration ?? settings.workMinutes)
  const [deadline, setDeadline] = useState(toLocalInput(task?.deadline))
  const [tags, setTags] = useState<string[]>(task?.tags ?? [])
  const [tagInput, setTagInput] = useState('')

  const isRest = CATEGORY_CONFIG[category].isRest
  const presets = isRest ? [10, 15, 30, 60] : [15, 25, 45, 60]

  const pickCategory = (c: TaskCategory) => {
    setCategory(c)
    if (!task) setFocus(CATEGORY_CONFIG[c].isRest ? CATEGORY_CONFIG[c].defaultFocus : settings.workMinutes)
  }

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (org && canAssign && !assigneeId) {
      showToast('Escolhe o funcionário responsável', 'danger')
      return
    }
    const data = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      focusDuration: focus,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      tags,
      checklist,
      ...(org && canAssign
        ? {
            assigneeId,
            requiresApproval: approval,
            reviewerId: approval && supervisors.some(m => m.id === reviewerId) ? reviewerId : undefined,
            requiresAttachment,
            recurrence,
          }
        : {}),
    }
    if (task) {
      updateTask(task.id, data)
      showToast('Tarefa actualizada', 'success')
    } else {
      addTask(data)
      showToast(assigningOther ? `Tarefa atribuída a ${assignee?.name ?? 'funcionário'}` : 'Tarefa criada', 'success')
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
        <div>
          <label className="label" htmlFor="t-title">O que vais fazer?</label>
          <input
            id="t-title"
            autoFocus={!task}
            className="input text-lg"
            placeholder="Ex: Estudar capítulo 3"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
            required
          />
        </div>

        {org && canAssign && (
          <div>
            <label className="label" htmlFor="t-assignee">Responsável</label>
            <div className="flex items-center gap-3">
              <Avatar name={assignee?.name ?? '?'} picture={assignee?.picture} size={40} />
              <select id="t-assignee" className="input" value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required>
                {!assigneeId && <option value="" disabled>Escolhe um funcionário</option>}
                {org.assignable.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id === org.me.id ? `${m.name} (eu)` : m.name}
                    {org.deptById(m.departmentId) ? ` · ${org.deptById(m.departmentId)!.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <span className="label">Categoria</span>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(c => {
              const cfg = CATEGORY_CONFIG[c]
              const sel = c === category
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => pickCategory(c)}
                  className="flex flex-col items-center gap-1 rounded-2xl border-2 border-b-4 py-2 text-xs font-bold transition-transform active:translate-y-[2px] active:border-b-2 cursor-pointer"
                  style={{
                    borderColor: sel ? cfg.color : '#E9E7F2',
                    background: sel ? cfg.light : '#fff',
                    color: sel ? cfg.dark : '#6E6A85',
                  }}
                >
                  <CategoryGlyph category={c} size={26} color={sel ? cfg.dark : '#A3A0B8'} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className="label">{isRest ? 'Duração planeada' : 'Foco antes da pausa'}</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setFocus(f => Math.max(5, f - 5))} className="btn btn-ghost h-11 w-11 p-0 text-body" aria-label="Menos 5 minutos">
              <MinusIcon size={18} />
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-black text-ink">{focus}</span>
              <span className="ml-1 font-bold text-muted">min</span>
            </div>
            <button type="button" onClick={() => setFocus(f => Math.min(180, f + 5))} className="btn btn-ghost h-11 w-11 p-0 text-body" aria-label="Mais 5 minutos">
              <PlusIcon size={18} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {presets.map(p => (
              <button
                type="button"
                key={p}
                onClick={() => setFocus(p)}
                className={`chip flex-1 justify-center ${focus === p ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}
              >
                {p}m
              </button>
            ))}
          </div>
          {!isRest && (
            <p className="mt-2 text-xs font-semibold text-muted">
              O cronómetro conta todo o tempo que trabalhas. Ao fim deste bloco, recebes um alerta para descansar.
            </p>
          )}
        </div>

        <div>
          <span className="label">Prioridade</span>
          <div className="flex gap-2">
            {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(p => {
              const sel = p === priority
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className="chip flex-1 justify-center"
                  style={sel ? { borderColor: PRIORITY_CONFIG[p].color, color: PRIORITY_CONFIG[p].color } : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_CONFIG[p].color }} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-deadline">Prazo (opcional)</label>
          <div className="flex gap-2">
            <input
              id="t-deadline"
              type="datetime-local"
              className="input"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
            {deadline && (
              <button type="button" onClick={() => setDeadline('')} className="btn btn-ghost px-3 text-body" aria-label="Remover prazo">
                <XIcon size={18} />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-desc">Notas</label>
          <textarea
            id="t-desc"
            className="input min-h-20 resize-none"
            placeholder="Detalhes, links, passos…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="t-check">Checklist</label>
          {checklist.length > 0 && (
            <ul className="mb-2 space-y-1">
              {checklist.map(c => (
                <li key={c.id} className="flex items-center gap-2 rounded-xl bg-snow px-3 py-2">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={() => setChecklist(l => l.map(x => (x.id === c.id ? { ...x, done: !x.done } : x)))}
                    className="h-4 w-4 accent-brand"
                    aria-label={c.text}
                  />
                  <span className={`flex-1 text-sm font-bold ${c.done ? 'text-muted line-through' : 'text-ink'}`}>{c.text}</span>
                  <button type="button" onClick={() => setChecklist(l => l.filter(x => x.id !== c.id))} className="text-muted hover:text-danger cursor-pointer" aria-label="Remover passo">
                    <XIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              id="t-check"
              className="input"
              placeholder="Adicionar passo"
              value={checkInput}
              onChange={e => setCheckInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCheck()
                }
              }}
            />
            <button type="button" onClick={addCheck} className="btn btn-ghost px-4" aria-label="Adicionar passo">
              <PlusIcon size={18} />
            </button>
          </div>
        </div>

        {org && canAssign && (
          <div className="space-y-2">
            <span className="label">Entrega</span>
            <label className="flex items-center gap-3 rounded-xl border-2 border-line px-3 py-2.5 cursor-pointer">
              <ShieldCheckIcon size={20} className="text-accent" />
              <span className="flex-1">
                <span className="block font-bold text-ink">Precisa de aprovação</span>
              </span>
              <input type="checkbox" checked={approval} onChange={e => setRequiresApproval(e.target.checked)} className="h-5 w-5 accent-brand" />
            </label>
            {approval && (
              <div className="rounded-xl border-2 border-line px-3 py-2.5">
                <label className="block font-bold text-ink" htmlFor="t-reviewer">Supervisor da tarefa</label>
                <select id="t-reviewer" className="input mt-1.5" value={reviewerId} onChange={e => setReviewerId(e.target.value)}>
                  <option value="">Chefes do departamento (automático)</option>
                  {supervisors.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.id === org.me.id ? `${org.isCompany ? COMPANY_ACCOUNT_LABEL : m.name} (eu)` : m.name}
                      {m.id !== org.me.id || !org.isCompany ? ` · ${ROLE_LABEL[m.role]}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-3 rounded-xl border-2 border-line px-3 py-2.5 cursor-pointer">
              <PaperclipIcon size={20} className="text-warm" />
              <span className="flex-1">
                <span className="block font-bold text-ink">Exigir anexo</span>
              </span>
              <input type="checkbox" checked={requiresAttachment} onChange={e => setRequiresAttachment(e.target.checked)} className="h-5 w-5 accent-brand" />
            </label>
            <div className="flex items-center gap-2 pt-1">
              <RepeatIcon size={18} className="shrink-0 text-muted" aria-label="Repetir" />
              {RECURRENCES.map(r => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRecurrence(recurrence === r.id ? undefined : r.id)}
                  className={`chip flex-1 justify-center text-xs ${recurrence === r.id ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="t-tag">Etiquetas</label>
          <div className="flex gap-2">
            <input
              id="t-tag"
              className="input"
              placeholder="#projeto"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <button type="button" onClick={addTag} className="btn btn-ghost px-4">
              <PlusIcon size={18} />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTags(tags.filter(x => x !== t))}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent-light px-2 py-1 text-xs font-bold text-accent-dark cursor-pointer"
                >
                  #{t} <XIcon size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t-2 border-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        <button type="submit" disabled={!title.trim()} className={`btn w-full ${title.trim() ? 'btn-primary' : 'btn-disabled'}`}>
          {task ? 'Guardar alterações' : assigningOther ? 'Atribuir tarefa' : 'Criar tarefa'}
        </button>
      </div>
    </form>
  )
}

export default function TaskSheet() {
  const { sheet, closeTaskSheet } = useApp()

  useEffect(() => {
    if (!sheet.open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTaskSheet() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet.open, closeTaskSheet])

  if (!sheet.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6 animate-fade-in" onClick={closeTaskSheet}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="sheet-title"
        onClick={e => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-white animate-slide-up"
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <h2 id="sheet-title" className="text-xl font-black text-ink">
            {sheet.task ? 'Editar tarefa' : 'Nova tarefa'}
          </h2>
          <button onClick={closeTaskSheet} aria-label="Fechar" className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer">
            <XIcon size={24} />
          </button>
        </div>
        {/* key reinicia o formulário ao trocar de tarefa */}
        <TaskForm key={sheet.task?.id ?? 'new'} task={sheet.task} onDone={closeTaskSheet} />
      </div>
    </div>
  )
}
