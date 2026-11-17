import type { Condition, Loader, Scope } from './store'

/**
 * Âmbitos de leitura. Cada ida à base de dados custa uma viagem de rede (centenas de ms quando a
 * base de dados está longe), por isso as leituras independentes vão em paralelo, por fases:
 * só espera pela fase anterior o que precisa dos resultados dela (ex.: os ids dos membros).
 */

type UserOpts = {
  memberships?: boolean
  tasks?: boolean
  sessions?: boolean | 'all'
  push?: boolean
  domainOrgs?: boolean
}

const all = (list: (Promise<void> | false | undefined)[]) => Promise.all(list.filter(Boolean) as Promise<void>[])

export const userScope = (userId: string, opts: UserOpts = {}): Scope => async l => {
  // o utilizador (para o domínio do email) vai junto com o resto da primeira fase
  await all([l.load('users', { id: userId }), firstStage(l, userId, opts)])
  await secondStage(l, userId, opts)
}

export const clerkUserScope = (clerkId: string, opts: UserOpts = {}): Scope => async l => {
  await l.load('users', { clerk_id: clerkId })
  const user = l.db.users[0]
  if (!user) return
  await firstStage(l, user.id, opts)
  await secondStage(l, user.id, opts)
}

/** Tudo o que só precisa do id do utilizador */
async function firstStage(l: Loader, userId: string, opts: UserOpts) {
  const members = opts.memberships || opts.sessions === 'all'
  await all([
    members && l.load('members', { user_id: userId }),
    opts.tasks && l.load('tasks', { owner_id: userId }),
    opts.sessions && l.load('sessions', { user_id: userId }),
    opts.push && l.load('push', { user_id: userId }),
  ])
}

/** O que depende da primeira fase (empresas e sessões dos meus membros, empresas do meu domínio) */
async function secondStage(l: Loader, userId: string, opts: UserOpts) {
  const members = opts.memberships || opts.sessions === 'all'
  const domain = opts.domainOrgs ? l.db.users.find(u => u.id === userId)?.email.split('@')[1] : undefined
  await all([
    members && l.load('orgs', { id: l.db.members.map(m => m.orgId) }),
    opts.sessions === 'all' && l.load('sessions', { member_id: l.db.members.map(m => m.id) }),
    !!domain && l.load('orgs', { domain }),
  ])
}

export type OrgOpts = {
  /** true: todas as tarefas da empresa; 'mine': só as atribuídas a quem pede; { id }: só essa tarefa */
  tasks?: boolean | 'mine' | { id: string }
  /** 'mine': só as sessões de quem pede */
  sessions?: boolean | { since?: number; mine?: boolean }
  presence?: boolean | { since?: number } | 'open'
  /** as contas dos membros (fuso horário nos avisos): custa mais uma ida à base de dados */
  users?: boolean
}

/**
 * Os dados de uma empresa. A primeira fase (empresa, departamentos, membros e o que não depende
 * deles) vai toda em paralelo; só há segunda fase se for pedido algo que precise dos membros.
 * userId: quem pede, para as opções "mine" (pode ser uma promessa: a sessão confirma-se em paralelo).
 */
export const orgScope = (orgId: string, opts: OrgOpts = {}, userId?: string | Promise<string>): Scope => async l => {
  const presence = () => {
    if (opts.presence === 'open') return [l.load('presence', { org_id: orgId, end_at: null })]
    if (!opts.presence) return []
    const since = typeof opts.presence === 'object' ? opts.presence.since : undefined
    // segmentos que tocam o período: acabaram depois de "since" ou continuam abertos
    return [
      l.load('presence', { org_id: orgId, ...(since ? { end_at: { gte: since } } : {}) }),
      since ? l.load('presence', { org_id: orgId, end_at: null }) : undefined,
    ]
  }
  const tasks = opts.tasks
  await all([
    l.load('orgs', { id: orgId }),
    l.load('departments', { org_id: orgId }),
    l.load('members', { org_id: orgId }),
    tasks === true && l.load('tasks', { org_id: orgId }),
    typeof tasks === 'object' && l.load('tasks', { id: tasks.id }),
    ...presence(),
  ])
  const sessions = typeof opts.sessions === 'object' ? opts.sessions : opts.sessions ? {} : null
  const mine = tasks === 'mine' || !!sessions?.mine
  if (!opts.users && !sessions && !mine) return
  const uid = mine && userId ? await userId : undefined
  const meId = uid ? l.db.members.find(m => m.orgId === orgId && m.userId === uid)?.id : undefined
  const since: Record<string, Condition> = sessions?.since ? { start_at: { gte: sessions.since } } : {}
  await all([
    opts.users && l.load('users', { id: l.db.members.map(m => m.userId).filter((x): x is string => !!x) }),
    !!sessions && l.load('sessions', { member_id: sessions.mine ? (meId ? [meId] : []) : l.db.members.map(m => m.id), ...since }),
    tasks === 'mine' && !!meId && l.load('tasks', { org_id: orgId, assignee_id: meId }),
  ])
}

export const scopes = (...list: Scope[]): Scope => {
  if (list.includes('all')) return 'all'
  return async l => {
    await Promise.all(list.map(s => (s === 'all' ? undefined : Array.isArray(s) ? Promise.all(s.map(t => l.load(t))) : s(l))))
  }
}
