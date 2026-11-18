import { body, fail, handle, requireAdmin } from '../../../../../lib/server/api'
import { mutate } from '../../../../../lib/server/store'
import { applyDeptInput, removeDepartment, type DeptInput } from '../../../../../lib/server/departments'
import { orgScope } from '../../../../../lib/server/scopes'

export const PATCH = handle<{ orgId: string; deptId: string }>(async (req, { orgId, deptId }) => {
  await requireAdmin(orgId)
  const input = await body<DeptInput>(req)
  return mutate(orgScope(orgId), db => {
    const dept = db.departments.find(d => d.id === deptId && d.orgId === orgId) ?? fail(404, 'Departamento não encontrado')
    applyDeptInput(db, dept, input)
    return { department: dept }
  })
})

export const DELETE = handle<{ orgId: string; deptId: string }>(async (_req, { orgId, deptId }) => {
  await requireAdmin(orgId)
  return mutate(orgScope(orgId), db => {
    const dept = db.departments.find(d => d.id === deptId && d.orgId === orgId) ?? fail(404, 'Departamento não encontrado')
    removeDepartment(db, dept)
  })
})
