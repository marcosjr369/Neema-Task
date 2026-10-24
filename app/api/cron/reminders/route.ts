import { fail, handle } from '../../../lib/server/api'
import { runReminders } from '../../../lib/server/reminders'

/**
 * Para alojamentos sem servidor sempre ligado (ex.: Vercel Cron): chamar a cada 5 min com
 * "Authorization: Bearer <CRON_SECRET>". No servidor Node normal os lembretes já correm sozinhos.
 */
export const GET = handle(async req => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) fail(401, 'Não autorizado')
  return runReminders()
})
