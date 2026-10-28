import { fail, handle } from '../../../../lib/server/api'
import { requirePanel } from '../../../../lib/server/panel'
import { orgDetail } from '../../../../lib/server/panelDetail'
import { panelQuery } from '../../../../lib/server/panelQuery'
import { read } from '../../../../lib/server/store'

/** Ficha de uma empresa: dados, funcionários, departamentos, tarefas e estatísticas */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requirePanel()
  const { days, tz } = panelQuery(req)
  return orgDetail(await read('all'), orgId, days, tz) ?? fail(404, 'Empresa não encontrada')
})
