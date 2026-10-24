import { body, fail, handle, requireAdmin } from '../../../../lib/server/api'
import { mutate, newId } from '../../../../lib/server/store'
import { syncSupervisors } from '../../../../lib/server/org'
import { DEPT_COLORS } from '../../../../lib/org'
import { orgScope } from '../../../../lib/server/scopes'

export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requireAdmin(orgId)
  const input = await body<{ name?: string; color?: string; supervisorIds?: string[] }>(req)
  const name = input.name?.trim()
  if (!name) fail(400, 'Indica o nome do departamento')
  return mutate(orgScope(orgId), db => {
    const count = db.departments.filter(d => d.orgId === orgId).length
    const dept = {
      id: newId(),
      orgId,
      name: name!.slice(0, 60),
      color: input.color || DEPT_COLORS[count % DEPT_COLORS.length],
      supervisorIds: [] as string[],
    }
    db.departments.push(dept)
    syncSupervisors(db, dept, input.supervisorIds ?? [])
    return { department: dept }
  })
})
