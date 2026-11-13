import { body, fail, handle, requireMember, requireUser } from '../../lib/server/api'
import { boardAccess } from '../../lib/server/boards'
import { loadMine, summaryBase } from '../../lib/server/shared'
import { shareToken } from '../../lib/server/sharing'
import { mutate, newId, read } from '../../lib/server/store'
import { BOARD_COLORS, DEFAULT_LISTS, LIMITS, boardImage, defaultLabels } from '../../lib/boards'
import type { Board, BoardSummary, ShareVisibility } from '../../types'

const MAX_BOARDS = 200

/** Quadros a que tenho acesso: os meus, os das empresas onde estou e os partilhados comigo */
export const GET = handle(async () => {
  const user = await requireUser()
  const db = await read(l => loadMine(user, 'boards', l))
  const boards: BoardSummary[] = []
  for (const b of db.boards) {
    const access = boardAccess(db, b, user)
    if (!access) continue
    boards.push({
      ...summaryBase(db, b, user, access),
      color: b.color,
      background: b.background,
      lists: b.lists.filter(l => !l.archived).length,
      cards: b.cards.filter(c => !c.archived).length,
      updatedAt: b.updatedAt,
    })
  }
  boards.sort((a, z) => z.updatedAt - a.updatedAt)
  return { boards }
})

export const POST = handle(async req => {
  const input = await body<{ title?: string; orgId?: string; color?: string; background?: string; visibility?: ShareVisibility }>(req)
  const title = String(input.title ?? '').trim().slice(0, LIMITS.boardTitle)
  if (!title) fail(400, 'Indica o nome do quadro')
  const color = BOARD_COLORS.includes(input.color ?? '') ? input.color! : BOARD_COLORS[0]

  let visibility: ShareVisibility
  const user = input.orgId ? (await requireMember(input.orgId)).user : await requireUser()
  if (input.orgId) visibility = input.visibility === 'private' ? 'private' : 'org'
  else visibility = input.visibility === 'link' ? 'link' : 'private'

  const now = Date.now()
  return mutate(
    async l => { await l.load('boards', { owner_id: user.id }) },
    db => {
      if (db.boards.length >= MAX_BOARDS) fail(400, `Já tens ${MAX_BOARDS} quadros. Apaga algum antes de criar outro.`)
      const board: Board = {
        id: newId(),
        title,
        color,
        background: boardImage(input.background)?.id,
        orgId: input.orgId || undefined,
        ownerId: user.id,
        createdAt: now,
        updatedAt: now,
        lists: DEFAULT_LISTS.map(t => ({ id: newId(), title: t, createdAt: now })),
        cards: [],
        labels: defaultLabels(newId),
        sharing: { visibility, orgRole: input.orgId ? 'edit' : undefined, token: shareToken() },
      }
      db.boards.push(board)
      return { id: board.id }
    },
  )
})
