import { handle, requireMember } from '../../../../lib/server/api'
import { mutate } from '../../../../lib/server/store'
import { orgScope } from '../../../../lib/server/scopes'

/** O funcionário aceita o registo de tempo e estado */
export const POST = handle<{ orgId: string }>(async (_req, { orgId }) => {
  const { me } = await requireMember(orgId)
  return mutate(orgScope(orgId), db => {
    const m = db.members.find(x => x.id === me.id)!
    m.consentAt = Date.now()
    return { member: m }
  })
})
