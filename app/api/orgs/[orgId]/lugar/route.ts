import { body, fail, handle, requireMember } from '../../../../lib/server/api'
import { mutate } from '../../../../lib/server/store'
import { orgScope } from '../../../../lib/server/scopes'
import { isCompanyAccount } from '../../../../lib/org'
import { choiceValid, findSeat, seatName, whereIs } from '../../../../lib/office'
import { effectivePresence } from '../../../../lib/server/org'

/**
 * Onde estou agora: uma cadeira do mapa ou trabalho remoto. Pedido ao entrar na plataforma;
 * vale durante um dia de trabalho e é limpo ao terminar o trabalho (não se guarda histórico).
 */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { me: who } = await requireMember(orgId)
  const input = await body<{ seatId?: string | null; remote?: boolean }>(req)
  if (!input.seatId && !input.remote) fail(400, 'Escolhe uma cadeira ou trabalho remoto')
  return mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId)!
    const me = db.members.find(m => m.id === who.id)!
    if (isCompanyAccount(me, org)) fail(403, 'A conta da empresa não tem lugar no escritório')
    const now = Date.now()
    if (input.seatId) {
      const at = findSeat(org.office, input.seatId) ?? fail(404, 'Esta cadeira já não existe. Escolhe outra.')
      const taken = db.members.find(m => {
        if (m.id === me.id || m.orgId !== orgId) return false
        const w = whereIs({ ...m, presence: effectivePresence(m, now) }, org.office, now)
        // sentada lá, ou numa reunião presencial com o lugar guardado
        return (w.kind === 'seat' && w.at.seat.id === input.seatId) || (w.kind === 'meeting' && m.seatId === input.seatId && choiceValid(m, now))
      })
      if (taken) fail(409, `${seatName(at)} é de ${taken.name}${whereIs({ ...taken, presence: effectivePresence(taken, now) }, org.office, now).kind === 'meeting' ? ' (está numa reunião)' : ''}. Escolhe outra cadeira.`)
      me.seatId = input.seatId
      me.remote = undefined
    } else {
      me.seatId = undefined
      me.remote = true
    }
    me.seatAt = now
    return { seatId: me.seatId ?? null, remote: !!me.remote, seatAt: me.seatAt }
  })
})
