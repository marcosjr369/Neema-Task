import { fail, handle } from '../../../lib/server/api'
import { panelData, requirePanel } from '../../../lib/server/panel'
import { panelRanking, type RankKind } from '../../../lib/server/panelRanking'
import type { RankMetric } from '../../../types'

export const GET = handle(async req => {
  await requirePanel()
  const url = new URL(req.url)
  const kind = url.searchParams.get('tipo') as RankKind
  if (!['empresas', 'pessoais', 'funcionarios'].includes(kind)) fail(400, 'Tipo de ranking inválido')
  const orgId = url.searchParams.get('org') ?? undefined
  if (kind === 'funcionarios' && !orgId) fail(400, 'Escolhe a empresa')
  const metric = (url.searchParams.get('metric') as RankMetric) || 'points'
  const from = Number(url.searchParams.get('from')) || 0
  return { entries: panelRanking(await panelData(), kind, metric, from, orgId) }
})
