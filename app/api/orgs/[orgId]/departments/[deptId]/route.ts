import { body, fail, handle, requireAdmin } from '../../../../../lib/server/api'
import { mutate } from '../../../../../lib/server/store'
import { syncSupervisors } from '../../../../../lib/server/org'
import { orgScope } from '../../../../../lib/server/scopes'

export const PATCH = handle<{ orgId: string; deptId: string }>(async (req, { orgId, deptId }) => {
  await requireAdmin(orgId)
  const patch = await body<{ name?: string; color?: string; supervisorIds?: string[] }>(req)
  return mutate(orgScope(orgId), db => {
    const dept = db.departments.find(d => d.id === deptId && d.orgId === orgId) ?? fail(404, 'Departamento não encontrado')
    if (patch.name?.trim()) dept.name = patch.name.trim().slice(0, 60)
    if (patch.color) dept.color = patch.color
    if (patch.supervisorIds) syncSupervisors(db, dept, patch.supervisorIds)
    return { department: dept }
  })
})

export const DELETE = handle<{ orgId: string; deptId: string }>(async (_req, { orgId, deptId }) => {
  await requireAdmin(orgId)
  return mutate(orgScope(orgId), db => {
    db.departments = db.departments.filter(d => !(d.id === deptId && d.orgId === orgId))
    db.members.forEach(m => { if (m.departmentId === deptId) m.departmentId = undefined })
  })
})
