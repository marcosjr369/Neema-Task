import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { DIAGRAM_LIMITS, cleanPreview, cleanXml, diagramView } from '../../../lib/server/diagrams'
import { accessOf, findResource, markSeen, peopleOf, resourceScope } from '../../../lib/server/shared'
import { canEdit } from '../../../lib/server/sharing'
import { mutate, read } from '../../../lib/server/store'
import type { Diagram } from '../../../types'

/** ?rev=N: se o diagrama ainda estiver nessa versão, não reenvia o conteúdo (poupa o XML a cada verificação) */
export const GET = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const db = await read(resourceScope('diagrams', id))
  const diagram = findResource(db, 'diagrams', id) as Diagram
  const access = accessOf(db, diagram, user) ?? fail(403, 'Não tens acesso a este diagrama')
  await markSeen(db, diagram, user)
  const known = Number(new URL(req.url).searchParams.get('rev'))
  const base = {
    access,
    rev: diagram.rev,
    title: diagram.title,
    people: peopleOf(db, diagram),
    orgName: db.orgs.find(o => o.id === diagram.orgId)?.name,
    updatedByName: db.users.find(u => u.id === diagram.updatedBy)?.name,
    requests: access === 'owner' ? db.grants.filter(g => g.resourceId === diagram.id && g.role === 'pending').length : 0,
  }
  if (known && known === diagram.rev) return { ...base, unchanged: true }
  return { ...base, diagram: diagramView(diagram, access) }
})

/**
 * Gravar: { title } muda o nome; { xml, rev, preview? } grava o conteúdo.
 * Se outra pessoa gravou entretanto (rev diferente), responde 409, a não ser que venha { force: true }.
 */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const input = await body<{ title?: string; xml?: string; rev?: number; preview?: string | null; force?: boolean }>(req)
  const xml = input.xml !== undefined ? cleanXml(input.xml) : undefined
  return mutate(resourceScope('diagrams', id), db => {
    const d = findResource(db, 'diagrams', id) as Diagram
    const access = accessOf(db, d, user)
    if (!access) fail(403, 'Não tens acesso a este diagrama')
    if (!canEdit(access)) fail(403, 'Só podes ver este diagrama')
    if (input.title !== undefined) {
      const title = String(input.title).trim().slice(0, DIAGRAM_LIMITS.title)
      if (!title) fail(400, 'Indica o nome do diagrama')
      d.title = title
    }
    if (xml !== undefined) {
      if (!input.force && input.rev !== d.rev) {
        const who = db.users.find(u => u.id === d.updatedBy)
        fail(409, `${who && who.id !== user.id ? who.name : 'Outra pessoa'} alterou este diagrama entretanto`)
      }
      if (xml !== d.xml) {
        d.xml = xml
        d.rev += 1
        d.updatedBy = user.id
      }
      if (input.preview !== undefined) d.preview = cleanPreview(input.preview)
    }
    d.updatedAt = Date.now()
    return { rev: d.rev, updatedAt: d.updatedAt }
  })
})

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  return mutate(resourceScope('diagrams', id), db => {
    const d = findResource(db, 'diagrams', id)
    if (accessOf(db, d, user) !== 'owner') fail(403, 'Só o dono do diagrama o pode apagar')
    db.diagrams = db.diagrams.filter(x => x.id !== d.id)
    db.grants = db.grants.filter(g => g.resourceId !== d.id)
    return { ok: true }
  })
})
