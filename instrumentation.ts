/**
 * Corre uma vez quando o servidor Next arranca. Liga a verificação periódica dos
 * lembretes de inactividade e dos avisos do calendário (notificações push com a app fechada).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // em desenvolvimento não correm (leriam a base de dados a cada 30 s e mandariam notificações
  // a pessoas reais a partir desta máquina); NEEMA_BACKGROUND_JOBS=1 liga-as para testar
  if (process.env.NODE_ENV !== 'production' && process.env.NEEMA_BACKGROUND_JOBS !== '1') return
  const { startReminderLoop } = await import('./app/lib/server/reminders')
  const { startEventLoop } = await import('./app/lib/server/events')
  startReminderLoop()
  startEventLoop()
}
