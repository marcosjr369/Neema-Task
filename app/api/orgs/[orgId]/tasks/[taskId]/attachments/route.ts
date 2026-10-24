import { fail, handle, requireMember, taskAccess } from '../../../../../../lib/server/api'
import { readFile, removeFiles, saveFile } from '../../../../../../lib/server/files'
import { orgScope } from '../../../../../../lib/server/scopes'
import { mutate, newId } from '../../../../../../lib/server/store'
import type { Attachment } from '../../../../../../types'

const MAX_UPLOAD = 15 * 1024 * 1024

type Params = { orgId: string; taskId: string }

/** Descarregar um anexo: ?id=<anexo>[&ver=1 para abrir no browser] (só quem vê a tarefa) */
export const GET = handle<Params>(async (req, { orgId, taskId }) => {
  const { db, me } = await requireMember(orgId, { tasks: true })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const task = db.tasks.find(t => t.id === taskId && t.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
  if (!taskAccess(db, me, task).view) fail(403, 'Sem acesso a este ficheiro')
  const att = task.attachments?.find(a => a.id === id) ?? fail(404, 'Ficheiro não encontrado')

  const data = (await readFile(att.id)) ?? fail(404, 'Ficheiro não encontrado')
  const inline = url.searchParams.has('ver') && /^(image\/|application\/pdf|text\/plain)/.test(att.type)
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': att.type,
      'Content-Length': String(data.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(att.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

/** Anexar um ficheiro (multipart, campo "file") como prova do trabalho */
export const POST = handle<Params>(async (req, { orgId, taskId }) => {
  const { db, me } = await requireMember(orgId, { tasks: true })
  const task = db.tasks.find(t => t.id === taskId && t.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
  const access = taskAccess(db, me, task)
  if (!access.owner && !access.manager) fail(403, 'Só o responsável pode anexar ficheiros')
  if (task.review?.status === 'approved') fail(400, 'A tarefa já foi aprovada')
  if ((task.attachments?.length ?? 0) >= 20) fail(400, 'Máximo de 20 anexos por tarefa')

  const form = await req.formData().catch(() => fail(400, 'Envio inválido'))
  const file = form.get('file')
  if (!(file instanceof File)) fail(400, 'Nenhum ficheiro enviado')
  const f = file as File
  if (f.size === 0) fail(400, 'Ficheiro vazio')
  if (f.size > MAX_UPLOAD) fail(413, 'O ficheiro excede 15 MB')

  const attachment: Attachment = {
    id: newId(),
    name: f.name.replace(/[\\/\r\n"]/g, '_').slice(0, 150) || 'ficheiro',
    size: f.size,
    type: f.type || 'application/octet-stream',
    uploadedAt: Date.now(),
    uploadedBy: me.id,
  }
  await saveFile(attachment.id, Buffer.from(await f.arrayBuffer()), attachment.type)

  return mutate(orgScope(orgId, { tasks: true }), d => {
    const t = d.tasks.find(x => x.id === taskId)
    if (!t) return fail(404, 'Tarefa não encontrada')
    t.attachments = [...(t.attachments ?? []), attachment]
    t.updatedAt = Date.now()
    return { task: t, attachment }
  })
})

/** ?id=<anexo> */
export const DELETE = handle<Params>(async (req, { orgId, taskId }) => {
  const { me } = await requireMember(orgId)
  const id = new URL(req.url).searchParams.get('id')
  const task = await mutate(orgScope(orgId, { tasks: true }), db => {
    const t = db.tasks.find(x => x.id === taskId && x.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
    const att = t.attachments?.find(a => a.id === id) ?? fail(404, 'Anexo não encontrado')
    const access = taskAccess(db, me, t)
    if (att.uploadedBy !== me.id && !access.manager) fail(403, 'Sem permissão')
    if (t.review?.status === 'approved') fail(400, 'A tarefa já foi aprovada')
    t.attachments = t.attachments!.filter(a => a.id !== id)
    t.updatedAt = Date.now()
    return t
  })
  await removeFiles([id!])
  return { task }
})
