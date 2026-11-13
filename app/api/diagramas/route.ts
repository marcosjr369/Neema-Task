import { body, fail, handle, requireMember, requireUser } from '../../lib/server/api'
import { DIAGRAM_LIMITS, EMPTY_DIAGRAM, cleanXml } from '../../lib/server/diagrams'
import { accessOf, loadMine, summaryBase } from '../../lib/server/shared'
import { shareToken } from '../../lib/server/sharing'
import { mutate, newId, read } from '../../lib/server/store'
import type { Diagram, DiagramSummary, ShareVisibility } from '../../types'

const MAX_DIAGRAMS = 200

/** Diagramas a que tenho acesso: os meus, os das empresas onde estou e os partilhados comigo */
export const GET = handle(async () => {
  const user = await requireUser()
  const db = await read(l => loadMine(user, 'diagrams', l))
  const diagrams: DiagramSummary[] = []
  for (const d of db.diagrams) {
    const access = accessOf(db, d, user)
    if (access) diagrams.push({ ...summaryBase(db, d, user, access), preview: d.preview })
  }
  diagrams.sort((a, z) => z.updatedAt - a.updatedAt)
  return { diagrams }
})

/** Novo diagrama, em branco ou com o conteúdo de um ficheiro .drawio lido no browser */
export const POST = handle(async req => {
  const input = await body<{ title?: string; orgId?: string; visibility?: ShareVisibility; xml?: string }>(req)
  const title = String(input.title ?? '').trim().slice(0, DIAGRAM_LIMITS.title)
  if (!title) fail(400, 'Indica o nome do diagrama')
  const xml = input.xml ? cleanXml(input.xml) : EMPTY_DIAGRAM
  const user = input.orgId ? (await requireMember(input.orgId)).user : await requireUser()
  const visibility: ShareVisibility = input.orgId ? (input.visibility === 'private' ? 'private' : 'org') : input.visibility === 'link' ? 'link' : 'private'

  const now = Date.now()
  return mutate(
    async l => { await l.load('diagrams', { owner_id: user.id }) },
    db => {
      if (db.diagrams.filter(d => d.ownerId === user.id).length >= MAX_DIAGRAMS) fail(400, `Já tens ${MAX_DIAGRAMS} diagramas. Apaga algum antes de criar outro.`)
      const diagram: Diagram = {
        id: newId(),
        title,
        orgId: input.orgId || undefined,
        ownerId: user.id,
        createdAt: now,
        updatedAt: now,
        updatedBy: user.id,
        xml,
        rev: 1,
        sharing: { visibility, orgRole: input.orgId ? 'edit' : undefined, token: shareToken() },
      }
      db.diagrams.push(diagram)
      return { id: diagram.id }
    },
  )
})
