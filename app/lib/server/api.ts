import type { Member, Org, Task, User } from '../../types'
import { managedDepartmentIds } from '../org'
import { currentUser } from './auth'
import { read, type DB } from './store'
import { orgScope, type OrgOpts } from './scopes'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message)
}

type Ctx<P> = { params: Promise<P> }

/** Envolve um route handler: converte HttpError em respostas JSON */
export function handle<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const result = await fn(req, await ctx.params)
      return result instanceof Response ? result : Response.json(result ?? { ok: true })
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status })
      console.error(err)
      return Response.json({ error: 'Erro interno' }, { status: 500 })
    }
  }
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return fail(400, 'Pedido inválido')
  }
}

export async function requireUser(): Promise<User> {
  return (await currentUser()) ?? fail(401, 'Sessão expirada. Entra novamente.')
}

export type OrgAccess = { db: DB; user: User; org: Org; me: Member }

/** Membro activo da empresa; "opts" diz que dados extra carregar (tarefas, sessões, presença) */
export async function requireMember(orgId: string, opts: OrgOpts = {}): Promise<OrgAccess> {
  const user = await requireUser()
  const db = await read(orgScope(orgId, opts))
  const org = db.orgs.find(o => o.id === orgId) ?? fail(404, 'Empresa não encontrada')
  const me =
    db.members.find(m => m.orgId === orgId && m.userId === user.id && m.status === 'activo') ??
    fail(403, 'Não pertences a esta empresa')
  return { db, user, org, me }
}

export async function requireAdmin(orgId: string, opts: OrgOpts = {}) {
  const access = await requireMember(orgId, opts)
  if (access.me.role !== 'admin') fail(403, 'Só administradores podem fazer isto')
  return access
}

/** Departamentos que o membro gere ('all' para administradores) */
export function managedDepartments(db: DB, me: Member): Set<string> | 'all' {
  return managedDepartmentIds(db.departments.filter(d => d.orgId === me.orgId), me)
}

export function canManage(db: DB, me: Member, target: Member | undefined) {
  if (!target || target.orgId !== me.orgId) return false
  const scope = managedDepartments(db, me)
  if (scope === 'all') return true
  return target.id !== me.id && !!target.departmentId && scope.has(target.departmentId)
}

export const isManager = (me: Member) => me.role === 'admin' || me.role === 'supervisor'

/** O membro pode ver/editar a tarefa? */
export function taskAccess(db: DB, me: Member, task: Task) {
  const assignee = db.members.find(m => m.id === task.assigneeId)
  const owner = task.assigneeId === me.id
  const creator = task.createdBy === me.id
  const manager = canManage(db, me, assignee) || (creator && isManager(me))
  return { view: owner || creator || manager, owner, manager }
}
