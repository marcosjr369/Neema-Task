import { body, fail, handle, requireMember, requireUser } from '../../lib/server/api'
import { accessOf, loadMine, summaryBase } from '../../lib/server/shared'
import { shareToken } from '../../lib/server/sharing'
import { mutate, newId, read } from '../../lib/server/store'
import { SHEET_LIMITS, SheetOpError, cleanTab, newTab } from '../../lib/sheets/ops'
import type { Sheet, SheetSummary, SheetTab, ShareVisibility } from '../../types'

const MAX_SHEETS = 200

/** Planilhas a que tenho acesso: as minhas, as das empresas onde estou e as partilhadas comigo */
export const GET = handle(async () => {
  const user = await requireUser()
  const db = await read(l => loadMine(user, 'sheets', l))
  const sheets: SheetSummary[] = []
  for (const s of db.sheets) {
    const access = accessOf(db, s, user)
    if (access) sheets.push({ ...summaryBase(db, s, user, access), tabs: s.tabs.length })
  }
  sheets.sort((a, z) => z.updatedAt - a.updatedAt)
  return { sheets }
})

/** Nova planilha, vazia ou com folhas importadas (de um .xlsx ou .csv lido no browser) */
export const POST = handle(async req => {
  const input = await body<{ title?: string; orgId?: string; visibility?: ShareVisibility; tabs?: Partial<SheetTab>[] }>(req)
  const title = String(input.title ?? '').trim().slice(0, SHEET_LIMITS.title)
  if (!title) fail(400, 'Indica o nome da planilha')
  const user = input.orgId ? (await requireMember(input.orgId)).user : await requireUser()
  const visibility: ShareVisibility = input.orgId ? (input.visibility === 'private' ? 'private' : 'org') : input.visibility === 'link' ? 'link' : 'private'

  let tabs: SheetTab[]
  try {
    const given = Array.isArray(input.tabs) ? input.tabs.slice(0, SHEET_LIMITS.tabs) : []
    const names = new Set<string>()
    tabs = given.map((t, i) => {
      let name = String(t.name ?? '').replace(/[[\]:*?/\\]/g, '').trim().slice(0, SHEET_LIMITS.tabName) || `Folha ${i + 1}`
      while (names.has(name.toLowerCase())) name = `${name.slice(0, SHEET_LIMITS.tabName - 4)} (${i + 1})`
      names.add(name.toLowerCase())
      return cleanTab(t, newId(), name)
    })
    if (tabs.reduce((n, t) => n + Object.keys(t.cells).length, 0) > SHEET_LIMITS.cells) fail(400, 'O ficheiro tem células a mais')
  } catch (err) {
    if (err instanceof SheetOpError) fail(400, err.message)
    throw err
  }
  if (!tabs.length) tabs = [newTab(newId())]

  const now = Date.now()
  return mutate(
    async l => { await l.load('sheets', { owner_id: user.id }) },
    db => {
      if (db.sheets.filter(s => s.ownerId === user.id).length >= MAX_SHEETS) fail(400, `Já tens ${MAX_SHEETS} planilhas. Apaga alguma antes de criar outra.`)
      const sheet: Sheet = {
        id: newId(),
        title,
        orgId: input.orgId || undefined,
        ownerId: user.id,
        createdAt: now,
        updatedAt: now,
        tabs,
        sharing: { visibility, orgRole: input.orgId ? 'edit' : undefined, token: shareToken() },
      }
      db.sheets.push(sheet)
      return { id: sheet.id }
    },
  )
})
