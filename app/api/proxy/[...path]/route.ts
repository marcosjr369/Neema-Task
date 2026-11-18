import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { matchRoute } from '../../../lib/server/routes'

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
/* os anexos têm no máximo 15 MB; um pouco de folga para o resto do formulário */
const MAX_BODY = 16 * 1024 * 1024

const WINDOW_MS = 60 * 1000
const LIMIT_READ = 300
const LIMIT_WRITE = 120
const g = globalThis as unknown as { __neemaRate?: Map<string, { start: number; read: number; write: number }> }
const hits = (g.__neemaRate ??= new Map())

function limited(key: string, write: boolean) {
  const now = Date.now()
  let h = hits.get(key)
  if (!h || now - h.start >= WINDOW_MS) {
    h = { start: now, read: 0, write: 0 }
    hits.set(key, h)
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start >= WINDOW_MS) hits.delete(k)
  }
  if (write) h.write++
  else h.read++
  return write ? h.write > LIMIT_WRITE : h.read > LIMIT_READ
}

const clientIp = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconhecido'

function crossSite(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return true
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

const error = (status: number, message: string, headers?: HeadersInit) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const method = req.method.toUpperCase()
  if (!METHODS.has(method)) return error(405, 'Método não permitido')

  const { path } = await params
  const route = matchRoute(path)
  if (!route) return error(404, 'Não encontrado')

  const write = method !== 'GET'
  if (write && crossSite(req)) return error(403, 'Pedido recusado')
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return error(413, 'Pedido demasiado grande')

  const { userId } = await auth().catch(() => ({ userId: null }))
  if (limited(userId ? `u:${userId}` : `ip:${clientIp(req)}`, write)) {
    return error(429, 'Demasiados pedidos. Espera um pouco e tenta outra vez.', { 'Retry-After': '60' })
  }

  const mod = await route.load()
  const fn = mod[method as keyof typeof mod]
  if (!fn) return error(405, 'Método não permitido')

  let res: Response
  try {
    res = await fn(req, { params: Promise.resolve(route.params) })
  } catch (err) {
    console.error('[proxy]', method, path.join('/'), err)
    return error(500, 'Algo correu mal do nosso lado. Tenta outra vez dentro de momentos.')
  }

  const headers = new Headers(res.headers)
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new NextResponse(res.body, { status: res.status, statusText: res.statusText, headers })
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }
