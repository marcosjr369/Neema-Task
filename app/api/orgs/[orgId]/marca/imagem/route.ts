import { fail, handle, managedDepartments, requireMember } from '../../../../../lib/server/api'
import { readFile, saveFile } from '../../../../../lib/server/files'
import { newId } from '../../../../../lib/server/store'

/**
 * Imagens da aparência (logótipo e fundos).
 * POST: quem pode mudar a aparência (administradores e chefias) envia uma imagem; só fica ligada quando se grava.
 * GET ?f=<id>: qualquer pessoa da empresa vê, mas só se a aparência da empresa ou de um departamento a usar.
 */

const MAX = 5 * 1024 * 1024
const TYPES = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/

export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, me } = await requireMember(orgId)
  const scope = managedDepartments(db, me)
  if (scope !== 'all' && !scope.size) fail(403, 'Só administradores e chefias mudam a aparência')
  const form = await req.formData().catch(() => fail(400, 'Envio inválido'))
  const f = form.get('file')
  if (!f || typeof f === 'string') return fail(400, 'Escolhe uma imagem')
  if (!TYPES.test(f.type)) fail(400, 'Envia uma imagem PNG, JPG, SVG, GIF ou WebP')
  if (f.size > MAX) fail(413, 'A imagem passa dos 5 MB')
  // o id leva a empresa: uma imagem nunca se mostra noutra empresa
  const id = `brand-${orgId}-${newId()}`
  await saveFile(id, Buffer.from(await f.arrayBuffer()), f.type)
  return { id }
})

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const fileId = new URL(req.url).searchParams.get('f') ?? fail(404, 'Imagem não encontrada')
  await requireMember(orgId)
  // só imagens desta empresa (o id leva a empresa): as gravadas e as acabadas de enviar (pré-visualização)
  if (!fileId.startsWith(`brand-${orgId}-`)) fail(404, 'Imagem não encontrada')
  const data = (await readFile(fileId)) ?? fail(404, 'Imagem não encontrada')
  const text = data.subarray(0, 200).toString('utf8')
  const type = /<svg[\s>]/i.test(text) || text.trimStart().startsWith('<?xml') ? 'image/svg+xml'
    : data[0] === 0x89 ? 'image/png' : data[0] === 0x47 ? 'image/gif' : data[0] === 0x52 ? 'image/webp' : 'image/jpeg'
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(data.length),
      'X-Content-Type-Options': 'nosniff',
      // SVG: mostrado só como <img>; se alguém o abrir directamente, nada corre
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
})
