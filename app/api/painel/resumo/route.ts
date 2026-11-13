import { handle } from '../../../lib/server/api'
import { panelData, requirePanel } from '../../../lib/server/panel'
import { panelOverview } from '../../../lib/server/panelStats'
import { panelQuery } from '../../../lib/server/panelQuery'

export const GET = handle(async req => {
  await requirePanel()
  const { days, tz } = panelQuery(req)
  const db = await panelData()
  return panelOverview(db, days, tz)
})
