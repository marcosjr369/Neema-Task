import { body, fail, handle, managedDepartments, requireMember } from '../../../../lib/server/api'
import { removeFiles } from '../../../../lib/server/files'
import { orgScope } from '../../../../lib/server/scopes'
import { mutate } from '../../../../lib/server/store'
import { BrandError, brandImages, cleanBrand } from '../../../../lib/brand'
import type { BrandTheme } from '../../../../types'

/**
 * Aparência da empresa (cores, logótipo, letra, fundos).
 * PATCH { brand } muda a da empresa (só administradores);
 * PATCH { departmentId, brand } muda a de um departamento (administradores e as chefias desse departamento).
 * brand: null volta às cores da Udacha (empresa) ou ao que vem da empresa (departamento).
 */
export const PATCH = handle<{ orgId: string }>(async (req, { orgId }) => {
  const input = await body<{ departmentId?: string; brand?: BrandTheme | null }>(req)
  const { user } = await requireMember(orgId)
  let brand: BrandTheme | undefined
  try {
    brand = input.brand === null || input.brand === undefined ? undefined : cleanBrand(input.brand, !input.departmentId)
  } catch (err) {
    if (err instanceof BrandError) fail(400, err.message)
    throw err
  }

  // só imagens enviadas para esta empresa
  if (brand && brandImages(brand).some(id => !id.startsWith(`brand-${orgId}-`))) fail(400, 'Imagem inválida')

  const result = await mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId) ?? fail(404, 'Empresa não encontrada')
    const me = db.members.find(m => m.orgId === orgId && m.userId === user.id && m.status === 'activo') ?? fail(403, 'Não pertences a esta empresa')
    const used = () => [org.brand, ...db.departments.filter(d => d.orgId === orgId).map(d => d.brand)].flatMap(brandImages)
    const before = used()
    const stamp = brand ? { ...brand, updatedAt: Date.now(), updatedBy: user.id } : undefined

    if (input.departmentId) {
      const dept = db.departments.find(d => d.id === input.departmentId && d.orgId === orgId) ?? fail(404, 'Departamento não encontrado')
      const scope = managedDepartments(db, me)
      if (scope !== 'all' && !scope.has(dept.id)) fail(403, 'Só podes mudar a aparência dos departamentos que geres')
      dept.brand = stamp
    } else {
      if (me.role !== 'admin') fail(403, 'Só os administradores mudam a aparência de toda a empresa')
      org.brand = stamp
    }
    const after = new Set(used())
    return { org, departments: db.departments.filter(d => d.orgId === orgId), unused: before.filter(x => !after.has(x)) }
  })
  // logótipos e fundos que deixaram de ser usados
  if (result.unused.length) await removeFiles(result.unused).catch(() => undefined)
  return { brand: result.org.brand, departments: result.departments.map(d => ({ id: d.id, brand: d.brand })) }
})
