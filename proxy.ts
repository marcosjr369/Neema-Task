import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Clerk em todos os pedidos: torna a sessão disponível em auth()/currentUser().
 * Não bloqueia rotas; cada rota da API verifica o utilizador (requireUser/requireMember)
 * e a app manda para /entrar quem não tem sessão.
 */
export default clerkMiddleware()

export const config = {
  matcher: [
    // tudo menos ficheiros estáticos e internos do Next (inclui o service worker /sw.js)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
