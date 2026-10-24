'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ArrowUUpLeftIcon, ArrowsOutIcon, CalendarBlankIcon, CaretLeftIcon, ChatCircleIcon, CheckIcon, DownloadSimpleIcon, EyeIcon, FileTextIcon, HourglassMediumIcon, PaperPlaneRightIcon, PaperclipIcon, PauseIcon, PencilSimpleIcon, PlayIcon, RepeatIcon, SealCheckIcon, ShieldCheckIcon, StopIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { useTaskActions } from '../../context/useTaskActions'
import ProgressRing from '../../components/ui/ProgressRing'
import Mascot from '../../components/ui/Mascot'
import Avatar from '../../components/ui/Avatar'
import { ReviewBadge } from '../../components/tasks/ReviewBadge'
import { fileUrl } from '../../lib/api'
import { taskPoints } from '../../lib/points'
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_LABEL, type Attachment, type Task, type TaskStatus } from '../../types'
import { formatClock, formatDeadline, formatDuration, phaseElapsed, startOfDay } from '../../lib/stats'
import { CategoryGlyph } from '../../components/ui/icons'

const RECURRENCE_LABEL = { diaria: 'Repete todos os dias', semanal: 'Repete todas as semanas', mensal: 'Repete todos os meses' }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

const canPreview = (a: Attachment) => /^(image\/|application\/pdf|text\/plain)/.test(a.type)

/** Aprovação, anexos e comentários (só tarefas de empresa) */
function OrgPanel({ task, isOwner }: { task: Task; isOwner: boolean }) {
  const org = useOrg()!
  const actions = useTaskActions()
  const fileInput = useRef<HTMLInputElement>(null)
  const [comment, setComment] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const assignee = org.memberById(task.assigneeId)
  const creator = org.memberById(task.createdBy)
  // mesmas regras do servidor (taskAccess): gere o responsável ou criou a tarefa sendo supervisor
  const scope = org.scope
  const managesAssignee =
    !!assignee && (scope === 'all' || (assignee.id !== org.me.id && !!assignee.departmentId && scope.has(assignee.departmentId)))
  const isManager = managesAssignee || (task.createdBy === org.me.id && org.isManager)
  const pending = task.status === 'done' && task.review?.status === 'pending'
  const approved = task.review?.status === 'approved'
  const canUpload = (isOwner || isManager) && !approved
  const comments = [...(task.comments ?? [])].sort((a, b) => a.at - b.at)

  return (
    <>
      {/* Quem e como */}
      <section className="card divide-y-2 divide-line">
        <div className="flex items-center gap-3 p-3">
          <Avatar name={assignee?.name ?? '?'} picture={assignee?.picture} size={36} presence={assignee?.presence} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold uppercase text-muted">Responsável</span>
            <span className="block truncate font-bold text-ink">{assignee ? (assignee.id === org.me.id ? 'Eu' : assignee.name) : 'Removido'}</span>
          </span>
          {creator && creator.id !== assignee?.id && (
            <span className="min-w-0 text-right">
              <span className="block text-xs font-extrabold uppercase text-muted">Atribuída por</span>
              <span className="block truncate text-sm font-bold text-body">{creator.id === org.me.id ? 'Mim' : creator.name}</span>
            </span>
          )}
        </div>
        {(task.requiresApproval || task.requiresAttachment || task.recurrence) && (
          <div className="flex flex-wrap gap-2 p-3 text-xs font-bold">
            {task.requiresApproval && <span className="flex items-center gap-1 rounded-lg bg-accent-light px-2 py-1 text-accent-dark"><ShieldCheckIcon size={14} /> Precisa de aprovação</span>}
            {task.requiresAttachment && <span className="flex items-center gap-1 rounded-lg bg-warm-light px-2 py-1 text-warm-dark"><PaperclipIcon size={14} /> Exige anexo</span>}
            {task.recurrence && <span className="flex items-center gap-1 rounded-lg bg-brand-light px-2 py-1 text-brand-dark"><RepeatIcon size={14} /> {RECURRENCE_LABEL[task.recurrence]}</span>}
          </div>
        )}
      </section>

      {/* Estado da revisão */}
      {pending && (
        <section className="card border-warm/50 bg-warm-light p-4">
          <p className="flex items-center gap-2 font-black text-warm-dark"><HourglassMediumIcon size={20} weight="duotone" /> À espera de aprovação</p>
          <p className="text-sm font-semibold text-body">
            {isManager ? 'Revê o trabalho e os anexos antes de aprovar.' : 'O supervisor vai rever. Recebes um aviso quando houver resposta.'}
          </p>
          {isManager && (
            <div className="mt-3 space-y-2">
              {rejecting && (
                <textarea
                  className="input min-h-20 resize-none bg-white"
                  placeholder="O que falta corrigir? (obrigatório)"
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  autoFocus
                />
              )}
              <div className="flex gap-2">
                {rejecting ? (
                  <>
                    <button onClick={() => setRejecting(false)} className="btn btn-ghost px-4 text-body" aria-label="Cancelar"><XIcon size={18} /></button>
                    <button
                      disabled={actions.busy || !reviewNote.trim()}
                      onClick={async () => {
                        if (await actions.reject(task.id, reviewNote.trim())) {
                          setRejecting(false)
                          setReviewNote('')
                        }
                      }}
                      className={`btn flex-1 ${reviewNote.trim() ? 'btn-danger' : 'btn-disabled'}`}
                    >
                      <ArrowUUpLeftIcon size={18} /> Devolver
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setRejecting(true)} className="btn btn-ghost flex-1 text-danger">
                      <ArrowUUpLeftIcon size={18} /> Devolver
                    </button>
                    <button disabled={actions.busy} onClick={() => actions.approve(task.id)} className="btn btn-accent flex-1">
                      <CheckIcon size={18} /> Aprovar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}
      {task.review?.status === 'rejected' && task.status !== 'done' && (
        <section className="card border-danger/40 bg-danger-light p-4">
          <p className="flex items-center gap-2 font-black text-danger-dark"><ArrowUUpLeftIcon size={20} /> Devolvida para correcção</p>
          {task.review.comment && <p className="mt-1 whitespace-pre-wrap font-semibold text-body">“{task.review.comment}”</p>}
          {isOwner && <p className="mt-1 text-xs font-bold text-muted">Corrige e volta a marcar como concluída para reenviar.</p>}
        </section>
      )}
      {approved && (
        <section className="card border-accent/40 bg-accent-light p-4">
          <p className="flex items-center gap-2 font-black text-accent-dark"><SealCheckIcon size={20} weight="fill" /> Aprovada {task.review?.at ? `em ${new Date(task.review.at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}` : ''}</p>
          <p className="text-sm font-semibold text-body">+{Math.max(0, taskPoints(task))} XP{task.review?.rejections === 0 ? ' · aprovada à primeira' : ''}</p>
        </section>
      )}

      {/* Anexos */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="label mb-0">Anexos {task.attachments?.length ? `(${task.attachments.length})` : ''}</h2>
          {canUpload && (
            <>
              <button onClick={() => fileInput.current?.click()} disabled={actions.busy} className="text-sm font-extrabold uppercase tracking-wide text-accent cursor-pointer">
                {actions.busy ? 'A enviar…' : '+ Anexar'}
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={async e => {
                  const files = [...(e.target.files ?? [])]
                  e.target.value = ''
                  for (const f of files) await actions.upload(task.id, f)
                }}
              />
            </>
          )}
        </div>
        {task.attachments?.length ? (
          <ul className="card divide-y-2 divide-line">
            {task.attachments.map(a => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-snow text-muted">
                  {a.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura de um ficheiro protegido
                    <img src={fileUrl(org.base, task.id, a.id, true)} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <FileTextIcon size={20} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{a.name}</span>
                  <span className="block text-xs font-semibold text-muted">
                    {formatSize(a.size)} · {org.memberById(a.uploadedBy)?.name ?? '—'} · {new Date(a.uploadedAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                {canPreview(a) && (
                  <a href={fileUrl(org.base, task.id, a.id, true)} target="_blank" rel="noopener" className="rounded-lg p-2 text-muted hover:bg-snow" aria-label={`Ver ${a.name}`}>
                    <EyeIcon size={18} />
                  </a>
                )}
                <a href={fileUrl(org.base, task.id, a.id)} className="rounded-lg p-2 text-muted hover:bg-snow" aria-label={`Descarregar ${a.name}`}>
                  <DownloadSimpleIcon size={18} />
                </a>
                {!approved && (a.uploadedBy === org.me.id || isManager) && (
                  <button
                    onClick={() => confirm(`Remover ${a.name}?`) && actions.removeAttachment(task.id, a.id)}
                    className="rounded-lg p-2 text-muted hover:bg-danger-light hover:text-danger cursor-pointer"
                    aria-label={`Remover ${a.name}`}
                  >
                    <TrashIcon size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <button
            onClick={() => canUpload && fileInput.current?.click()}
            className={`w-full rounded-2xl border-2 border-dashed p-5 text-center text-sm font-bold ${
              task.requiresAttachment ? 'border-warm text-warm-dark' : 'border-line text-muted'
            } ${canUpload ? 'cursor-pointer hover:bg-snow' : 'cursor-default'}`}
          >
            <PaperclipIcon size={22} className="mx-auto mb-1" />
            {canUpload
              ? task.requiresAttachment ? 'Anexa um comprovativo para poder concluir' : 'Anexa documentos, fotos ou ficheiros que comprovem o trabalho'
              : 'Sem anexos'}
          </button>
        )}
      </section>

      {/* Comentários */}
      <section>
        <h2 className="label flex items-center gap-1.5"><ChatCircleIcon size={14} /> Comentários</h2>
        <div className="card">
          {comments.length > 0 && (
            <ul className="space-y-3 p-3">
              {comments.map(c => {
                const author = org.memberById(c.authorId)
                const tone = c.kind === 'approved' ? 'text-accent-dark' : c.kind === 'rejected' ? 'text-danger' : c.kind === 'submitted' ? 'text-warm-dark' : ''
                return (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar name={c.authorName} picture={author?.picture} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-muted">
                        <span className="text-ink">{c.authorId === org.me.id ? 'Eu' : c.authorName}</span> ·{' '}
                        {new Date(c.at).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className={`whitespace-pre-wrap text-sm font-semibold text-body ${tone}`}>
                        {c.kind === 'approved' ? 'Aprovou · ' : c.kind === 'rejected' ? 'Devolveu · ' : ''}
                        {c.text}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <form
            onSubmit={async e => {
              e.preventDefault()
              if (!comment.trim()) return
              if (await actions.comment(task.id, comment.trim())) setComment('')
            }}
            className={`flex gap-2 p-2 ${comments.length ? 'border-t-2 border-line' : ''}`}
          >
            <input className="input py-2" placeholder="Escreve um comentário…" value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} />
            <button type="submit" disabled={!comment.trim() || actions.busy} className="btn btn-primary px-4" aria-label="Enviar comentário">
              <PaperPlaneRightIcon size={18} />
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    tasks, allSessions, timer, now,
    startTimer, pauseTimer, resumeTimer, stopTimer, setStatus, deleteTask, openTaskSheet, updateTask,
  } = useApp()
  const org = useOrg()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const task = tasks.find(t => t.id === id) ?? org?.teamTasks.find(t => t.id === id)
  if (!task) {
    return (
      <div className="flex flex-col items-center px-6 py-20 text-center">
        <Mascot size={100} mood="sleepy" />
        <p className="mt-4 text-xl font-black text-ink">Tarefa não encontrada</p>
        <Link href="/tarefas" className="btn btn-accent mt-6">Ver tarefas</Link>
      </div>
    )
  }

  const isOwner = !org || task.assigneeId === org.me.id
  const isEditor = !org || task.createdBy === org.me.id || org.isManager
  const approved = task.review?.status === 'approved'
  const cat = CATEGORY_CONFIG[task.category]
  const sessions = allSessions.filter(s => s.taskId === task.id)
  const total = sessions.reduce((a, s) => a + s.seconds, 0)
  const todaySecs = sessions.filter(s => s.start >= startOfDay(now)).reduce((a, s) => a + s.seconds, 0)
  const avg = sessions.length ? total / sessions.length : 0
  const isActive = timer?.taskId === task.id
  const paused = isActive && !timer.segmentStart
  const isBreak = isActive && timer.phase === 'break'
  const phaseSecs = isActive ? phaseElapsed(timer, now) : 0
  const ringProgress = isActive
    ? isBreak ? phaseSecs / timer.breakSeconds : phaseSecs / timer.blockSeconds
    : 0
  const deadline = task.deadline ? formatDeadline(task.deadline, now) : null
  const done = task.status === 'done'
  const checklist = task.checklist ?? []
  const checkDone = checklist.filter(c => c.done).length

  // Sessões agrupadas por dia (mais recentes primeiro)
  const history = [...sessions].sort((a, b) => b.start - a.start).slice(0, 20)

  return (
    <div>
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b-2 border-line bg-white/95 px-2 py-2 backdrop-blur">
        <button onClick={() => router.back()} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Voltar">
          <CaretLeftIcon size={28} />
        </button>
        <span className="flex-1 text-sm font-extrabold uppercase tracking-wider" style={{ color: cat.dark }}>
          <span className="inline-flex items-center gap-1.5"><CategoryGlyph category={task.category} size={18} color="currentColor" /> {cat.label}</span>
        </span>
        {isEditor && !approved && (
          <button onClick={() => openTaskSheet(task)} className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer" aria-label="Editar">
            <PencilSimpleIcon size={22} />
          </button>
        )}
        {isEditor && (
          <button onClick={() => setConfirmDelete(true)} className="rounded-xl p-2 text-muted hover:bg-danger-light hover:text-danger cursor-pointer" aria-label="Apagar">
            <TrashIcon size={22} />
          </button>
        )}
      </header>

      <div className="space-y-5 px-4 pb-6 pt-5">
        <div>
          <h1 className={`text-2xl font-black ${done ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
            <ReviewBadge task={task} />
            <span className="rounded-lg px-2 py-1" style={{ background: `${PRIORITY_CONFIG[task.priority].color}22`, color: PRIORITY_CONFIG[task.priority].color === '#FFC53D' ? '#A87A00' : PRIORITY_CONFIG[task.priority].color }}>
              Prioridade {PRIORITY_CONFIG[task.priority].label.toLowerCase()}
            </span>
            {deadline && (
              <span className={`flex items-center gap-1 rounded-lg px-2 py-1 ${deadline.late && !done ? 'bg-danger-light text-danger' : 'bg-snow text-body'}`}>
                <CalendarBlankIcon size={12} /> {deadline.text}
              </span>
            )}
            {task.tags.map(t => (
              <span key={t} className="rounded-lg bg-accent-light px-2 py-1 text-accent-dark">#{t}</span>
            ))}
          </div>
          {task.description && <p className="mt-3 whitespace-pre-wrap font-semibold text-body">{task.description}</p>}
        </div>

        {org && <OrgPanel task={task} isOwner={isOwner} />}

        {/* Checklist */}
        {checklist.length > 0 && (
          <section>
            <h2 className="label">Checklist · {checkDone}/{checklist.length}</h2>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(checkDone / checklist.length) * 100}%` }} />
            </div>
            <ul className="card divide-y-2 divide-line">
              {checklist.map(c => (
                <li key={c.id}>
                  <label className={`flex items-center gap-3 px-4 py-3 ${approved || !(isOwner || isEditor) ? '' : 'cursor-pointer hover:bg-snow'}`}>
                    <input
                      type="checkbox"
                      checked={c.done}
                      disabled={approved || !(isOwner || isEditor)}
                      onChange={() => updateTask(task.id, { checklist: checklist.map(x => (x.id === c.id ? { ...x, done: !x.done } : x)) })}
                      className="h-5 w-5 accent-brand"
                    />
                    <span className={`flex-1 font-bold ${c.done ? 'text-muted line-through' : 'text-ink'}`}>{c.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cronómetro: só para o responsável */}
        {isOwner && (
          <section className="card flex flex-col items-center border-b-4 p-5" style={isActive ? { borderColor: isBreak ? '#12B5A6' : cat.color } : undefined}>
            <ProgressRing size={190} stroke={14} progress={ringProgress} color={isBreak ? '#12B5A6' : cat.color} track={isActive ? (isBreak ? '#DCF7F3' : cat.light) : '#E9E7F2'}>
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
                {isActive ? (isBreak ? 'Pausa' : paused ? 'Em pausa' : 'A focar') : 'Tempo total'}
              </span>
              <span className="font-mono text-4xl font-bold tabular-nums text-ink">
                {isActive ? formatClock(isBreak ? timer.breakSeconds - phaseSecs : phaseSecs) : formatClock(total)}
              </span>
              {isActive && (
                <span className="text-xs font-bold text-muted">total {formatDuration(total)}</span>
              )}
            </ProgressRing>

            {!done && (
              <div className="mt-5 flex w-full gap-2">
                {!isActive ? (
                  <button onClick={() => startTimer(task.id)} className="btn btn-primary flex-1">
                    <PlayIcon size={18} weight="fill" /> Iniciar cronómetro
                  </button>
                ) : (
                  <>
                    <button onClick={paused ? resumeTimer : pauseTimer} className={`btn flex-1 ${paused ? 'btn-primary' : 'btn-warm'}`}>
                      {paused ? <PlayIcon size={18} weight="fill" /> : <PauseIcon size={18} weight="fill" />}
                      {paused ? 'Retomar' : 'Pausar'}
                    </button>
                    <button onClick={stopTimer} className="btn btn-ghost px-4 text-body" aria-label="Parar">
                      <StopIcon size={18} weight="fill" />
                    </button>
                    <Link href="/foco" className="btn btn-ghost px-4" aria-label="Modo foco">
                      <ArrowsOutIcon size={18} />
                    </Link>
                  </>
                )}
              </div>
            )}
            {!cat.isRest && (
              <p className="mt-3 text-center text-xs font-semibold text-muted">
                Alerta de pausa a cada {task.focusDuration} min de foco
              </p>
            )}
          </section>
        )}

        {/* Estado */}
        {isOwner && !approved && (
          <section>
            <h2 className="label">Estado</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['todo', 'doing', 'done'] as TaskStatus[]).map(s => {
                const sel = task.status === s
                const color = s === 'done' ? '#7B61FF' : s === 'doing' ? '#FF8A3D' : '#12B5A6'
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(task.id, s)}
                    className="chip justify-center py-2.5"
                    style={sel ? { borderColor: color, color, background: `${color}14` } : undefined}
                  >
                    {s === 'done' && task.requiresApproval ? (sel ? 'Enviada' : 'Enviar') : STATUS_LABEL[s]}
                  </button>
                )
              })}
            </div>
            {task.requiresApproval && !done && (
              <p className="mt-2 text-xs font-semibold text-muted">Ao concluir, a tarefa vai para revisão do supervisor.</p>
            )}
          </section>
        )}

        {/* Números */}
        {isOwner && (
          <section className="grid grid-cols-3 gap-2">
            {[
              { label: 'Hoje', value: formatDuration(todaySecs) },
              { label: 'Sessões', value: String(sessions.length) },
              { label: 'Média', value: formatDuration(avg) },
            ].map(s => (
              <div key={s.label} className="card p-3 text-center">
                <div className="text-lg font-black text-ink">{s.value}</div>
                <div className="text-xs font-bold uppercase text-muted">{s.label}</div>
              </div>
            ))}
          </section>
        )}

        {/* Histórico */}
        {isOwner && (
          <section>
            <h2 className="label">Histórico de sessões</h2>
            {history.length === 0 ? (
              <p className="card p-4 text-center text-sm font-semibold text-muted">
                Ainda sem tempo registado. Carrega em “Iniciar cronómetro”.
              </p>
            ) : (
              <ul className="card divide-y-2 divide-line">
                {history.map(s => {
                  const d = new Date(s.start)
                  return (
                    <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-bold text-body">
                        {d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}
                        <span className="ml-2 font-semibold text-muted">
                          {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(s.end).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                      <span className="font-black" style={{ color: s.id === 'live' ? cat.dark : '#2B2840' }}>
                        {s.id === 'live' ? '● ' : ''}{formatDuration(s.seconds)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6 animate-fade-in" onClick={() => setConfirmDelete(false)}>
          <div role="alertdialog" className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-ink">Apagar esta tarefa?</h2>
            <p className="mt-1 font-semibold text-muted">
              {org
                ? 'O tempo registado, os anexos e os comentários também serão apagados.'
                : `O tempo registado (${formatDuration(total)}) também será apagado das estatísticas.`}
            </p>
            <button
              onClick={() => {
                deleteTask(task.id)
                router.replace(org && !isOwner ? '/empresa?tab=tarefas' : '/tarefas')
              }}
              className="btn btn-danger mt-5 w-full"
            >
              Apagar
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost mt-3 w-full">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
