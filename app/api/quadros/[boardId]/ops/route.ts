import { body, fail, handle, requireUser } from '../../../../lib/server/api'
import { boardAccess, boardPeople, boardScope, boardView, findBoard } from '../../../../lib/server/boards'
import { canEdit } from '../../../../lib/server/sharing'
import { mutate, newId } from '../../../../lib/server/store'
import { applyOp, OpError, type BoardOp } from '../../../../lib/boards'

/** Uma alteração ao quadro (ver BoardOp). Devolve o quadro actualizado. */
export const POST = handle<{ boardId: string }>(async (req, { boardId }) => {
  const user = await requireUser()
  const { op } = await body<{ op: BoardOp }>(req)
  return mutate(boardScope(boardId), db => {
    const board = findBoard(db, boardId)
    const access = boardAccess(db, board, user)
    if (!access) fail(403, 'Não tens acesso a este quadro')
    if (!canEdit(access)) fail(403, 'Só podes ver este quadro')
    const now = Date.now()
    try {
      applyOp(board, op, {
        userId: user.id,
        name: user.name,
        now,
        newId,
        moderator: access === 'owner',
        people: new Set(boardPeople(db, board).map(p => p.userId)),
      })
    } catch (err) {
      if (err instanceof OpError) fail(400, err.message)
      throw err
    }
    board.updatedAt = now
    return { board: boardView(board, access!) }
  })
})
