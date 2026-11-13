import crypto from 'crypto'
import { cookies } from 'next/headers'
import { fail } from './api'
import { read, type DB, type Table } from './store'

/**
 * Acesso ao painel de administração (/marcos/faz). As credenciais vivem só no servidor
 * (ADMIN_PANEL_EMAIL + ADMIN_PANEL_PASSWORD); depois de as acertar, o browser recebe um cookie
 * httpOnly assinado com ADMIN_SESSION_SECRET + credenciais (mudar qualquer um termina as sessões).
 * As acções sensíveis (desactivar, eliminar) voltam a pedir só a palavra-passe.
 */

export const PANEL_COOKIE = 'mt_panel'
/**
 * O browser só envia o cookie para pedidos dentro deste caminho. As rotas do painel são
 * chamadas através do proxy (/api/proxy/painel/..., ver lib/api.ts): com outro caminho o cookie
 * nunca chegava ao servidor e o painel saía logo a seguir ao login.
 */
export const PANEL_COOKIE_PATH = '/api/proxy/painel'
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

/* ─── Dados do painel ─────────────────────────────────────────────────── */

/** As tabelas que o painel usa (sem presença, quadros, planilhas, diagramas, …) */
export const PANEL_TABLES: Table[] = ['users', 'orgs', 'departments', 'members', 'tasks', 'sessions', 'deleted', 'push']

const DATA_TTL = 10 * 1000
const gp = globalThis as unknown as { __neemaPanelDb?: { at: number; db: Promise<DB> } }

/**
 * Os dados do painel, lidos num só pedido e guardados 10 s: mudar de ecrã (resumo, utilizador,
 * empresa, ranking) não volta à base de dados. Qualquer escrita limpa a memória (store.ts), por
 * isso depois de desactivar ou apagar alguém os números já vêm certos. Só leitura: não alterar.
 */
export function panelData(): Promise<DB> {
  const hit = gp.__neemaPanelDb
  if (hit && Date.now() - hit.at < DATA_TTL) return hit.db
  const db = read(PANEL_TABLES)
  gp.__neemaPanelDb = { at: Date.now(), db }
  db.catch(() => { if (gp.__neemaPanelDb?.db === db) gp.__neemaPanelDb = undefined })
  return db
}

const MAX_ATTEMPTS = 5
const WINDOW = 15 * 60 * 1000
const attempts = new Map<string, { count: number; since: number }>()

export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
}

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

export const confirmLogin = (req: Request, email: string | undefined, password: string | undefined) =>
  guarded(req, !!email && !!password && checkCredentials(email, password), 'Email ou palavra-passe errados')

export const confirmPassword = (req: Request, password: string | undefined) =>
  guarded(req, !!password && checkPassword(password), 'Palavra-passe errada')
