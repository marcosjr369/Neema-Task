import { fail, handle, requireUser } from '../../../../lib/server/api'
import { readFile } from '../../../../lib/server/files'
import { entriesFor, findPoll, pollScope, voterKey, whoIs } from '../../../../lib/server/polls'
import { canEdit } from '../../../../lib/server/sharing'
import { read } from '../../../../lib/server/store'
import type { PollFile, PollResponse } from '../../../../types'

const isFile = (v: unknown): v is PollFile => !!v && typeof v === 'object' && !Array.isArray(v) && 'id' in v && 'size' in v

/**
 * ?f=<id do ficheiro>[&ver]: um ficheiro enviado numa resposta ou candidatura.
 * Vêem-no quem gere, quem o enviou e, nos concursos, quem pode ver essa candidatura.
 */
export const GET = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const fileId = url.searchParams.get('f') ?? fail(404, 'Ficheiro não encontrado')
  const db = await read(pollScope(id))
  const poll = findPoll(db, id)
  const who = whoIs(db, poll, user)
  if (!who.access) fail(403, 'Não tens acesso a este inquérito')

  let file: PollFile | undefined
  let owner: PollResponse | undefined
  for (const r of db.responses) {
    if (r.pollId !== poll.id) continue
    const f = Object.values(r.answers).find(v => isFile(v) && v.id === fileId)
    if (isFile(f)) { file = f; owner = r; break }
  }
  if (!owner || !file) return fail(404, 'Ficheiro não encontrado')
  const entryId = owner.id
  const allowed = canEdit(who.access) || owner.voter === voterKey(poll, user.id) || (owner.kind === 'entry' && entriesFor(db, poll, who).some(e => e.id === entryId))
  if (!allowed) fail(403, 'Sem acesso a este ficheiro')

  const data = (await readFile(file.id)) ?? fail(404, 'Ficheiro não encontrado')
  const inline = url.searchParams.has('ver') && /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/.test(file.type)
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': file.type,
      'Content-Length': String(data.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})
