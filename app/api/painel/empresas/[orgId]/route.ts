import { fail, handle } from '../../../../lib/server/api'
import { panelData, requirePanel } from '../../../../lib/server/panel'
import { orgDetail } from '../../../../lib/server/panelDetail'
import { panelQuery } from '../../../../lib/server/panelQuery'

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requirePanel()
  const { days, tz } = panelQuery(req)
  return orgDetail(await panelData(), orgId, days, tz) ?? fail(404, 'Empresa não encontrada')
})
