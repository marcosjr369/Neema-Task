import { handle } from '../../../lib/server/api'
import { requirePanel } from '../../../lib/server/panel'
import { panelOverview } from '../../../lib/server/panelStats'
import { read } from '../../../lib/server/store'
import { panelQuery } from '../../../lib/server/panelQuery'

/** Métricas, gráficos, utilizadores e empresas do painel. ?dias=7|30|90&tz=Europe/Lisbon */
export const GET = handle(async req => {
  await requirePanel()
  const { days, tz } = panelQuery(req)
  // o painel vê tudo; com Postgres isto carrega as tabelas inteiras (aceitável para um painel interno)
  const db = await read('all')
  return panelOverview(db, days, tz)
})
