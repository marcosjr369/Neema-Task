import { fail, handle, requireUser } from '../../../../lib/server/api'
import { readFile, saveFile } from '../../../../lib/server/files'
import { findPoll, pollScope, whoIs } from '../../../../lib/server/polls'
import { canEdit } from '../../../../lib/server/sharing'
import { newId, read } from '../../../../lib/server/store'
import { pollImages } from '../../../../lib/polls'

/**
 * Imagens do aspeto do formulário (cabeçalho, fundo, imagem de uma pergunta ou bloco de imagem).
 * POST (quem gere): envia uma imagem e devolve o id; só fica ligada ao inquérito quando se grava.
 * GET ?f=<id>: mostra a imagem a qualquer pessoa (também a quem responde sem conta), mas só se o
 * inquérito a usar. Os ids são aleatórios e não se adivinham.
 */

const MAX = 5 * 1024 * 1024
const TYPES = /^image\/(png|jpe?g|gif|webp)$/

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const db = await read(pollScope(id))
  const poll = findPoll(db, id)
  if (!canEdit(whoIs(db, poll, user).access)) fail(403, 'Só quem gere o inquérito muda o aspeto')
  const form = await req.formData().catch(() => fail(400, 'Envio inválido'))
  const f = form.get('file')
  if (!f || typeof f === 'string') return fail(400, 'Escolhe uma imagem')
  if (!TYPES.test(f.type)) fail(400, 'Envia uma imagem PNG, JPG, GIF ou WebP')
  if (f.size > MAX) fail(413, 'A imagem passa dos 5 MB')
  // o id leva o inquérito: outro inquérito não a pode usar (nem apagar)
  const imageId = `pollimg-${poll.id}-${newId()}`
  await saveFile(imageId, Buffer.from(await f.arrayBuffer()), f.type)
  return { id: imageId }
})

export const GET = handle<{ id: string }>(async (req, { id }) => {
  const fileId = new URL(req.url).searchParams.get('f') ?? fail(404, 'Imagem não encontrada')
  const db = await read(async l => { await l.load('polls', { id }) })
  const poll = findPoll(db, id)
  if (!pollImages(poll).includes(fileId)) fail(404, 'Imagem não encontrada')
  const data = (await readFile(fileId)) ?? fail(404, 'Imagem não encontrada')
  // o tipo vem dos primeiros bytes (só imagens que aceitámos ao enviar)
  const type = data[0] === 0x89 ? 'image/png' : data[0] === 0x47 ? 'image/gif' : data[0] === 0x52 ? 'image/webp' : 'image/jpeg'
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(data.length),
      'X-Content-Type-Options': 'nosniff',
      // o id muda sempre que a imagem muda: pode ficar em cache muito tempo
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
