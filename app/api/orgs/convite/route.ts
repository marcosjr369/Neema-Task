import { fail, handle } from '../../../lib/server/api'
import { read } from '../../../lib/server/store'

/**
 * Validar um código de convite antes do login: ?codigo=ABC123 → { name, sector }.
 * Público (ainda não há conta), por isso só devolve o nome e o sector, e limita pedidos por IP
 * para não servir para adivinhar códigos.
 */

const WINDOW = 10 * 60 * 1000
const MAX = 20
const hits = new Map<string, { count: number; since: number }>()

export const GET = handle(async req => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now - h.since > WINDOW) hits.set(ip, { count: 1, since: now })
  else if (++h.count > MAX) fail(429, 'Demasiadas tentativas. Tenta daqui a alguns minutos.')

  const code = new URL(req.url).searchParams.get('codigo')?.trim().toUpperCase().replace(/^NEEMA-/, '')
  if (!code || code.length < 4) fail(400, 'Escreve o código completo')
  const org = (await read(async l => { await l.load('orgs', { invite_code: code! }) })).orgs[0]
  if (!org) fail(404, 'Este código não existe. Confirma com a tua empresa.')
  return { name: org!.name, sector: org!.sector }
})
