import type { Department } from '../../types'
import { canMoveUnder, isCompanyAccount, isFormer } from '../org'
import { fail } from './api'
import { syncSupervisors } from './org'
import type { DB } from './store'

/** O que o formulário de departamento envia (criar e editar) */
export type DeptInput = {
  name?: string
  color?: string
  description?: string
  /** null: passa para o topo (logo abaixo da empresa) */
  parentId?: string | null
  /** chefia: o primeiro é o chefe, os restantes adjuntos */
  supervisorIds?: string[]
  /** funcionários do departamento: quem entra é transferido para aqui; quem sai fica sem departamento */
  memberIds?: string[]
}

/** Aplica os campos ao departamento (já validado o acesso de administrador) */
export function applyDeptInput(db: DB, dept: Department, input: DeptInput) {
  const orgDepts = db.departments.filter(d => d.orgId === dept.orgId)
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) fail(400, 'Indica o nome do departamento')
    dept.name = name.slice(0, 60)
  }
  if (input.color) dept.color = input.color
  if (input.description !== undefined) dept.description = input.description.trim().slice(0, 500) || undefined
  if (input.parentId !== undefined) {
    const parentId = input.parentId || undefined
    if (parentId && !orgDepts.some(d => d.id === parentId)) fail(400, 'Departamento superior inválido')
    if (!canMoveUnder(orgDepts, dept.id, parentId)) fail(400, 'Um departamento não pode ficar dentro de si próprio nem de um dos seus subdepartamentos')
    dept.parentId = parentId
  }
  if (input.supervisorIds) syncSupervisors(db, dept, input.supervisorIds)
  if (input.memberIds) {
    const org = db.orgs.find(o => o.id === dept.orgId)
    const wanted = new Set(input.memberIds)
    for (const m of db.members) {
      if (m.orgId !== dept.orgId || isFormer(m) || isCompanyAccount(m, org)) continue
      if (wanted.has(m.id)) m.departmentId = dept.id
      else if (m.departmentId === dept.id) m.departmentId = undefined
    }
  }
}

/**
 * Apagar um departamento: os subdepartamentos e os funcionários passam para o departamento
 * superior (ou para o topo / sem departamento), para não se perder nada da estrutura.
 */
export function removeDepartment(db: DB, dept: Department) {
  const parentId = dept.parentId && db.departments.some(d => d.id === dept.parentId && d.orgId === dept.orgId) ? dept.parentId : undefined
  db.departments.forEach(d => { if (d.orgId === dept.orgId && d.parentId === dept.id) d.parentId = parentId })
  db.members.forEach(m => { if (m.orgId === dept.orgId && m.departmentId === dept.id) m.departmentId = parentId })
  db.departments = db.departments.filter(d => d.id !== dept.id)
}
