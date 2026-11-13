import { fail, handle, requireUser } from '../../../lib/server/api'
import { accessOf, findResource, peopleOf, resourceScope } from '../../../lib/server/shared'
import { sheetView } from '../../../lib/server/sheets'
import { mutate, read } from '../../../lib/server/store'
import type { Sheet } from '../../../types'

export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  const db = await read(resourceScope('sheets', id))
  const sheet = findResource(db, 'sheets', id) as Sheet
  const access = accessOf(db, sheet, user) ?? fail(403, 'Não tens acesso a esta planilha')
  return {
    sheet: sheetView(sheet, access),
    access,
    people: peopleOf(db, sheet),
    orgName: db.orgs.find(o => o.id === sheet.orgId)?.name,
    requests: access === 'owner' ? db.grants.filter(g => g.resourceId === sheet.id && g.role === 'pending').length : 0,
  }
})

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  return mutate(resourceScope('sheets', id), db => {
    const sheet = findResource(db, 'sheets', id)
    if (accessOf(db, sheet, user) !== 'owner') fail(403, 'Só o dono da planilha a pode apagar')
    db.sheets = db.sheets.filter(s => s.id !== sheet.id)
    db.grants = db.grants.filter(g => g.resourceId !== sheet.id)
    return { ok: true }
  })
})
