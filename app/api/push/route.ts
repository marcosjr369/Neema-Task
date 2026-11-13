import { body, fail, handle, requireUser } from '../../lib/server/api'
import { pushConfigured } from '../../lib/server/push'
import { userScope } from '../../lib/server/scopes'
import { mutate, read } from '../../lib/server/store'

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

export const GET = handle(async req => {
  const user = await requireUser()
  const endpoint = new URL(req.url).searchParams.get('endpoint')
  const db = await read(userScope(user.id, { push: true }))
  return {
    configured: pushConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    subscribed: !!endpoint && db.push.some(p => p.endpoint === endpoint && p.userId === user.id),
    devices: db.push.filter(p => p.userId === user.id).length,
  }
})

export const POST = handle(async req => {
  const user = await requireUser()
  if (!pushConfigured()) fail(503, 'Notificações push não configuradas no servidor')
  const { subscription, timezone } = await body<{ subscription?: Sub; timezone?: string }>(req)
  const endpoint = subscription?.endpoint
  const keys = subscription?.keys
  if (!endpoint || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys.auth) fail(400, 'Subscrição inválida')
  const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? undefined
  await mutate(
    async l => {
      await l.load('users', { id: user.id })
      // o mesmo endpoint pode estar ligado a outra conta (mesmo browser, outro utilizador)
      await l.load('push', { id: endpoint! })
    },
    db => {
    db.push = db.push.filter(p => p.endpoint !== endpoint)
    db.push.push({ endpoint: endpoint!, keys: { p256dh: keys!.p256dh!, auth: keys!.auth! }, userId: user.id, createdAt: Date.now(), userAgent })
    const u = db.users.find(x => x.id === user.id)!
    if (timezone && timezone.length < 64) u.timezone = timezone
  },
  )
})

export const DELETE = handle(async req => {
  const user = await requireUser()
  const { endpoint } = await body<{ endpoint?: string }>(req)
  await mutate(userScope(user.id, { push: true }), db => {
    db.push = db.push.filter(p => !(p.endpoint === endpoint && p.userId === user.id))
  })
})
