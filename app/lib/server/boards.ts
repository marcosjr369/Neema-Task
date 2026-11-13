import type { Access, Board, BoardView, User } from '../../types'
import { accessOf, findResource, peopleOf, resourceByToken, resourceScope } from './shared'
import { sharingInfo } from './sharing'
import type { DB } from './store'

export const boardScope = (boardId: string) => resourceScope('boards', boardId)
export const boardByToken = (token: string) => resourceByToken('boards', token)
export const boardAccess = (db: DB, board: Board, user: User | null) => accessOf(db, board, user)
export const boardPeople = (db: DB, board: Board) => peopleOf(db, board)
export const findBoard = (db: DB, boardId: string) => findResource(db, 'boards', boardId) as Board

export function boardView(board: Board, access: Access): BoardView {
  // o link só é mostrado a quem gere a partilha
  return { ...board, sharing: sharingInfo(board.sharing, access === 'owner') }
}

/** O que um visitante sem acesso (link público ou senha) vê: sem arquivados nem dados da partilha */
export function publicView(board: Board): BoardView {
  const lists = board.lists.filter(l => !l.archived)
  const ids = new Set(lists.map(l => l.id))
  return {
    ...board,
    ownerId: '',
    lists,
    cards: board.cards.filter(c => !c.archived && ids.has(c.listId)).map(c => ({ ...c, createdBy: '' })),
    sharing: { visibility: board.sharing.visibility, hasPassword: !!board.sharing.password },
  }
}
