import { body, fail, handle, requireAdmin } from '../../../../../lib/server/api'
import { mutate } from '../../../../../lib/server/store'
import { applyDeptInput, removeDepartment, type DeptInput } from '../../../../../lib/server/departments'
import { orgScope } from '../../../../../lib/server/scopes'
import { removeFiles } from '../../../../../lib/server/files'
import { brandImages } from '../../../../../lib/brand'

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
  const images = await mutate(orgScope(orgId), db => {
    const dept = db.departments.find(d => d.id === deptId && d.orgId === orgId) ?? fail(404, 'Departamento não encontrado')
    removeDepartment(db, dept)
    // o logótipo/fundos próprios do departamento, se a empresa ou outro departamento não os usar
    const org = db.orgs.find(o => o.id === orgId)
    const stillUsed = new Set([org?.brand, ...db.departments.filter(d => d.orgId === orgId && d.id !== dept.id).map(d => d.brand)].flatMap(brandImages))
    return brandImages(dept.brand).filter(x => !stillUsed.has(x))
  })
  if (images.length) await removeFiles(images).catch(() => undefined)
  return { ok: true }
})
