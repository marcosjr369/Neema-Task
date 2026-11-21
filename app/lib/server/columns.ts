import type { Condition, Table } from './store'

/**
 * Colunas de cada tabela usadas para filtrar (o resto do objecto vai inteiro em "data").
 * Partilhadas pelo Postgres e pela store em ficheiro: assim os dois filtram exactamente da
 * mesma maneira e o que funciona em desenvolvimento funciona em produção.
 */

type Row = Record<string, unknown>

export const COLUMNS: Record<Table, (r: Row) => Record<string, string | number | null>> = {
  users: r => ({ id: r.id as string, clerk_id: (r.clerkId as string) ?? null, email: (r.email as string) ?? null }),
  orgs: r => ({ id: r.id as string, invite_code: r.inviteCode as string, domain: (r.domain as string) ?? null }),
  departments: r => ({ id: r.id as string, org_id: r.orgId as string }),
  members: r => ({ id: r.id as string, org_id: r.orgId as string, user_id: (r.userId as string) ?? null, email: (r.email as string) ?? null }),
  tasks: r => ({ id: r.id as string, org_id: (r.orgId as string) ?? null, owner_id: (r.ownerId as string) ?? null, assignee_id: (r.assigneeId as string) ?? null }),
  sessions: r => ({ id: r.id as string, task_id: r.taskId as string, user_id: (r.userId as string) ?? null, member_id: (r.memberId as string) ?? null, start_at: r.start as number }),
  presence: r => ({ id: r.id as string, org_id: r.orgId as string, member_id: r.memberId as string, start_at: r.start as number, end_at: (r.end as number) ?? null }),
  push: r => ({ id: r.endpoint as string, user_id: r.userId as string }),
  events: r => ({ id: r.id as string, org_id: (r.orgId as string) ?? null, owner_id: (r.ownerId as string) ?? null, start_at: r.start as number }),
  deleted: r => ({ id: r.id as string, deleted_at: r.deletedAt as number }),
  boards: r => shareable(r),
  sheets: r => shareable(r),
  diagrams: r => shareable(r),
  grants: r => ({ id: r.id as string, resource_id: r.resourceId as string, email: (r.email as string) ?? null, user_id: (r.userId as string) ?? null }),
  plays: r => ({ id: r.id as string, user_id: r.userId as string, org_id: (r.orgId as string) ?? null, start_at: r.start as number }),
  polls: r => shareable(r),
  responses: r => ({ id: r.id as string, poll_id: r.pollId as string, voter: (r.voter as string) ?? null }),
}

function shareable(r: Row) {
  return {
    id: r.id as string,
    org_id: (r.orgId as string) ?? null,
    owner_id: r.ownerId as string,
    token: (r.sharing as { token?: string } | undefined)?.token ?? null,
  }
}

export const keyOf = (table: Table, r: Row) => (table === 'push' ? (r.endpoint as string) : (r.id as string))

/** O mesmo que o "where" do Postgres: igual, "= any(lista)", "is null" e intervalos */
export function matches(table: Table, row: Row, where: Record<string, Condition> = {}) {
  const cols = COLUMNS[table](row)
  for (const [col, cond] of Object.entries(where)) {
    const v = cols[col] ?? null
    if (cond === null) { if (v !== null) return false; continue }
    if (v === null) return false
    if (Array.isArray(cond)) { if (!cond.map(String).includes(String(v))) return false; continue }
    if (typeof cond === 'object') {
      const n = Number(v)
      if (cond.gte !== undefined && !(n >= cond.gte)) return false
      if (cond.lte !== undefined && !(n <= cond.lte)) return false
      continue
    }
    if (String(v) !== String(cond)) return false
  }
  return true
}
