import { body, fail, handle, requireUser } from './api'
import { accessOf, findResource, KIND, NOUN, resourceScope, type SharedResource, type SharedTable } from './shared'
import { cleanEmail, grantOf, hashPassword, isRole, shareToken, sharingInfo } from './sharing'
import { sendToUser } from './push'
import { mutate, newId, read, type DB } from './store'
import type { ShareRole, ShareVisibility, User } from '../../types'

/**
 * Rotas de partilha de um recurso (…/<id>/share):
 * GET estado · PATCH visibilidade/senha/link · POST convidar ou mudar papel · DELETE retirar ou sair.
 */

const MAX_GRANTS = 100

/** param: nome do parâmetro do id na pasta da rota (ex.: [boardId]) */
export function shareRoutes(table: SharedTable, param = 'id') {
  const noun = NOUN[table]
  type P = Record<string, string>

  function asOwner(db: DB, id: string, user: User) {
    const r = findResource(db, table, id)
    if (accessOf(db, r, user) !== 'owner') fail(403, `Só o dono d${noun.the.slice(0, 1)} ${noun.one} gere a partilha`)
    return r
  }

  function state(db: DB, r: SharedResource) {
    const org = r.orgId ? db.orgs.find(o => o.id === r.orgId) : undefined
    return {
      sharing: sharingInfo(r.sharing),
      grants: db.grants
        .filter(g => g.resourceId === r.id)
        .sort((a, z) => a.createdAt - z.createdAt)
        .map(g => {
          const u = db.users.find(x => x.id === g.userId || x.email === g.email)
          return { id: g.id, email: g.email, role: g.role, name: u?.name ?? g.name, picture: u?.picture, createdAt: g.createdAt }
        }),
      // sugestões ao convidar, nos recursos da empresa
      members: r.orgId
        ? db.members
            .filter(m => m.orgId === r.orgId && m.status === 'activo' && m.userId && m.userId !== org?.createdBy && m.userId !== r.ownerId)
            .map(m => ({ email: m.email, name: m.name }))
        : [],
    }
  }

  const GET = handle<P>(async (_req, params) => {
    const id = params[param]
    const user = await requireUser()
    const db = await read(resourceScope(table, id))
    return state(db, asOwner(db, id, user))
  })

  const PATCH = handle<P>(async (req, params) => {
    const id = params[param]
    const user = await requireUser()
    const input = await body<{ visibility?: ShareVisibility; orgRole?: ShareRole; password?: string | null; resetLink?: boolean }>(req)
    return mutate(resourceScope(table, id), db => {
      const r = asOwner(db, id, user)
      const s = r.sharing
      if (input.visibility !== undefined) {
        const allowed: ShareVisibility[] = r.orgId ? ['org', 'private'] : ['link', 'private']
        if (!allowed.includes(input.visibility)) fail(400, 'Visibilidade inválida')
        s.visibility = input.visibility
      }
      if (input.orgRole !== undefined) {
        if (!r.orgId || !isRole(input.orgRole)) fail(400, 'Pedido inválido')
        s.orgRole = input.orgRole
      }
      if (input.password !== undefined) {
        if (r.orgId) fail(400, 'Os recursos da empresa não usam senha')
        s.password = input.password === null || input.password === '' ? undefined : hashPassword(String(input.password))
      }
      // o link antigo deixa de funcionar
      if (input.resetLink) s.token = shareToken()
      r.updatedAt = Date.now()
      return state(db, r)
    })
  })

  const POST = handle<P>(async (req, params) => {
    const id = params[param]
    const user = await requireUser()
    const input = await body<{ email?: string; grantId?: string; role?: ShareRole }>(req)
    if (!isRole(input.role)) fail(400, 'Escolhe "ver" ou "editar"')
    const role = input.role as ShareRole
    const email = input.grantId ? undefined : cleanEmail(input.email)

    const result = await mutate(
      async l => {
        await resourceScope(table, id)(l)
        if (email) await l.load('users', { email })
      },
      db => {
        const r = asOwner(db, id, user)
        const mine = db.grants.filter(g => g.resourceId === r.id)
        let grant = input.grantId ? mine.find(g => g.id === input.grantId) ?? fail(404, 'Convite não encontrado') : mine.find(g => g.email === email)
        const wasNew = !grant || grant.role === 'pending'
        if (!grant) {
          const owner = db.users.find(u => u.id === r.ownerId)
          if (email === owner?.email) fail(400, `Essa pessoa já é a dona d${noun.the.slice(0, 1)} ${noun.one}`)
          if (mine.length >= MAX_GRANTS) fail(400, `Podes partilhar com no máximo ${MAX_GRANTS} pessoas`)
          grant = { id: newId(), resourceId: r.id, kind: KIND[table], email: email!, role, createdAt: Date.now(), invitedBy: user.id }
          db.grants.push(grant)
        }
        grant.role = role
        const target = db.users.find(u => u.id === grant!.userId || u.email === grant!.email)
        if (target) grant.userId ??= target.id
        if (wasNew && grant.userId !== user.id) grant.unseen = true
        return { state: state(db, r), notify: wasNew ? target?.id : undefined, title: r.title }
      },
    )
    if (result.notify && result.notify !== user.id) {
      sendToUser(result.notify, {
        title: `Partilharam ${noun.a} contigo`,
        body: `${user.name} deu-te acesso a "${result.title}"`,
        url: `${noun.path}/${id}`,
        tag: `${KIND[table]}-${id}`,
      }).catch(() => undefined)
    }
    return result.state
  })

  const DELETE = handle<P>(async (req, params) => {
    const id = params[param]
    const user = await requireUser()
    const grantId = new URL(req.url).searchParams.get('grantId')
    return mutate(resourceScope(table, id), db => {
      const r = findResource(db, table, id)
      const grant = grantId
        ? db.grants.find(g => g.id === grantId && g.resourceId === r.id) ?? fail(404, 'Convite não encontrado')
        : grantOf(db.grants, r.id, user) ?? fail(404, `Não tens convite n${noun.this}`)
      const self = grantOf(db.grants, r.id, user)?.id === grant.id
      if (!self && accessOf(db, r, user) !== 'owner') fail(403, `Só o dono d${noun.the.slice(0, 1)} ${noun.one} gere a partilha`)
      db.grants = db.grants.filter(g => g.id !== grant.id)
      return self && accessOf(db, r, user) !== 'owner' ? { left: true } : state(db, r)
    })
  })

  return { GET, PATCH, POST, DELETE }
}
