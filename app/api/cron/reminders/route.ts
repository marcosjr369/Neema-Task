import { fail, handle } from '../../../lib/server/api'
import { runReminders } from '../../../lib/server/reminders'
import { runEventReminders } from '../../../lib/server/events'

/**
 * Para alojamentos sem servidor sempre ligado (ex.: Vercel Cron): chamar a cada minuto (ou 5 min)
 * com "Authorization: Bearer <CRON_SECRET>". Os avisos do calendário só são pontuais se for a cada minuto.
 * No servidor Node normal os lembretes já correm sozinhos.
 */
export const GET = handle(async req => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) fail(401, 'Não autorizado')
  const [idle, events] = await Promise.all([runReminders(), runEventReminders()])
  return { sent: idle.sent, events: events.sent }
})
