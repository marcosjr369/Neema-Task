/**
 * Corre uma vez quando o servidor Next arranca. Liga a verificação periódica dos
 * lembretes de inactividade (notificações push com a app fechada).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startReminderLoop } = await import('./app/lib/server/reminders')
  startReminderLoop()
}
