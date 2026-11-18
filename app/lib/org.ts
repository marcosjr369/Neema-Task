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

/**
 * Pode aprovar/devolver a tarefa. "managesAssignee": gere o responsável ou criou a tarefa
 * (sendo supervisor/admin). O responsável nunca aprova a própria tarefa, mesmo que a tenha
 * criado: aí a aprovação vem de um administrador ou de outro supervisor.
 */
export function canReviewTask(task: Pick<Task, 'assigneeId' | 'reviewerId'>, me: Member, managesAssignee: boolean) {
  if (task.assigneeId === me.id) return false
  return task.reviewerId ? task.reviewerId === me.id || me.role === 'admin' : managesAssignee
}

/** "me" gere esta pessoa (admin: todos; supervisor: os dos seus departamentos, menos ele próprio) */
export const managesMember = (scope: Set<string> | 'all', me: Member, m: Member | undefined) =>
  !!m && (scope === 'all' || (m.id !== me.id && !!m.departmentId && scope.has(m.departmentId)))

/** Um dia de trabalho aberto há mais do que isto (esqueceu-se de terminar) já não conta */
export const WORKDAY_MS = 16 * 60 * 60 * 1000

export const isWorking = (workStart: number | undefined | null, now = Date.now()) => !!workStart && now - workStart < WORKDAY_MS

/* ─── Estrutura da empresa (árvore de departamentos) ─── */

/** Chefe do departamento (o primeiro da chefia); os restantes são adjuntos */
export const deptHeadId = (d: Pick<Department, 'supervisorIds'>) => d.supervisorIds[0] as string | undefined
export const deptDeputyIds = (d: Pick<Department, 'supervisorIds'>) => d.supervisorIds.slice(1)

/** O departamento superior, se existir (um pai apagado ou de outra empresa conta como topo) */
export function parentOf(departments: Department[], d: Department): Department | undefined {
  return d.parentId && d.parentId !== d.id ? departments.find(x => x.id === d.parentId) : undefined
}

/** Subdepartamentos directos (parentId vazio: os do topo, logo abaixo da empresa) */
export function childDepartments(departments: Department[], parentId?: string) {
  const ids = new Set(departments.map(d => d.id))
  return departments.filter(d => (parentId ? d.parentId === parentId && d.id !== parentId : !d.parentId || !ids.has(d.parentId) || d.parentId === d.id))
}

/** O departamento e todos os que estão abaixo dele (à prova de ciclos) */
export function descendantIds(departments: Department[], id: string): Set<string> {
  const out = new Set<string>([id])
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()!
    for (const d of departments) {
      if (d.parentId === cur && !out.has(d.id)) {
        out.add(d.id)
        queue.push(d.id)
      }
    }
  }
  return out
}

/** Caminho desde o topo até ao departamento (inclusive) */
export function departmentPath(departments: Department[], id: string | undefined): Department[] {
  const path: Department[] = []
  const seen = new Set<string>()
  let cur = id ? departments.find(d => d.id === id) : undefined
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    cur = parentOf(departments, cur)
  }
  return path
}

/** Pode ficar debaixo de "parentId" sem criar um ciclo (não pode ser ele próprio nem um descendente) */
export const canMoveUnder = (departments: Department[], id: string, parentId: string | undefined) =>
  !parentId || !descendantIds(departments, id).has(parentId)

/** Todos os departamentos pela ordem da árvore, com a profundidade (para listas e selects) */
export function departmentTree(departments: Department[]): { dept: Department; depth: number }[] {
  const out: { dept: Department; depth: number }[] = []
  const seen = new Set<string>()
  const walk = (parentId: string | undefined, depth: number) => {
    for (const d of childDepartments(departments, parentId)) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      out.push({ dept: d, depth })
      walk(d.id, depth + 1)
    }
  }
  walk(undefined, 0)
  // ciclos antigos (não deviam existir): ficam no fim, para não desaparecerem
  departments.forEach(d => { if (!seen.has(d.id)) out.push({ dept: d, depth: 0 }) })
  return out
}

/** Nome para selects: indentado pela profundidade na árvore */
export const indentedName = (name: string, depth: number) => `${'   '.repeat(depth)}${depth ? '└ ' : ''}${name}`

/**
 * Departamentos geridos por "me". Admin: todos. Supervisor: o seu departamento e os que chefia
 * (como chefe ou adjunto), incluindo todos os subdepartamentos destes.
 */
export function managedDepartmentIds(departments: Department[], me: Member): Set<string> | 'all' {
  if (me.role === 'admin') return 'all'
  const ids = new Set<string>()
  if (me.role !== 'supervisor') return ids
  departments.forEach(d => {
    if (d.supervisorIds.includes(me.id)) descendantIds(departments, d.id).forEach(id => ids.add(id))
  })
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
