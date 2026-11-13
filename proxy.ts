import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Corre antes de cada pedido.
 *
 * - Clerk em todos os pedidos: torna a sessão disponível em auth()/currentUser(). Não bloqueia
 *   páginas; cada rota da API verifica o utilizador (requireUser/requireMember) e a app manda
 *   para /entrar quem não tem sessão.
 * - API: a única porta pública é o proxy (/api/proxy/..., em app/api/proxy/[...path]). As rotas
 *   internas (/api/me, /api/orgs/..., ...) só são alcançáveis através dele; o acesso directo dá 404.
 *   Excepção: /api/cron/..., chamado por agendadores externos e protegido pelo CRON_SECRET.
 */
const PUBLIC_API = ['/api/proxy/', '/api/cron/']

export default clerkMiddleware(async (_auth, req) => {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/api/') && !PUBLIC_API.some(p => pathname.startsWith(p))) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
})

export const config = {
  matcher: [
    // tudo menos ficheiros estáticos e internos do Next (inclui o service worker /sw.js)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
