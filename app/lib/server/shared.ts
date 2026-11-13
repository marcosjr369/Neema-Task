import type { Access, BoardPerson, Board, ShareKind, Sheet, User } from '../../types'
import { fail } from './api'
import { resolveAccess } from './sharing'
import type { DB, Loader } from './store'

/**
 * Recursos partilháveis (quadros e planilhas): o mesmo carregamento, as mesmas regras de acesso
 * e a mesma lista de pessoas. Cada tipo vive na sua tabela, com o link (token) numa coluna própria.
 */

export type SharedTable = 'boards' | 'sheets'
export type SharedResource = Board | Sheet

export const KIND: Record<SharedTable, ShareKind> = { boards: 'board', sheets: 'sheet' }
export const NOUN: Record<SharedTable, { one: string; the: string; this: string; path: string }> = {
  boards: { one: 'quadro', the: 'o quadro', this: 'este quadro', path: '/quadros' },
  sheets: { one: 'planilha', the: 'a planilha', this: 'esta planilha', path: '/planilhas' },
}

const list = (db: DB, table: SharedTable) => db[table] as SharedResource[]

/** Carrega os convites, a equipa (recursos da empresa) e as contas das pessoas com acesso, em paralelo */
async function loadRelated(l: Loader, table: SharedTable) {
  const r = list(l.db, table)[0]
  if (!r) return
  await Promise.all([
    l.load('grants', { resource_id: r.id }),
    r.orgId ? l.load('orgs', { id: r.orgId }) : undefined,
    r.orgId ? l.load('members', { org_id: r.orgId }) : undefined,
    l.load('users', { id: r.ownerId }),
  ])
  await l.load('users', { email: l.db.grants.filter(g => g.role !== 'pending').map(g => g.email) })
}

export const resourceScope = (table: SharedTable, id: string) => async (l: Loader) => {
  await l.load(table, { id })
  await loadRelated(l, table)
}

export const resourceByToken = (table: SharedTable, token: string) => async (l: Loader) => {
  await l.load(table, { token })
  await loadRelated(l, table)
}

export function findResource(db: DB, table: SharedTable, id: string) {
  return list(db, table).find(r => r.id === id) ?? fail(404, `${NOUN[table].one[0].toUpperCase()}${NOUN[table].one.slice(1)} não encontrad${table === 'boards' ? 'o' : 'a'}`)
}

export const byToken = (db: DB, table: SharedTable, token: string) => list(db, table).find(r => r.sharing.token === token)

export function accessOf(db: DB, r: SharedResource, user: User | null): Access | null {
  const member = user && r.orgId ? db.members.find(m => m.orgId === r.orgId && m.userId === user.id) : undefined
  return resolveAccess(r, user, { member, grants: db.grants })
}

/** Pessoas com acesso (para juntar a cartões e mostrar no cabeçalho) */
export function peopleOf(db: DB, r: SharedResource): BoardPerson[] {
  const out = new Map<string, BoardPerson>()
  const add = (p: BoardPerson) => { if (!out.has(p.userId)) out.set(p.userId, p) }
  const owner = db.users.find(u => u.id === r.ownerId)
  if (owner) add({ userId: owner.id, name: owner.name, picture: owner.picture })
  if (r.orgId) {
    const org = db.orgs.find(o => o.id === r.orgId)
    for (const m of db.members) {
      // a conta da empresa não é uma pessoa da equipa
      if (m.orgId !== r.orgId || m.status !== 'activo' || !m.userId || m.userId === org?.createdBy) continue
      if (r.sharing.visibility === 'org' || m.role === 'admin') add({ userId: m.userId, name: m.name, picture: m.picture })
    }
  }
  for (const g of db.grants) {
    if (g.resourceId !== r.id || g.role === 'pending') continue
    const u = db.users.find(x => x.id === g.userId || x.email === g.email)
    if (u) add({ userId: u.id, name: u.name, picture: u.picture })
  }
  return [...out.values()]
}

/** Os recursos de um tipo a que o utilizador tem acesso (os seus, os da empresa e os partilhados) */
export async function loadMine(user: User, table: SharedTable, l: Loader) {
  await Promise.all([
    l.load('members', { user_id: user.id }),
    l.load(table, { owner_id: user.id }),
    l.load('grants', { user_id: user.id }),
    user.emailVerified !== false ? l.load('grants', { email: user.email }) : undefined,
  ])
  const orgIds = l.db.members.filter(m => m.status === 'activo').map(m => m.orgId)
  await Promise.all([
    l.load('orgs', { id: orgIds }),
    l.load(table, { org_id: orgIds }),
    l.load(table, { id: l.db.grants.filter(g => g.kind === KIND[table]).map(g => g.resourceId) }),
  ])
  await l.load('users', { id: [...new Set(list(l.db, table).map(r => r.ownerId))] })
}

export function summaryBase(db: DB, r: SharedResource, user: User, access: Access) {
  return {
    id: r.id,
    title: r.title,
    orgId: r.orgId,
    orgName: db.orgs.find(o => o.id === r.orgId)?.name,
    ownerName: db.users.find(u => u.id === r.ownerId)?.name,
    mine: r.ownerId === user.id,
    access,
    visibility: r.sharing.visibility,
    updatedAt: r.updatedAt,
  }
}
