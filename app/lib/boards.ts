import type { Board, BoardCard, BoardLabel, BoardList, BoardView, ChecklistItem } from '../types'

/**
 * Operações sobre um quadro. O mesmo código corre no browser (actualização imediata, antes da
 * resposta) e no servidor (que valida e grava). Cada operação altera o quadro no lugar.
 */

export const BOARD_COLORS = ['#7B61FF', '#12B5A6', '#4C7DFF', '#EC5BA6', '#FF8A3D', '#E0A419', '#22A6CF', '#2B2840']

/**
 * Fotos de fundo (Unsplash, licença livre), servidas pela própria app em /quadros/fundos.
 * tint: cor média da foto, mostrada enquanto carrega.
 */
export const BOARD_IMAGES = [
  { id: 'floresta', label: 'Floresta', tint: '#4A4736' },
  { id: 'lago', label: 'Lago nas montanhas', tint: '#645C5C' },
  { id: 'barco', label: 'Barco no lago', tint: '#6D9088' },
  { id: 'vista-aerea', label: 'Vista aérea', tint: '#3C807D' },
  { id: 'praia', label: 'Praia', tint: '#BBBAB4' },
  { id: 'por-do-sol', label: 'Pôr do sol', tint: '#8584AB' },
  { id: 'nuvens', label: 'Acima das nuvens', tint: '#67677A' },
  { id: 'estrelas', label: 'Noite estrelada', tint: '#3F4C6B' },
  { id: 'colinas', label: 'Colinas', tint: '#6E7169' },
  { id: 'montanha', label: 'Montanha', tint: '#718084' },
  { id: 'estrada', label: 'Estrada no deserto', tint: '#6B5550' },
  { id: 'flores', label: 'Flores', tint: '#6E8D6D' },
] as const

export const boardImage = (id?: string) => BOARD_IMAGES.find(i => i.id === id)

/** Fundo CSS do quadro: a foto (se houver) ou um degradê da cor. "mini" usa a miniatura (listas, escolha). */
export function boardBackground(color: string, image?: string, mini = false) {
  const img = boardImage(image)
  if (img) return `${img.tint} url(/quadros/fundos/${img.id}${mini ? '-mini' : ''}.jpg) center / cover no-repeat`
  return `linear-gradient(135deg, ${color} 0%, ${color}cc 55%, ${color}99 100%)`
}
export const LIST_COLORS = ['#12B5A6', '#4C7DFF', '#7B61FF', '#EC5BA6', '#F2545B', '#FF8A3D', '#FFC53D', '#22A6CF', '#86829B']
export const LABEL_COLORS = ['#12B5A6', '#FFC53D', '#FF8A3D', '#F2545B', '#7B61FF', '#4C7DFF', '#22A6CF', '#EC5BA6', '#86829B']

export const LIMITS = {
  lists: 50,
  cards: 1000,
  labels: 30,
  title: 200,
  boardTitle: 80,
  description: 5000,
  checklist: 50,
  comments: 200,
  comment: 2000,
}

export const DEFAULT_LISTS = ['A fazer', 'Em curso', 'Concluído']

export const SORT_LABEL = { created: 'Data de criação', due: 'Data de entrega', title: 'Nome (A-Z)' } as const
export type SortBy = keyof typeof SORT_LABEL

export class OpError extends Error {}

const bad = (message: string): never => {
  throw new OpError(message)
}

export type CardPatch = Partial<Pick<BoardCard, 'title' | 'description' | 'labelIds' | 'memberIds' | 'dueDone' | 'checklist'>> & {
  start?: string | null
  due?: string | null
  cover?: string | null
}

export type BoardOp =
  | { type: 'board.update'; title?: string; description?: string; color?: string; background?: string | null }
  | { type: 'list.add'; id?: string; title: string }
  | { type: 'list.update'; listId: string; title?: string; color?: string | null }
  | { type: 'list.move'; listId: string; index: number }
  | { type: 'list.copy'; listId: string; id?: string; title?: string }
  | { type: 'list.pin'; listId: string; pinned: boolean }
  | { type: 'list.archive'; listId: string; archived: boolean }
  | { type: 'list.sort'; listId: string; by: SortBy }
  | { type: 'list.delete'; listId: string }
  | { type: 'card.add'; id?: string; listId: string; title: string; top?: boolean }
  | { type: 'card.update'; cardId: string; patch: CardPatch }
  | { type: 'card.move'; cardId: string; listId: string; index: number }
  | { type: 'card.copy'; cardId: string; id?: string; listId?: string; title?: string }
  | { type: 'card.archive'; cardId: string; archived: boolean }
  | { type: 'card.delete'; cardId: string }
  | { type: 'card.comment'; cardId: string; id?: string; text: string }
  | { type: 'card.uncomment'; cardId: string; commentId: string }
  | { type: 'label.add'; id?: string; name: string; color: string }
  | { type: 'label.update'; labelId: string; name?: string; color?: string }
  | { type: 'label.delete'; labelId: string }

export type OpCtx = {
  userId: string
  name: string
  now: number
  newId: () => string
  /** pode apagar comentários dos outros */
  moderator?: boolean
  /** utilizadores que podem ser membros de cartões (o servidor indica sempre) */
  people?: Set<string>
}

type AnyBoard = Board | BoardView

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function pickId(wanted: string | undefined, taken: { id: string }[], ctx: OpCtx) {
  return wanted && SAFE_ID.test(wanted) && !taken.some(x => x.id === wanted) ? wanted : ctx.newId()
}

const list = (b: AnyBoard, id: string) => b.lists.find(l => l.id === id) ?? bad('Lista não encontrada')
const card = (b: AnyBoard, id: string) => b.cards.find(c => c.id === id) ?? bad('Cartão não encontrado')
const label = (b: AnyBoard, id: string) => b.labels.find(l => l.id === id) ?? bad('Etiqueta não encontrada')

function color(v: unknown, palette: string[]) {
  if (typeof v !== 'string' || !palette.includes(v)) bad('Cor inválida')
  return v as string
}

function requireTitle(v: unknown, max: number, what: string) {
  return text(v, max) || bad(`Indica ${what}`)
}

/** Posição (no array global) para inserir antes do elemento "index" de entre os visíveis */
function insertAt<T>(all: T[], visible: T[], index: number) {
  const i = Math.max(0, Math.min(Math.floor(Number(index) || 0), visible.length))
  if (i < visible.length) return all.indexOf(visible[i])
  return visible.length ? all.indexOf(visible[visible.length - 1]) + 1 : all.length
}

export const openLists = (b: AnyBoard) => b.lists.filter(l => !l.archived)
export const cardsOf = (b: AnyBoard, listId: string) => b.cards.filter(c => c.listId === listId && !c.archived)

/** Ordem em que as listas aparecem: as fixadas primeiro */
export const shownLists = (b: AnyBoard) => {
  const open = openLists(b)
  return [...open.filter(l => l.pinned), ...open.filter(l => !l.pinned)]
}

function cleanChecklist(v: unknown, ctx: OpCtx): ChecklistItem[] {
  if (!Array.isArray(v)) bad('Checklist inválida')
  return (v as ChecklistItem[]).slice(0, LIMITS.checklist).flatMap(item => {
    const t = text(item?.text, LIMITS.title)
    if (!t) return []
    return [{ id: typeof item.id === 'string' && SAFE_ID.test(item.id) ? item.id : ctx.newId(), text: t, done: !!item.done }]
  })
}

function applyPatch(b: AnyBoard, c: BoardCard, patch: CardPatch, ctx: OpCtx) {
  if (!patch || typeof patch !== 'object') bad('Pedido inválido')
  if (patch.title !== undefined) c.title = requireTitle(patch.title, LIMITS.title, 'o título do cartão')
  if (patch.description !== undefined) c.description = text(patch.description, LIMITS.description) || undefined
  if (patch.labelIds !== undefined) {
    if (!Array.isArray(patch.labelIds)) bad('Etiquetas inválidas')
    c.labelIds = [...new Set(patch.labelIds)].filter(id => b.labels.some(l => l.id === id))
  }
  if (patch.memberIds !== undefined) {
    if (!Array.isArray(patch.memberIds)) bad('Membros inválidos')
    const ids = [...new Set(patch.memberIds)].filter((id): id is string => typeof id === 'string')
    if (ctx.people && ids.some(id => !ctx.people!.has(id) && !c.memberIds.includes(id))) bad('Só podes juntar pessoas com acesso ao quadro')
    c.memberIds = ids.slice(0, 30)
  }
  const dates = { start: c.start, due: c.due }
  for (const key of ['start', 'due'] as const) {
    const v = patch[key]
    if (v === undefined) continue
    if (v === null || v === '') dates[key] = undefined
    else if (typeof v === 'string' && DATE.test(v)) dates[key] = v
    else bad('Data inválida')
  }
  if (dates.start && dates.due && dates.start > dates.due) bad('O início tem de ser antes da entrega')
  c.start = dates.start
  c.due = dates.due
  if (patch.dueDone !== undefined) c.dueDone = !!patch.dueDone || undefined
  if (patch.cover !== undefined) c.cover = patch.cover === null ? undefined : color(patch.cover, LABEL_COLORS)
  if (patch.checklist !== undefined) c.checklist = cleanChecklist(patch.checklist, ctx)
}

function newCard(b: AnyBoard, id: string | undefined, listId: string, title: string, ctx: OpCtx): BoardCard {
  if (b.cards.length >= LIMITS.cards) bad(`Um quadro tem no máximo ${LIMITS.cards} cartões`)
  return {
    id: pickId(id, b.cards, ctx),
    listId,
    title,
    labelIds: [],
    memberIds: [],
    createdAt: ctx.now,
    createdBy: ctx.userId,
    updatedAt: ctx.now,
  }
}

function copyCard(b: AnyBoard, src: BoardCard, listId: string, ctx: OpCtx, id?: string, title?: string): BoardCard {
  const c = newCard(b, id, listId, title ? requireTitle(title, LIMITS.title, 'o título do cartão') : src.title, ctx)
  return {
    ...c,
    description: src.description,
    labelIds: [...src.labelIds],
    memberIds: [...src.memberIds],
    start: src.start,
    due: src.due,
    cover: src.cover,
    checklist: src.checklist?.map(i => ({ ...i, id: ctx.newId() })),
  }
}

export function applyOp(b: AnyBoard, op: BoardOp, ctx: OpCtx): void {
  if (!op || typeof op !== 'object') bad('Pedido inválido')
  switch (op.type) {
    case 'board.update': {
      if (op.title !== undefined) b.title = requireTitle(op.title, LIMITS.boardTitle, 'o nome do quadro')
      if (op.description !== undefined) b.description = text(op.description, LIMITS.description) || undefined
      if (op.color !== undefined) b.color = color(op.color, BOARD_COLORS)
      if (op.background !== undefined) {
        if (op.background === null) b.background = undefined
        else b.background = boardImage(op.background)?.id ?? bad('Fundo inválido')
      }
      break
    }
    case 'list.add': {
      if (b.lists.length >= LIMITS.lists) bad(`Um quadro tem no máximo ${LIMITS.lists} listas`)
      b.lists.push({ id: pickId(op.id, b.lists, ctx), title: requireTitle(op.title, LIMITS.title, 'o nome da lista'), createdAt: ctx.now })
      break
    }
    case 'list.update': {
      const l = list(b, op.listId)
      if (op.title !== undefined) l.title = requireTitle(op.title, LIMITS.title, 'o nome da lista')
      if (op.color !== undefined) l.color = op.color === null ? undefined : color(op.color, LIST_COLORS)
      break
    }
    case 'list.move': {
      const l = list(b, op.listId)
      const rest = b.lists.filter(x => x !== l)
      rest.splice(insertAt(rest, rest.filter(x => !x.archived), op.index), 0, l)
      b.lists = rest
      break
    }
    case 'list.copy': {
      const src = list(b, op.listId)
      if (b.lists.length >= LIMITS.lists) bad(`Um quadro tem no máximo ${LIMITS.lists} listas`)
      const copy: BoardList = {
        id: pickId(op.id, b.lists, ctx),
        title: op.title ? requireTitle(op.title, LIMITS.title, 'o nome da lista') : src.title,
        color: src.color,
        createdAt: ctx.now,
      }
      b.lists.splice(b.lists.indexOf(src) + 1, 0, copy)
      for (const c of cardsOf(b, src.id)) b.cards.push(copyCard(b, c, copy.id, ctx))
      break
    }
    case 'list.pin': {
      list(b, op.listId).pinned = !!op.pinned || undefined
      break
    }
    case 'list.archive': {
      list(b, op.listId).archived = !!op.archived || undefined
      break
    }
    case 'list.sort': {
      const l = list(b, op.listId)
      const mine = b.cards.filter(c => c.listId === l.id)
      const slots = mine.map(c => b.cards.indexOf(c))
      const key: Record<SortBy, (a: BoardCard, z: BoardCard) => number> = {
        created: (a, z) => a.createdAt - z.createdAt,
        // sem data de entrega vão para o fim
        due: (a, z) => (a.due ?? '9999').localeCompare(z.due ?? '9999'),
        title: (a, z) => a.title.localeCompare(z.title, 'pt', { sensitivity: 'base' }),
      }
      const sorter = key[op.by] ?? bad('Ordenação inválida')
      ;[...mine].sort(sorter).forEach((c, i) => { b.cards[slots[i]] = c })
      break
    }
    case 'list.delete': {
      const l = list(b, op.listId)
      if (!l.archived) bad('Arquiva a lista antes de a apagar')
      b.lists = b.lists.filter(x => x !== l)
      b.cards = b.cards.filter(c => c.listId !== l.id)
      break
    }
    case 'card.add': {
      const l = list(b, op.listId)
      const c = newCard(b, op.id, l.id, requireTitle(op.title, LIMITS.title, 'o título do cartão'), ctx)
      const visible = cardsOf(b, l.id)
      b.cards.splice(insertAt(b.cards, visible, op.top ? 0 : visible.length), 0, c)
      break
    }
    case 'card.update': {
      const c = card(b, op.cardId)
      applyPatch(b, c, op.patch, ctx)
      c.updatedAt = ctx.now
      break
    }
    case 'card.move': {
      const c = card(b, op.cardId)
      const l = list(b, op.listId)
      const rest = b.cards.filter(x => x !== c)
      c.listId = l.id
      c.updatedAt = ctx.now
      rest.splice(insertAt(rest, rest.filter(x => x.listId === l.id && !x.archived), op.index), 0, c)
      b.cards = rest
      break
    }
    case 'card.copy': {
      const src = card(b, op.cardId)
      const listId = op.listId ? list(b, op.listId).id : src.listId
      const c = copyCard(b, src, listId, ctx, op.id, op.title)
      if (listId === src.listId) b.cards.splice(b.cards.indexOf(src) + 1, 0, c)
      else b.cards.splice(insertAt(b.cards, cardsOf(b, listId), Infinity), 0, c)
      break
    }
    case 'card.archive': {
      const c = card(b, op.cardId)
      c.archived = !!op.archived || undefined
      c.updatedAt = ctx.now
      break
    }
    case 'card.delete': {
      const c = card(b, op.cardId)
      if (!c.archived) bad('Arquiva o cartão antes de o apagar')
      b.cards = b.cards.filter(x => x !== c)
      break
    }
    case 'card.comment': {
      const c = card(b, op.cardId)
      const t = requireTitle(op.text, LIMITS.comment, 'o comentário')
      c.comments ??= []
      if (c.comments.length >= LIMITS.comments) bad('Este cartão já tem demasiados comentários')
      c.comments.push({ id: pickId(op.id, c.comments, ctx), userId: ctx.userId, name: ctx.name, text: t, at: ctx.now })
      break
    }
    case 'card.uncomment': {
      const c = card(b, op.cardId)
      const comment = c.comments?.find(x => x.id === op.commentId) ?? bad('Comentário não encontrado')
      if (comment.userId !== ctx.userId && !ctx.moderator) bad('Só podes apagar os teus comentários')
      c.comments = c.comments!.filter(x => x !== comment)
      break
    }
    case 'label.add': {
      if (b.labels.length >= LIMITS.labels) bad(`Um quadro tem no máximo ${LIMITS.labels} etiquetas`)
      b.labels.push({ id: pickId(op.id, b.labels, ctx), name: text(op.name, 40), color: color(op.color, LABEL_COLORS) })
      break
    }
    case 'label.update': {
      const l: BoardLabel = label(b, op.labelId)
      if (op.name !== undefined) l.name = text(op.name, 40)
      if (op.color !== undefined) l.color = color(op.color, LABEL_COLORS)
      break
    }
    case 'label.delete': {
      const l = label(b, op.labelId)
      b.labels = b.labels.filter(x => x !== l)
      b.cards.forEach(c => { if (c.labelIds.includes(l.id)) c.labelIds = c.labelIds.filter(id => id !== l.id) })
      break
    }
    default:
      bad('Operação desconhecida')
  }
}

export function defaultLabels(newId: () => string): BoardLabel[] {
  return LABEL_COLORS.slice(0, 6).map(color => ({ id: newId(), name: '', color }))
}

/** Data AAAA-MM-DD para mostrar (ex.: "14 nov") */
export function shortDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, day)).replace('.', '')
}

export function dueState(c: Pick<BoardCard, 'due' | 'dueDone'>, today = new Date()): 'done' | 'late' | 'soon' | 'ok' | null {
  if (!c.due) return null
  if (c.dueDone) return 'done'
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (c.due < t) return 'late'
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const tm = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  return c.due <= tm ? 'soon' : 'ok'
}

export const shareUrl = (token: string) => (typeof window === 'undefined' ? `/p/${token}` : `${window.location.origin}/p/${token}`)

