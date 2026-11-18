import { body, fail, handle, requireAdmin } from '../../../../lib/server/api'
import { mutate, newId } from '../../../../lib/server/store'
import { applyDeptInput, type DeptInput } from '../../../../lib/server/departments'
import { DEPT_COLORS } from '../../../../lib/org'
import { orgScope } from '../../../../lib/server/scopes'
import type { Department } from '../../../../types'

export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requireAdmin(orgId)
  const input = await body<DeptInput>(req)
  if (!input.name?.trim()) fail(400, 'Indica o nome do departamento')
  return mutate(orgScope(orgId), db => {
    const count = db.departments.filter(d => d.orgId === orgId).length
    const dept: Department = { id: newId(), orgId, name: '', color: DEPT_COLORS[count % DEPT_COLORS.length], supervisorIds: [] }
    db.departments.push(dept)
    applyDeptInput(db, dept, input)
    return { department: dept }
  })
})
