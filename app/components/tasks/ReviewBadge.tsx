import type { Task } from '../../types'

/** Estado da aprovação de uma tarefa de empresa */
export function ReviewBadge({ task }: { task: Task }) {
  const r = task.review
  if (task.status === 'done' && r?.status === 'pending') {
    return <span className="rounded-md bg-warm-light px-1.5 py-0.5 text-[11px] font-extrabold text-warm-dark">Em revisão</span>
  }
  if (r?.status === 'approved') {
    return <span className="rounded-md bg-accent-light px-1.5 py-0.5 text-[11px] font-extrabold text-accent-dark">Aprovada</span>
  }
  if (r?.status === 'rejected' && task.status !== 'done') {
    return <span className="rounded-md bg-danger-light px-1.5 py-0.5 text-[11px] font-extrabold text-danger">Devolvida</span>
  }
  return null
}
