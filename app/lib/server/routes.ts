/**
 * Tabela das rotas internas da API, servidas só através do proxy (/api/proxy/...).
 * Cada rota continua no seu ficheiro em app/api/.../route.ts, mas o acesso directo
 * a esses endereços é bloqueado no proxy.ts da raiz.
 *
 * Rota nova: criar o ficheiro em app/api/... e acrescentá-la aqui.
 */

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
export type RouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', Handler>>

/* eslint-disable @typescript-eslint/no-explicit-any -- cada módulo tem os seus tipos de parâmetros */
const ROUTES: [string, () => Promise<any>][] = [
  ['convites/:memberId', () => import('../../api/convites/[memberId]/route')],
  ['jogos', () => import('../../api/jogos/route')],
  ['jogos/tempo', () => import('../../api/jogos/tempo/route')],
  ['me', () => import('../../api/me/route')],
  ['me/novidades', () => import('../../api/me/novidades/route')],
  ['me/nudge', () => import('../../api/me/nudge/route')],
  ['me/timer', () => import('../../api/me/timer/route')],
  ['orgs', () => import('../../api/orgs/route')],
  ['orgs/convite', () => import('../../api/orgs/convite/route')],
  ['orgs/join', () => import('../../api/orgs/join/route')],
  ['orgs/:orgId', () => import('../../api/orgs/[orgId]/route')],
  ['orgs/:orgId/consent', () => import('../../api/orgs/[orgId]/consent/route')],
  ['orgs/:orgId/mapa', () => import('../../api/orgs/[orgId]/mapa/route')],
  ['orgs/:orgId/mapa/guia', () => import('../../api/orgs/[orgId]/mapa/guia/route')],
  ['orgs/:orgId/lugar', () => import('../../api/orgs/[orgId]/lugar/route')],
  ['orgs/:orgId/salas', () => import('../../api/orgs/[orgId]/salas/route')],
  ['orgs/:orgId/departments', () => import('../../api/orgs/[orgId]/departments/route')],
  ['orgs/:orgId/departments/:deptId', () => import('../../api/orgs/[orgId]/departments/[deptId]/route')],
  ['orgs/:orgId/equipa', () => import('../../api/orgs/[orgId]/equipa/route')],
  ['orgs/:orgId/events', () => import('../../api/orgs/[orgId]/events/route')],
  ['orgs/:orgId/events/:eventId', () => import('../../api/orgs/[orgId]/events/[eventId]/route')],
  ['orgs/:orgId/jogos', () => import('../../api/orgs/[orgId]/jogos/route')],
  ['orgs/:orgId/members', () => import('../../api/orgs/[orgId]/members/route')],
  ['orgs/:orgId/members/:memberId', () => import('../../api/orgs/[orgId]/members/[memberId]/route')],
  ['orgs/:orgId/presence', () => import('../../api/orgs/[orgId]/presence/route')],
  ['orgs/:orgId/ranking', () => import('../../api/orgs/[orgId]/ranking/route')],
  ['orgs/:orgId/sessions', () => import('../../api/orgs/[orgId]/sessions/route')],
  ['orgs/:orgId/tasks', () => import('../../api/orgs/[orgId]/tasks/route')],
  ['orgs/:orgId/tasks/:taskId', () => import('../../api/orgs/[orgId]/tasks/[taskId]/route')],
  ['orgs/:orgId/tasks/:taskId/attachments', () => import('../../api/orgs/[orgId]/tasks/[taskId]/attachments/route')],
  ['partilha/:token', () => import('../../api/partilha/[token]/route')],
  ['painel/empresas/:orgId', () => import('../../api/painel/empresas/[orgId]/route')],
  ['painel/ranking', () => import('../../api/painel/ranking/route')],
  ['painel/resumo', () => import('../../api/painel/resumo/route')],
  ['painel/sessao', () => import('../../api/painel/sessao/route')],
  ['painel/utilizadores/:userId', () => import('../../api/painel/utilizadores/[userId]/route')],
  ['personal', () => import('../../api/personal/route')],
  ['personal/events', () => import('../../api/personal/events/route')],
  ['personal/events/:eventId', () => import('../../api/personal/events/[eventId]/route')],
  ['personal/sessions', () => import('../../api/personal/sessions/route')],
  ['personal/tasks', () => import('../../api/personal/tasks/route')],
  ['personal/tasks/:taskId', () => import('../../api/personal/tasks/[taskId]/route')],
  ['push', () => import('../../api/push/route')],
  ['push/test', () => import('../../api/push/test/route')],
  ['quadros', () => import('../../api/quadros/route')],
  ['quadros/:boardId', () => import('../../api/quadros/[boardId]/route')],
  ['quadros/:boardId/ops', () => import('../../api/quadros/[boardId]/ops/route')],
  ['quadros/:boardId/share', () => import('../../api/quadros/[boardId]/share/route')],
  ['planilhas', () => import('../../api/planilhas/route')],
  ['planilhas/:id', () => import('../../api/planilhas/[id]/route')],
  ['planilhas/:id/ops', () => import('../../api/planilhas/[id]/ops/route')],
  ['planilhas/:id/share', () => import('../../api/planilhas/[id]/share/route')],
  ['diagramas', () => import('../../api/diagramas/route')],
  ['diagramas/:id', () => import('../../api/diagramas/[id]/route')],
  ['diagramas/:id/share', () => import('../../api/diagramas/[id]/share/route')],
  ['ranking', () => import('../../api/ranking/route')],
  ['ranking/empresas', () => import('../../api/ranking/empresas/route')],
]
/* eslint-enable @typescript-eslint/no-explicit-any */

const COMPILED = ROUTES.map(([pattern, load]) => ({
  parts: pattern.split('/'),
  // segmentos fixos ganham aos parâmetros (orgs/join antes de orgs/:orgId)
  score: pattern.split('/').filter(p => !p.startsWith(':')).length,
  load: load as () => Promise<RouteModule>,
}))

/** Parâmetros: só letras, números, "-" e "_" (os ids da app); evita "..", "%2F", etc. */
const SAFE_PARAM = /^[A-Za-z0-9_-]{1,128}$/

export function matchRoute(segments: string[]) {
  let best: { load: () => Promise<RouteModule>; params: Record<string, string>; score: number } | null = null
  for (const r of COMPILED) {
    if (r.parts.length !== segments.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < r.parts.length && ok; i++) {
      const p = r.parts[i]
      if (p.startsWith(':')) {
        if (SAFE_PARAM.test(segments[i])) params[p.slice(1)] = segments[i]
        else ok = false
      } else ok = p === segments[i]
    }
    if (ok && (!best || r.score > best.score)) best = { load: r.load, params, score: r.score }
  }
  return best
}
