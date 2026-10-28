import crypto from 'crypto'
import { cookies } from 'next/headers'
import { fail } from './api'

/**
 * Acesso ao painel de administração (/marcos/faz). As credenciais vivem só no servidor
 * (ADMIN_PANEL_EMAIL + ADMIN_PANEL_PASSWORD); depois de as acertar, o browser recebe um cookie
 * httpOnly assinado com ADMIN_SESSION_SECRET + credenciais (mudar qualquer um termina as sessões).
 * As acções sensíveis (desactivar, eliminar) voltam a pedir só a palavra-passe.
 */

export const PANEL_COOKIE = 'mt_panel'
export const PANEL_TTL = 12 * 60 * 60 * 1000

export const panelEmail = () => process.env.ADMIN_PANEL_EMAIL?.trim().toLowerCase() ?? ''

function signingKey(): Buffer | null {
  const password = process.env.ADMIN_PANEL_PASSWORD
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!password || !secret || !panelEmail()) return null
  return crypto.createHash('sha256').update(`${secret}\0${panelEmail()}\0${password}`).digest()
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest()

/** Compara em tempo constante (não revela quantos caracteres acertou) */
export function checkPassword(input: string) {
  const password = process.env.ADMIN_PANEL_PASSWORD
  if (!password || !signingKey()) return false
  return crypto.timingSafeEqual(sha(input), sha(password))
}

/** Email e palavra-passe do login (verifica sempre os dois, para não revelar qual falhou) */
export function checkCredentials(email: string, password: string) {
  const emailOk = crypto.timingSafeEqual(sha(email.trim().toLowerCase()), sha(panelEmail()))
  const passwordOk = checkPassword(password)
  return emailOk && passwordOk && !!panelEmail()
}

export function createToken(now = Date.now()) {
  const key = signingKey()
  if (!key) fail(503, 'Painel não configurado')
  const exp = String(now + PANEL_TTL)
  return `${exp}.${crypto.createHmac('sha256', key!).update(exp).digest('hex')}`
}

function validToken(token: string | undefined) {
  const key = signingKey()
  if (!key || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const expected = crypto.createHmac('sha256', key).update(exp).digest('hex')
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

export async function hasPanelSession() {
  return validToken((await cookies()).get(PANEL_COOKIE)?.value)
}

export async function requirePanel() {
  if (!(await hasPanelSession())) fail(401, 'Sessão do painel expirada')
}

// ─── Limite de tentativas (por IP, em memória da instância) ─────────────────

const MAX_ATTEMPTS = 5
const WINDOW = 15 * 60 * 1000
const attempts = new Map<string, { count: number; since: number }>()

export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
}

/** Minutos que faltam para poder tentar outra vez (0 = pode tentar) */
export function lockedFor(ip: string, now = Date.now()) {
  const a = attempts.get(ip)
  if (!a || now - a.since > WINDOW) return 0
  return a.count >= MAX_ATTEMPTS ? Math.ceil((a.since + WINDOW - now) / 60000) : 0
}

export function recordFailure(ip: string, now = Date.now()) {
  const a = attempts.get(ip)
  if (!a || now - a.since > WINDOW) attempts.set(ip, { count: 1, since: now })
  else a.count++
}

export const clearFailures = (ip: string) => attempts.delete(ip)

/** Verifica com limite de tentativas por IP e uma pequena espera a cada falha */
async function guarded(req: Request, ok: boolean, message: string) {
  const ip = clientIp(req)
  const wait = lockedFor(ip)
  if (wait) fail(429, `Demasiadas tentativas. Tenta daqui a ${wait} min.`)
  if (!ok) {
    recordFailure(ip)
    // torna inútil tentar muitas combinações seguidas
    await new Promise(r => setTimeout(r, 600))
    fail(401, message)
  }
  clearFailures(ip)
}

/** Login do painel: email + palavra-passe */
export const confirmLogin = (req: Request, email: string | undefined, password: string | undefined) =>
  guarded(req, !!email && !!password && checkCredentials(email, password), 'Email ou palavra-passe errados')

/** Confirmação de acções sensíveis: volta a pedir a palavra-passe (com o mesmo limite de tentativas) */
export const confirmPassword = (req: Request, password: string | undefined) =>
  guarded(req, !!password && checkPassword(password), 'Palavra-passe errada')
