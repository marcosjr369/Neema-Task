import crypto from 'crypto'
import type { Access, Member, ShareGrant, ShareRole, Sharing, SharingInfo, User } from '../../types'
import { fail } from './api'

/**
 * Partilha de recursos (quadros; mais tarde planilhas).
 *
 * Quem tem acesso:
 * - o dono, e os administradores da empresa nos recursos da empresa;
 * - quem foi convidado (por email) com "ver" ou "editar";
 * - recursos da empresa com visibilidade "org": todos os membros activos (orgRole);
 * - sem conta: com visibilidade "link", qualquer pessoa vê; com "private" e senha, quem a souber vê.
 *   Visitantes sem conta nunca editam.
 */

type Shared = { ownerId: string; orgId?: string; sharing: Sharing }

const RANK: Record<Access, number> = { view: 1, edit: 2, owner: 3 }

export const best = (...list: (Access | null | undefined)[]): Access | null =>
  list.reduce<Access | null>((acc, a) => (a && (!acc || RANK[a] > RANK[acc]) ? a : acc), null)

export const canEdit = (a: Access | null) => a === 'edit' || a === 'owner'

export const shareToken = () => crypto.randomBytes(18).toString('base64url')

/** O email só conta se o fornecedor o confirmou (contas antigas não têm o campo: contam) */
export const emailTrusted = (user: User) => user.emailVerified !== false

export function grantOf(grants: ShareGrant[], resourceId: string, user: User | null) {
  if (!user) return undefined
  return grants.find(g => g.resourceId === resourceId && (g.userId === user.id || (emailTrusted(user) && g.email === user.email)))
}

export function resolveAccess(r: Shared & { id: string }, user: User | null, ctx: { member?: Member; grants: ShareGrant[] }): Access | null {
  if (!user || user.disabled) return null
  if (r.ownerId === user.id) return 'owner'
  const member = r.orgId && ctx.member?.orgId === r.orgId && ctx.member.status === 'activo' ? ctx.member : undefined
  if (member?.role === 'admin') return 'owner'
  const grant = grantOf(ctx.grants, r.id, user)
  const fromGrant = grant && grant.role !== 'pending' ? grant.role : null
  const fromOrg = member && r.sharing.visibility === 'org' ? (r.sharing.orgRole ?? 'edit') : null
  return best(fromGrant, fromOrg)
}

export function sharingInfo(s: Sharing, withToken = true): SharingInfo {
  return { visibility: s.visibility, orgRole: s.orgRole, token: withToken ? s.token : undefined, hasPassword: !!s.password }
}

export const isRole = (v: unknown): v is ShareRole => v === 'view' || v === 'edit'

export function cleanEmail(v: unknown) {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) fail(400, 'Email inválido')
  return email
}

/* ─── Senha ───────────────────────────────────────────────────────────── */

export function hashPassword(password: string): NonNullable<Sharing['password']> {
  if (password.length < 4) fail(400, 'A senha tem de ter pelo menos 4 caracteres')
  if (password.length > 100) fail(400, 'Senha demasiado longa')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return { salt, hash, at: Date.now() }
}

export function checkPassword(password: string, p: NonNullable<Sharing['password']>) {
  if (!password || password.length > 100) return false
  const got = crypto.scryptSync(password, p.salt, 32)
  const want = Buffer.from(p.hash, 'hex')
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

const g = globalThis as unknown as { __neemaShareSecret?: string; __neemaPwTries?: Map<string, { start: number; n: number }> }

function secret() {
  const fromEnv = process.env.SHARE_SECRET || process.env.CLERK_SECRET_KEY
  if (fromEnv) return fromEnv
  // desenvolvimento sem chaves: as chaves de acesso valem até o servidor reiniciar
  g.__neemaShareSecret ??= crypto.randomBytes(32).toString('hex')
  return g.__neemaShareSecret
}

const KEY_TTL = 12 * 3600 * 1000

const sign = (resourceId: string, p: NonNullable<Sharing['password']>, exp: number) =>
  crypto.createHmac('sha256', secret()).update(`${resourceId}.${p.hash}.${exp}`).digest('base64url')

/** Chave dada a quem acertou na senha. Mudar a senha invalida as chaves antigas. */
export function accessKey(resourceId: string, p: NonNullable<Sharing['password']>) {
  const exp = Date.now() + KEY_TTL
  return `${exp}.${sign(resourceId, p, exp)}`
}

export function validKey(resourceId: string, p: Sharing['password'], key: string | null) {
  if (!p || !key) return false
  const [expText, sig] = key.split('.')
  const exp = Number(expText)
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false
  const want = Buffer.from(sign(resourceId, p, exp))
  const got = Buffer.from(sig)
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

/** Tentativas de senha: 8 em cada 15 minutos por IP e recurso */
export function passwordAttempt(req: Request, resourceId: string) {
  const tries = (g.__neemaPwTries ??= new Map())
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '?'
  const key = `${ip}:${resourceId}`
  const now = Date.now()
  let t = tries.get(key)
  if (!t || now - t.start > 15 * 60 * 1000) {
    t = { start: now, n: 0 }
    tries.set(key, t)
    if (tries.size > 5000) for (const [k, v] of tries) if (now - v.start > 15 * 60 * 1000) tries.delete(k)
  }
  if (++t.n > 8) fail(429, 'Demasiadas tentativas. Espera alguns minutos.')
}
