import { DEFAULT_SETTINGS, type User } from '../../types'
import { formatDuration } from '../stats'
import { nudgeMessage } from '../nudges'
import { effectivePresence } from './org'
import { pushConfigured, sendToUser } from './push'
import { mutate, read, type DB } from './store'
import { userScope } from './scopes'

/** Hora, minuto e segundo locais do utilizador (o servidor pode estar noutro fuso) */
function localClock(now: number, timeZone?: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(now)
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0)
    return { h: get('hour'), m: get('minute'), s: get('second') }
  } catch {
    const d = new Date(now)
    return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }
  }
}

/** Decide se o utilizador deve receber um lembrete agora; devolve a mensagem ou null */
export function reminderFor(db: DB, user: User, now = Date.now()) {
  const settings = { ...DEFAULT_SETTINGS, ...user.settings }
  const interval = settings.idleReminderMinutes * 60 * 1000
  if (!interval) return null

  const { h, m, s } = localClock(now, user.timezone)
  if (h < settings.reminderStartHour || h >= settings.reminderEndHour) return null
  const dayStart = now - ((h * 60 + m) * 60 + s) * 1000
  const workStart = dayStart + settings.reminderStartHour * 3600 * 1000

  // cronómetro a correr em qualquer espaço → está a trabalhar
  if (Object.values(user.timers ?? {}).some(t => t.segmentStart)) return null

  const memberIds = new Set(db.members.filter(mb => mb.userId === user.id).map(mb => mb.id))
  // na empresa, pausa/almoço/reunião/formação/ausente não contam como "parado"
  const excused = db.members.some(mb => {
    if (mb.userId !== user.id) return false
    const p = effectivePresence(mb, now)
    return p !== 'trabalho' && p !== 'offline'
  })
  if (excused) return null

  const mine = db.sessions.filter(x => x.userId === user.id || (x.memberId && memberIds.has(x.memberId)))
  const today = mine.reduce((a, x) => (x.start >= dayStart ? a + x.seconds : a), 0)
  if (today >= settings.dailyGoalMinutes * 60) return null

  const lastWork = mine.reduce((a, x) => Math.max(a, x.end), 0)
  const since = Math.max(lastWork, workStart, user.lastNudgeAt ?? 0)
  if (now - since < interval) return null

  // voltou a trabalhar depois do último lembrete → recomeça na primeira frase
  const count = lastWork > (user.lastNudgeAt ?? 0) ? 0 : user.nudgeCount ?? 0
  const idleFor = formatDuration((now - Math.max(lastWork, workStart)) / 1000)
  return { ...nudgeMessage(count, idleFor), count }
}

/** Passa por todos os utilizadores com push activo e envia os lembretes devidos */
export async function runReminders(now = Date.now()) {
  if (!pushConfigured()) return { sent: 0 }
  // só quem tem notificações activas, os seus membros e o trabalho das últimas 48h
  // (o lembrete conta a partir do último trabalho ou do início do horário de hoje)
  const db = await read(async l => {
    await l.load('push')
    const userIds = [...new Set(l.db.push.map(p => p.userId))]
    await l.load('users', { id: userIds })
    await l.load('members', { user_id: userIds })
    const since = now - 48 * 3600 * 1000
    await l.load('sessions', { user_id: userIds, start_at: { gte: since } })
    await l.load('sessions', { member_id: l.db.members.map(m => m.id), start_at: { gte: since } })
  })
  const withPush = new Set(db.push.map(p => p.userId))
  let sent = 0
  for (const user of db.users) {
    if (!withPush.has(user.id)) continue
    const msg = reminderFor(db, user, now)
    if (!msg) continue
    const delivered = await sendToUser(user.id, {
      title: msg.title,
      body: msg.body,
      url: '/foco',
      tag: 'idle-nudge',
      actions: [{ action: 'focar', title: 'Focar agora' }],
    })
    await mutate(userScope(user.id), d => {
      const u = d.users.find(x => x.id === user.id)
      if (u) {
        u.lastNudgeAt = now
        u.nudgeCount = msg.count + 1
      }
    })
    sent += delivered
  }
  return { sent }
}

const LOOP_MS = 5 * 60 * 1000
const g = globalThis as unknown as { __neemaReminders?: ReturnType<typeof setInterval> }

/** Arranca a verificação periódica no próprio servidor Node (ver instrumentation.ts) */
export function startReminderLoop() {
  if (g.__neemaReminders || !pushConfigured()) return
  g.__neemaReminders = setInterval(() => {
    runReminders().catch(err => console.error('lembretes falharam', err))
  }, LOOP_MS)
}
