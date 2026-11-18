import { fail, handle, requireMember } from '../../../../../lib/server/api'
import { readFile, removeFiles, saveFile } from '../../../../../lib/server/files'
import { mutate, newId } from '../../../../../lib/server/store'
import { orgScope } from '../../../../../lib/server/scopes'
import { requireCompany } from '../../../../../lib/server/office'
import { GUIDE_TYPES, MAX_GUIDE, emptyOffice } from '../../../../../lib/office'

type Params = { orgId: string }

const typeOf = (id: string) => (id.endsWith('.png') ? 'image/png' : id.endsWith('.webp') ? 'image/webp' : 'image/jpeg')

/** A planta usada como guia para desenhar o mapa */
export const GET = handle<Params>(async (_req, { orgId }) => {
  const { org } = await requireMember(orgId)
  const id = org.office?.guideId ?? fail(404, 'O mapa ainda não tem planta')
  const data = (await readFile(id!)) ?? fail(404, 'Planta não encontrada')
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': typeOf(id!),
      'Content-Length': String(data.length),
      'X-Content-Type-Options': 'nosniff',
      // uma planta nova tem outro id (o endereço leva ?v=id), por isso pode ficar em cache
      'Cache-Control': 'private, max-age=86400',
    },
  })
})

/** Carregar (ou trocar) a planta — só a conta da empresa */
export const POST = handle<Params>(async (req, { orgId }) => {
  await requireCompany(orgId)
  const form = await req.formData().catch(() => fail(400, 'Envio inválido'))
  const file = form.get('file')
  if (!(file instanceof File)) fail(400, 'Escolhe a planta ou uma foto do escritório')
  const f = file as File
  if (!GUIDE_TYPES.includes(f.type)) fail(400, 'A planta tem de ser JPG, PNG ou WebP')
  if (f.size === 0) fail(400, 'Ficheiro vazio')
  if (f.size > MAX_GUIDE) fail(413, 'A planta tem mais de 8 MB')

  const id = `planta-${newId()}.${f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg'}`
  await saveFile(id, Buffer.from(await f.arrayBuffer()), f.type)
  const { office, old } = await mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId)!
    org.office ??= emptyOffice()
    const previous = org.office.guideId
    org.office.guideId = id
    org.office.updatedAt = Date.now()
    return { office: org.office, old: previous }
  })
  if (old) await removeFiles([old]).catch(() => undefined)
  return { office }
})

/** Tirar a planta (o desenho do mapa fica) */
export const DELETE = handle<Params>(async (_req, { orgId }) => {
  await requireCompany(orgId)
  const { office, old } = await mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId)!
    const previous = org.office?.guideId
    if (org.office) {
      delete org.office.guideId
      org.office.updatedAt = Date.now()
    }
    return { office: org.office, old: previous }
  })
  if (old) await removeFiles([old]).catch(() => undefined)
  return { office: office ?? null }
})
