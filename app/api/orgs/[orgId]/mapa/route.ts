import { body, handle } from '../../../../lib/server/api'
import { mutate } from '../../../../lib/server/store'
import { orgScope } from '../../../../lib/server/scopes'
import { cleanOffice, requireCompany } from '../../../../lib/server/office'
import type { OfficeMap } from '../../../../types'

/**
 * Gravar o mapa do escritório inteiro (só a conta da empresa). Quem estava numa cadeira que
 * deixou de existir volta a ter de escolher onde está.
 */
export const PUT = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requireCompany(orgId)
  const input = await body<Partial<OfficeMap>>(req)
  return mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId)!
    org.office = cleanOffice(db, orgId, input, org.office?.guideId)
    return { office: org.office }
  })
})
