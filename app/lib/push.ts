import { api } from './api'
import { isStandalone } from './pwa'

/** Notificações push no browser (lembretes com a app fechada) */

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyToBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function registration() {
  return navigator.serviceWorker.ready
}

export async function pushState(): Promise<PushState> {
  // no iPhone/iPad o push só existe com a app instalada no ecrã principal
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return 'off'
  const res = await api<{ subscribed: boolean }>(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`)
  return res.subscribed ? 'on' : 'off'
}

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Pede autorização (tem de vir de um clique) e regista o dispositivo no servidor */
export async function enablePush() {
  const { publicKey, configured } = await api<{ publicKey: string | null; configured: boolean }>('/api/push')
  if (!configured || !publicKey) throw new Error('O servidor ainda não tem as notificações push configuradas')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Autoriza as notificações para receberes os lembretes')
  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }))
  await api('/api/push', { body: { subscription: sub.toJSON(), timezone: timezone() } })
}

export async function disablePush() {
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return
  await api('/api/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => undefined)
  await sub.unsubscribe()
}

/** Ao abrir a app: se já há autorização, mantém a subscrição e o fuso horário em dia no servidor */
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const sub = await (await registration()).pushManager.getSubscription()
  if (sub) await api('/api/push', { body: { subscription: sub.toJSON(), timezone: timezone() } }).catch(() => undefined)
}
