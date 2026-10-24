import { body, fail, handle, requireMember } from '../../../../../lib/server/api'
import { mutate, type DB } from '../../../../../lib/server/store'
import type { Role } from '../../../../../types'
import { orgScope } from '../../../../../lib/server/scopes'

type Patch = { name?: string; jobTitle?: string; phone?: string; departmentId?: string | null; role?: Role }

const activeAdmins = (db: DB, orgId: string) =>
  db.members.filter(x => x.orgId === orgId && x.role === 'admin' && x.status === 'activo').length

export const PATCH = handle<{ orgId: string; memberId: string }>(async (req, { orgId, memberId }) => {
  const { me } = await requireMember(orgId)
  const patch = await body<Patch>(req)
  if (me.role !== 'admin' && me.id !== memberId) fail(403, 'Só administradores podem editar funcionários')

  return mutate(orgScope(orgId), db => {
    const m = db.members.find(x => x.id === memberId && x.orgId === orgId) ?? fail(404, 'Funcionário não encontrado')
    if (patch.name?.trim()) m.name = patch.name.trim().slice(0, 80)
    if (patch.jobTitle !== undefined) m.jobTitle = patch.jobTitle.trim().slice(0, 60) || undefined
    if (patch.phone !== undefined) m.phone = patch.phone.trim().slice(0, 30) || undefined

    if (me.role === 'admin') {
      if (patch.departmentId !== undefined) {
        const dept = patch.departmentId ? db.departments.find(d => d.id === patch.departmentId && d.orgId === orgId) : undefined
        if (patch.departmentId && !dept) fail(400, 'Departamento inválido')
        m.departmentId = dept?.id
      }
      if (patch.role && patch.role !== m.role) {
        if (m.role === 'admin' && activeAdmins(db, orgId) <= 1) fail(400, 'A empresa precisa de pelo menos um administrador')
        m.role = patch.role
      }
      // um supervisor gere o seu departamento; quem deixa de o ser sai das listas
      db.departments.forEach(d => {
        if (d.orgId !== orgId) return
        if (m.role !== 'supervisor') d.supervisorIds = d.supervisorIds.filter(id => id !== m.id)
        else if (d.id === m.departmentId && !d.supervisorIds.includes(m.id)) d.supervisorIds.push(m.id)
      })
    }
    return { member: m }
  })
})

/** Remover funcionário (admin) ou sair da empresa (o próprio) */
export const DELETE = handle<{ orgId: string; memberId: string }>(async (_req, { orgId, memberId }) => {
  const { me } = await requireMember(orgId)
  if (me.role !== 'admin' && me.id !== memberId) fail(403, 'Sem permissão')
  return mutate(orgScope(orgId, { presence: 'open' }), db => {
    const m = db.members.find(x => x.id === memberId && x.orgId === orgId) ?? fail(404, 'Funcionário não encontrado')
    if (m.role === 'admin' && activeAdmins(db, orgId) <= 1) fail(400, 'Não podes remover o único administrador')
    db.members = db.members.filter(x => x.id !== m.id)
    db.departments.forEach(d => { d.supervisorIds = d.supervisorIds.filter(id => id !== m.id) })
    const open = db.presence.find(p => p.memberId === m.id && p.end === null)
    if (open) open.end = Date.now()
  })
})
