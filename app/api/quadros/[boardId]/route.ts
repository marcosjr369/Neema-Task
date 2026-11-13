import { fail, handle, requireUser } from '../../../lib/server/api'
import { boardAccess, boardPeople, boardScope, boardView, findBoard } from '../../../lib/server/boards'
import { mutate, read } from '../../../lib/server/store'

export const GET = handle<{ boardId: string }>(async (_req, { boardId }) => {
  const user = await requireUser()
  const db = await read(boardScope(boardId))
  const board = findBoard(db, boardId)
  const access = boardAccess(db, board, user) ?? fail(403, 'Não tens acesso a este quadro')
  return {
    board: boardView(board, access),
    access,
    people: boardPeople(db, board),
    orgName: db.orgs.find(o => o.id === board.orgId)?.name,
    requests: access === 'owner' ? db.grants.filter(g => g.resourceId === board.id && g.role === 'pending').length : 0,
  }
})

export const DELETE = handle<{ boardId: string }>(async (_req, { boardId }) => {
  const user = await requireUser()
  return mutate(boardScope(boardId), db => {
    const board = findBoard(db, boardId)
    if (boardAccess(db, board, user) !== 'owner') fail(403, 'Só o dono do quadro o pode apagar')
    db.boards = db.boards.filter(b => b.id !== board.id)
    db.grants = db.grants.filter(g => g.resourceId !== board.id)
    return { ok: true }
  })
})
