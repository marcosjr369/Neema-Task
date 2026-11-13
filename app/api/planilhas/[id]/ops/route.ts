import { body, fail, handle, requireUser } from '../../../../lib/server/api'
import { accessOf, findResource, resourceScope } from '../../../../lib/server/shared'
import { canEdit } from '../../../../lib/server/sharing'
import { mutate, newId } from '../../../../lib/server/store'
import { applySheetOp, SheetOpError, type SheetOp } from '../../../../lib/sheets/ops'
import type { Sheet } from '../../../../types'

/** Uma ou mais alterações à planilha (ver SheetOp), aplicadas em conjunto. Devolve a planilha. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const { ops } = await body<{ ops: SheetOp[] }>(req)
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 50) fail(400, 'Pedido inválido')
  return mutate(resourceScope('sheets', id), db => {
    const sheet = findResource(db, 'sheets', id) as Sheet
    const access = accessOf(db, sheet, user)
    if (!access) fail(403, 'Não tens acesso a esta planilha')
    if (!canEdit(access)) fail(403, 'Só podes ver esta planilha')
    const now = Date.now()
    try {
      for (const op of ops) applySheetOp(sheet, op, { now, newId })
    } catch (err) {
      if (err instanceof SheetOpError) fail(400, err.message)
      throw err
    }
    sheet.updatedAt = now
    // o browser já aplicou as mesmas operações; o resto chega na próxima leitura
    return { updatedAt: now }
  })
})
