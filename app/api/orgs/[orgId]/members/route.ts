import { body, fail, handle, requireAdmin } from '../../../../lib/server/api'
import { mutate, newId } from '../../../../lib/server/store'
import { DEPT_COLORS } from '../../../../lib/org'
import type { Member, Role } from '../../../../types'
import { orgScope, scopes } from '../../../../lib/server/scopes'

type Row = { name?: string; email?: string; jobTitle?: string; phone?: string; department?: string; departmentId?: string; role?: Role }

const ROLES: Role[] = ['admin', 'supervisor', 'membro']

/** Adicionar funcionários: um (formulário) ou vários (importação CSV) */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requireAdmin(orgId)
  const { members } = await body<{ members: Row[] }>(req)
  if (!Array.isArray(members) || members.length === 0) fail(400, 'Nenhum funcionário para adicionar')
  if (members.length > 1000) fail(400, 'Máximo de 1000 por importação')

  const emails = members.map(r => r.email?.trim().toLowerCase()).filter((e): e is string => !!e)
  return mutate(scopes(orgScope(orgId), async l => l.load('users', { email: emails })), db => {
    const added: Member[] = []
    const skipped: { email: string; reason: string }[] = []
    const deptByName = new Map(
      db.departments.filter(d => d.orgId === orgId).map(d => [d.name.trim().toLowerCase(), d]),
    )

    for (const row of members) {
      const email = row.email?.trim().toLowerCase() ?? ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped.push({ email: row.email ?? '', reason: 'Email inválido' })
        continue
      }
      if (db.members.some(m => m.orgId === orgId && m.email === email)) {
        skipped.push({ email, reason: 'Já existe' })
        continue
      }

      let departmentId = db.departments.find(d => d.id === row.departmentId && d.orgId === orgId)?.id
      const deptName = row.department?.trim()
      if (!departmentId && deptName) {
        let dept = deptByName.get(deptName.toLowerCase())
        if (!dept) {
          dept = { id: newId(), orgId, name: deptName.slice(0, 60), color: DEPT_COLORS[deptByName.size % DEPT_COLORS.length], supervisorIds: [] }
          db.departments.push(dept)
          deptByName.set(deptName.toLowerCase(), dept)
        }
        departmentId = dept.id
      }

      // se a pessoa já tem conta, fica logo activa
      const user = db.users.find(u => u.email === email && u.emailVerified !== false)
      const role: Role = row.role && ROLES.includes(row.role) ? row.role : 'membro'
      const member: Member = {
        id: newId(),
        orgId,
        userId: user?.id,
        email,
        name: row.name?.trim().slice(0, 80) || user?.name || email.split('@')[0],
        picture: user?.picture,
        jobTitle: row.jobTitle?.trim().slice(0, 60) || undefined,
        phone: row.phone?.trim().slice(0, 30) || undefined,
        departmentId,
        role,
        status: user ? 'activo' : 'pendente',
        joinedAt: user ? Date.now() : undefined,
        presence: 'offline',
      }
      if (role === 'supervisor' && departmentId) {
        db.departments.find(d => d.id === departmentId)?.supervisorIds.push(member.id)
      }
      db.members.push(member)
      added.push(member)
    }
    return { added, skipped }
  })
})
