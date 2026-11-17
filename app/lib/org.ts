import type { Department, Member, Org, PresenceSegment, PresenceStatus, Role, Task } from '../types'

export const DEPT_COLORS = ['#4C7DFF', '#EC5BA6', '#12B5A6', '#FF8A3D', '#7B61FF', '#FFC53D', '#4CC9F0', '#F2545B']

export const SECTORS = [
  'Tecnologia',
  'Banca e Seguros',
  'Comércio',
  'Construção',
  'Educação',
  'Saúde',
  'Indústria',
  'Logística',
  'Serviços',
  'Sector público',
  'Outro',
]

export const ORG_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']

export const canManageRole = (role?: Role) => role === 'admin' || role === 'supervisor'

/**
 * A conta que criou a empresa é a conta da própria empresa: administra tudo, mas não é
 * uma pessoa da equipa (sem cronómetro, presença, XP nem lugar no ranking).
 */
export const isCompanyAccount = (m: Member | undefined, org: Pick<Org, 'createdBy'> | undefined) =>
  !!m?.userId && !!org && m.userId === org.createdBy

export const teamMembers = (members: Member[], org: Pick<Org, 'createdBy'> | undefined) =>
  members.filter(m => !isCompanyAccount(m, org))

/** Já saiu da empresa: o registo fica só para o histórico (não entra em listas, atribuições nem convites) */
export const isFormer = (m: Pick<Member, 'status'> | undefined) => m?.status === 'saiu'

export const canSuperviseTask = (m: Member, org: Pick<Org, 'createdBy'> | undefined) =>
  m.status === 'activo' && (canManageRole(m.role) || isCompanyAccount(m, org))

export const canReviewTask = (task: Task, me: Member, managesAssignee: boolean) =>
  task.reviewerId ? task.reviewerId === me.id || me.role === 'admin' : managesAssignee

/** Um dia de trabalho aberto há mais do que isto (esqueceu-se de terminar) já não conta */
export const WORKDAY_MS = 16 * 60 * 60 * 1000

export const isWorking = (workStart: number | undefined | null, now = Date.now()) => !!workStart && now - workStart < WORKDAY_MS

export function managedDepartmentIds(departments: Department[], me: Member): Set<string> | 'all' {
  if (me.role === 'admin') return 'all'
  const ids = new Set<string>()
  if (me.role !== 'supervisor') return ids
  departments.forEach(d => { if (d.supervisorIds.includes(me.id)) ids.add(d.id) })
  if (me.departmentId) ids.add(me.departmentId)
  return ids
}

export function assignableMembers(members: Member[], departments: Department[], me: Member) {
  const scope = managedDepartmentIds(departments, me)
  return members.filter(
    m => m.id === me.id || scope === 'all' || (!!m.departmentId && scope.has(m.departmentId)),
  )
}

export function presenceTotals(segments: PresenceSegment[], from: number, to: number, now = Date.now()) {
  const totals: Partial<Record<PresenceStatus, number>> = {}
  for (const s of segments) {
    const start = Math.max(s.start, from)
    const end = Math.min(s.end ?? now, to)
    if (end <= start) continue
    totals[s.status] = (totals[s.status] ?? 0) + (end - start) / 1000
  }
  return totals
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      row.push(cell.trim())
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

export const groupKey = (t: Pick<Task, 'id' | 'groupId' | 'occurrence'>) => (t.groupId ? `${t.groupId}:${t.occurrence ?? 0}` : t.id)

export const groupSiblings = (tasks: Task[], t: Task) => (t.groupId ? tasks.filter(x => groupKey(x) === groupKey(t)) : [t])
