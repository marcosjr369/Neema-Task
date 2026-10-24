import webpush from 'web-push'
import { mutate, read, type PushRecord } from './store'
import { userScope } from './scopes'

export type PushPayload = { title: string; body: string; url?: string; tag?: string; actions?: { action: string; title: string }[] }

export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

let configured = false
function setup() {
  if (configured || !pushConfigured()) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:suporte@exemplo.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
}

/** Envia para todos os dispositivos do utilizador; remove os que já não existem */
export async function sendToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured()) return 0
  setup()
  const subs = (await read(userScope(userId, { push: true }))).push.filter(p => p.userId === userId)
  const dead: string[] = []
  let sent = 0
  await Promise.all(
    subs.map(async (sub: PushRecord) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 60 * 60 })
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410: o browser cancelou a subscrição (desinstalou, limpou dados…)
        if (status === 404 || status === 410) dead.push(sub.endpoint)
        else console.error('push falhou', status ?? err)
      }
    }),
  )
  if (dead.length) {
    await mutate(userScope(userId, { push: true }), db => { db.push = db.push.filter(p => !dead.includes(p.endpoint)) })
  }
  return sent
}
