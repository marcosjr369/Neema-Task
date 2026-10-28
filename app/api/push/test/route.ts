import { fail, handle, requireUser } from '../../../lib/server/api'
import { pushConfigured, sendToUser } from '../../../lib/server/push'

/** Envia uma notificação de teste para os dispositivos do próprio */
export const POST = handle(async () => {
  const user = await requireUser()
  if (!pushConfigured()) fail(503, 'Notificações push não configuradas no servidor')
  const sent = await sendToUser(user.id, {
    title: 'Olá! Sou a Udacha',
    body: 'É assim que te vou lembrar de focar, mesmo com a app fechada.',
    url: '/',
    tag: 'push-test',
  })
  if (!sent) fail(404, 'Nenhum dispositivo registado. Activa os lembretes primeiro.')
  return { sent }
})
