import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { currentUser } from '../../../lib/server/auth'
import { publicView } from '../../../lib/server/boards'
import { publicSheetView } from '../../../lib/server/sheets'
import { accessOf, byToken, KIND, NOUN, peopleOf, resourceByToken, type SharedTable } from '../../../lib/server/shared'
import { accessKey, checkPassword, grantOf, passwordAttempt, validKey } from '../../../lib/server/sharing'
import { sendToUser } from '../../../lib/server/push'
import { mutate, newId, read, type DB } from '../../../lib/server/store'
import type { Board, Sheet, User } from '../../../types'

/**
 * Entrada pelo link de partilha (/p/<token>) de um quadro ou de uma planilha. Não exige sessão.
 * Respostas (campo "status"):
 * - member: tens acesso com a tua conta → abre na app ("path");
 * - ok: vês só para leitura (link público ou senha certa);
 * - password: pede senha;
 * - private: só com convite (podes pedir acesso, se tiveres sessão).
 */

const MAX_PENDING = 50
const TABLES: SharedTable[] = ['boards', 'sheets']
const NOT_FOUND = 'Este link não existe ou foi desactivado'

const optionalUser = () => currentUser().catch(() => null) as Promise<User | null>

/** Procura o token nos quadros e depois nas planilhas */
async function find(token: string, load: (table: SharedTable) => Promise<DB>) {
  for (const table of TABLES) {
    const db = await load(table)
    const r = byToken(db, table, token)
    if (r) return { table, db, r }
  }
  return fail(404, NOT_FOUND)
}

export const GET = handle<{ token: string }>(async (req, { token }) => {
  const user = await optionalUser()
  const { table, db, r } = await find(token, t => read(resourceByToken(t, token)))
  const kind = KIND[table]
  if (accessOf(db, r, user)) return { status: 'member', kind, path: `${NOUN[table].path}/${r.id}` }

  const s = r.sharing
  const open = !r.orgId && (s.visibility === 'link' || (s.visibility === 'private' && validKey(r.id, s.password, req.headers.get('x-share-key'))))
  if (open) {
    if (table === 'sheets') return { status: 'ok', kind, sheet: publicSheetView(r as Sheet), signedIn: !!user }
    const board = r as Board
    const people = peopleOf(db, board).filter(p => board.cards.some(c => c.memberIds.includes(p.userId)))
    return { status: 'ok', kind, board: publicView(board), people, signedIn: !!user }
  }
  const pending = grantOf(db.grants, r.id, user)?.role === 'pending'
  if (!r.orgId && s.visibility === 'private' && s.password) return { status: 'password', kind, signedIn: !!user, requested: pending }
  return { status: 'private', kind, signedIn: !!user, requested: pending }
})

/** { password } → chave de acesso; { request: true } → pede acesso ao dono (precisa de sessão) */
export const POST = handle<{ token: string }>(async (req, { token }) => {
  const input = await body<{ password?: string; request?: boolean }>(req)

  if (input.request) {
    const user = await requireUser()
    const { table } = await find(token, t => read(async l => { await l.load(t, { token }) }))
    const result = await mutate(resourceByToken(table, token), db => {
      const r = byToken(db, table, token) ?? fail(404, NOT_FOUND)
      if (accessOf(db, r, user)) return { status: 'member' as const, path: `${NOUN[table].path}/${r.id}` }
      if (grantOf(db.grants, r.id, user)) return { status: 'requested' as const }
      if (db.grants.filter(g => g.resourceId === r.id && g.role === 'pending').length >= MAX_PENDING) {
        fail(429, `${NOUN[table].this[0].toUpperCase()}${NOUN[table].this.slice(1)} tem demasiados pedidos por responder`)
      }
      db.grants.push({ id: newId(), resourceId: r.id, kind: KIND[table], email: user.email, userId: user.id, name: user.name, role: 'pending', createdAt: Date.now() })
      return { status: 'requested' as const, ownerId: r.ownerId, title: r.title, path: `${NOUN[table].path}/${r.id}` }
    })
    if ('ownerId' in result && result.ownerId) {
      sendToUser(result.ownerId, {
        title: 'Pedido de acesso',
        body: `${user.name} pediu acesso a "${result.title}"`,
        url: `${result.path}?partilha=1`,
        tag: `req-${token}`,
      }).catch(() => undefined)
      return { status: 'requested' }
    }
    return result
  }

  const { r } = await find(token, t => read(async l => { await l.load(t, { token }) }))
  const p = r.sharing.password
  if (r.orgId || r.sharing.visibility !== 'private' || !p) fail(400, 'Este link não usa senha')
  passwordAttempt(req, r.id)
  if (!checkPassword(String(input.password ?? ''), p!)) fail(403, 'Senha errada')
  return { key: accessKey(r.id, p!) }
})
