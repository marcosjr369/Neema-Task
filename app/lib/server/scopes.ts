import type { Loader, Scope } from './store'

/** Âmbitos de leitura reutilizados pelas rotas: carregam só o necessário */

type UserOpts = {
  memberships?: boolean
  tasks?: boolean
  /** sessões pessoais; 'all' junta as de empresa (como membro) */
  sessions?: boolean | 'all'
  push?: boolean
  /** empresas que aceitam entrada pelo domínio do email */
  domainOrgs?: boolean
}

/** Dados de um utilizador (por id interno) */
export const userScope = (userId: string, opts: UserOpts = {}): Scope => async l => {
  await l.load('users', { id: userId })
  await loadUserExtras(l, userId, opts)
}

/** Utilizador pelo id do Clerk (início de cada pedido autenticado) */
export const clerkUserScope = (clerkId: string, opts: UserOpts = {}): Scope => async l => {
  await l.load('users', { clerk_id: clerkId })
  const user = l.db.users[0]
  if (user) await loadUserExtras(l, user.id, opts)
}

async function loadUserExtras(l: Loader, userId: string, opts: UserOpts) {
  if (opts.memberships || opts.sessions === 'all') {
    await l.load('members', { user_id: userId })
    await l.load('orgs', { id: l.db.members.map(m => m.orgId) })
  }
  if (opts.tasks) await l.load('tasks', { owner_id: userId })
  if (opts.sessions) await l.load('sessions', { user_id: userId })
  if (opts.sessions === 'all') await l.load('sessions', { member_id: l.db.members.map(m => m.id) })
  if (opts.domainOrgs) {
    const domain = l.db.users.find(u => u.id === userId)?.email.split('@')[1]
    if (domain) await l.load('orgs', { domain })
  }
  if (opts.push) await l.load('push', { user_id: userId })
}

export type OrgOpts = {
  /** tarefas da empresa */
  tasks?: boolean
  /** sessões dos membros (opcionalmente desde uma data) */
  sessions?: boolean | { since?: number }
  /** segmentos de presença (desde uma data, ou só os abertos) */
  presence?: boolean | { since?: number } | 'open'
}

/** Dados de uma empresa: empresa, departamentos, membros e respectivos utilizadores */
export const orgScope = (orgId: string, opts: OrgOpts = {}): Scope => async l => {
  await l.load('orgs', { id: orgId })
  await l.load('departments', { org_id: orgId })
  await l.load('members', { org_id: orgId })
  await l.load('users', { id: l.db.members.map(m => m.userId).filter((x): x is string => !!x) })
  if (opts.tasks) await l.load('tasks', { org_id: orgId })
  if (opts.sessions) {
    const since = typeof opts.sessions === 'object' ? opts.sessions.since : undefined
    await l.load('sessions', { member_id: l.db.members.map(m => m.id), ...(since ? { start_at: { gte: since } } : {}) })
  }
  if (opts.presence === 'open') {
    await l.load('presence', { org_id: orgId, end_at: null })
  } else if (opts.presence) {
    const since = typeof opts.presence === 'object' ? opts.presence.since : undefined
    // segmentos que tocam o período: acabaram depois de "since" ou continuam abertos
    await l.load('presence', { org_id: orgId, ...(since ? { end_at: { gte: since } } : {}) })
    if (since) await l.load('presence', { org_id: orgId, end_at: null })
  }
}

/** Junta vários âmbitos num só */
export const scopes = (...list: Scope[]): Scope => {
  if (list.includes('all')) return 'all'
  return async l => {
    for (const s of list) if (s !== 'all') await s(l)
  }
}
