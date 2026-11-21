import type { Access, Poll, PollEntry, PollFile, PollResponse, PollView, User } from '../../types'
import { PollError, POLL_LIMITS, cleanAnswers, entryScore, guestsNeedLogin, isClosed, phaseOf, resultsVisible, summarize } from '../polls'
import { fail } from './api'
import { saveFile } from './files'
import { accessOf, peopleOf, resourceScope } from './shared'
import { canEdit, hmac, sharingInfo } from './sharing'
import { newId, type DB, type Loader } from './store'

/**
 * Inquéritos no servidor: quem pode responder, como se guarda quem votou, ficheiros e o que
 * cada pessoa recebe ao abrir um inquérito.
 *
 * Anónimos: a resposta guarda em "voter" um código cifrado (HMAC com o segredo do servidor) em vez
 * do id da pessoa. Assim continua a dar para impedir dois votos e mudar a resposta, mas nem o dono
 * nem um administrador da empresa sabem quem respondeu o quê.
 */

export const MAX_POLLS = 200

export const asPollError = <T>(fn: () => T): T => {
  try {
    return fn()
  } catch (err) {
    if (err instanceof PollError) fail(400, err.message)
    throw err
  }
}

/** O código de quem vota neste inquérito */
export const voterKey = (poll: Pick<Poll, 'id' | 'settings'>, userId: string) =>
  poll.settings.anonymous ? `a:${hmac(`${poll.id}:${userId}`).slice(0, 32)}` : userId

/** Carrega o inquérito, a partilha e todas as respostas */
export const pollScope = (id: string) => async (l: Loader) => {
  await Promise.all([resourceScope('polls', id)(l), l.load('responses', { poll_id: id })])
  // autores das ideias/candidaturas e das respostas com nome
  const orgId = l.db.polls[0]?.orgId
  await Promise.all([
    l.load('users', { id: [...new Set(l.db.responses.map(r => r.userId).filter((x): x is string => !!x))] }),
    // permissões por departamento (Definições → Permissões)
    orgId ? l.load('departments', { org_id: orgId }) : undefined,
  ])
}

export function findPoll(db: DB, id: string) {
  return db.polls.find(p => p.id === id) ?? fail(404, 'Inquérito não encontrado')
}

/** Abre para quem não tem acesso pela conta: link público pessoal, ou "aceitar respostas pelo link" */
export const publicOpen = (p: Poll) => p.type !== 'election' && (p.settings.publicLink || (!p.orgId && p.sharing.visibility === 'link'))

function pollView(p: Poll, access: Access | null): PollView {
  const manager = canEdit(access)
  return {
    ...p,
    // quem só responde não precisa de saber o júri nem o link
    settings: manager ? p.settings : { ...p.settings, jury: undefined },
    sharing: sharingInfo(p.sharing, access === 'owner'),
  }
}

/** O que um visitante sem acesso pela conta vê */
function publicPollView(p: Poll): PollView {
  return { ...pollView(p, null), ownerId: '' }
}

/* ─── Quem pode fazer o quê ───────────────────────────────────────────── */

type Who = { user: User | null; access: Access | null }

const myResponses = (db: DB, poll: Poll, user: User | null) => {
  if (!user) return []
  const key = voterKey(poll, user.id)
  return db.responses.filter(r => r.pollId === poll.id && r.voter === key)
}

/** Porque não pode responder agora (null = pode) */
export function answerBlock(db: DB, poll: Poll, who: Who): string | null {
  if (poll.type === 'ideas' || poll.type === 'contest') return 'Este inquérito não tem respostas, tem entradas'
  if (poll.status === 'draft') return 'Este inquérito ainda não foi publicado'
  if (isClosed(poll)) return 'Este inquérito já está fechado'
  if (!who.user) {
    if (guestsNeedLogin(poll)) return 'Entra na tua conta para responder: assim cada pessoa responde só uma vez'
    return null
  }
  const mine = myResponses(db, poll, who.user).filter(r => r.kind === 'answer')
  if (poll.settings.onePerPerson && mine.length && !poll.settings.canChange) return 'Já respondeste a este inquérito'
  return null
}

export function entryBlock(poll: Poll, who: Who): string | null {
  if (poll.type !== 'ideas' && poll.type !== 'contest') return 'Este inquérito não recebe ideias nem candidaturas'
  if (poll.status === 'draft') return 'Este inquérito ainda não foi publicado'
  if (isClosed(poll)) return 'Este inquérito já está fechado'
  if (!who.user) return 'Entra na tua conta para participar'
  return null
}

/* ─── Ficheiros ───────────────────────────────────────────────────────── */

const FILE_TYPES = /^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf|text\/plain|application\/zip|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/msword|application\/vnd\.ms-excel)$/

export type Submission = {
  answers: Record<string, unknown>
  other?: Record<string, unknown>
  name?: string
  text?: string
  details?: string
  files: Record<string, File>
}

/** Lê uma resposta: JSON, ou multipart com "data" (JSON) e os ficheiros em "file:<campo>" */
export async function readSubmission(req: Request): Promise<Submission> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => fail(400, 'Envio inválido'))
    const data = JSON.parse(String(form.get('data') ?? '{}')) as Partial<Submission>
    const files: Record<string, File> = {}
    for (const [k, v] of form.entries()) if (k.startsWith('file:') && typeof v !== 'string') files[k.slice(5)] = v
    return { answers: data.answers ?? {}, other: data.other, name: data.name, text: data.text, details: data.details, files }
  }
  const data = await req.json().catch(() => fail(400, 'Pedido inválido')) as Partial<Submission>
  return { answers: data.answers ?? {}, other: data.other, name: data.name, text: data.text, details: data.details, files: {} }
}

/** Confirma os ficheiros (só para campos "ficheiro" que existem) e reserva-lhes um id */
function planFiles(poll: Poll, files: Record<string, File>): Record<string, PollFile> {
  const out: Record<string, PollFile> = {}
  for (const [fieldId, f] of Object.entries(files)) {
    if (!poll.fields.some(x => x.id === fieldId && x.kind === 'file')) continue
    if (f.size > POLL_LIMITS.file) fail(413, `"${f.name}" passa dos ${POLL_LIMITS.file / 1024 / 1024} MB`)
    if (!FILE_TYPES.test(f.type)) fail(400, `"${f.name}": envia uma imagem, um PDF ou um documento do Office`)
    out[fieldId] = { id: `poll-${poll.id}-${newId()}`, name: f.name.slice(0, 200) || 'ficheiro', size: f.size, type: f.type }
  }
  return out
}

async function saveFiles(planned: Record<string, PollFile>, files: Record<string, File>) {
  await Promise.all(Object.entries(planned).map(async ([fieldId, meta]) => saveFile(meta.id, Buffer.from(await files[fieldId].arrayBuffer()), meta.type)))
}

/** Valida tudo antes de gravar os ficheiros (para não ficarem ficheiros órfãos de uma resposta recusada) */
/** keep: ficheiros já enviados (da resposta que se está a mudar) que a pessoa não trocou */
export async function prepareAnswers(poll: Poll, sub: Submission, keep: Record<string, PollFile> = {}) {
  const planned = planFiles(poll, sub.files)
  const clean = asPollError(() => cleanAnswers(poll, sub, { ...keep, ...planned }))
  await saveFiles(planned, sub.files)
  return { ...clean, fileIds: Object.values(planned).map(f => f.id) }
}

export const filesOf = (r: PollResponse) => Object.values(r.answers).filter((v): v is PollFile => !!v && typeof v === 'object' && !Array.isArray(v) && 'id' in v && 'size' in v).map(f => f.id)

/* ─── O que o browser recebe ──────────────────────────────────────────── */

const isJury = (poll: Poll, user: User | null) => !!user && !!poll.settings.jury?.includes(user.id)

export function entriesFor(db: DB, poll: Poll, who: Who): PollEntry[] {
  if (poll.type !== 'ideas' && poll.type !== 'contest') return []
  const manager = canEdit(who.access)
  const mineKey = who.user ? voterKey(poll, who.user.id) : null
  const jury = !!poll.settings.jury?.length
  const all = db.responses.filter(r => r.pollId === poll.id && r.kind === 'entry')
  const voted = !!who.user && all.some(r => r.votes?.[who.user!.id] !== undefined)
  const showScores = manager || resultsVisible(poll, voted)
  // concurso: enquanto recebe candidaturas, cada pessoa só vê as suas
  const hideOthers = poll.type === 'contest' && poll.settings.phase !== 'vote' && !isClosed(poll) && !manager
  return all
    .filter(r => (manager || !r.hidden) && (!hideOthers || r.voter === mineKey))
    .map(r => {
      const author = !poll.settings.anonymous && r.userId ? db.users.find(u => u.id === r.userId) : undefined
      const s = entryScore(r.votes, poll.type === 'contest' && jury)
      return {
        id: r.id,
        text: r.text ?? '',
        details: r.details,
        answers: r.answers,
        author: poll.settings.anonymous ? undefined : author?.name ?? r.name,
        authorPicture: author?.picture,
        mine: !!mineKey && r.voter === mineKey,
        status: r.status,
        hidden: r.hidden,
        ...(showScores ? s : {}),
        myVote: who.user ? r.votes?.[who.user.id] : undefined,
        createdAt: r.createdAt,
      }
    })
    .sort((a, z) => (showScores ? (z.score ?? 0) - (a.score ?? 0) : 0) || z.createdAt - a.createdAt)
}

/** Participação nos inquéritos da empresa abertos a todos: quantos já responderam e quem falta */
export function turnout(db: DB, poll: Poll) {
  if (!poll.orgId || poll.sharing.visibility !== 'org' || poll.type === 'ideas' || poll.type === 'contest') return undefined
  const org = db.orgs.find(o => o.id === poll.orgId)
  const people = db.members.filter(m => m.orgId === poll.orgId && m.status === 'activo' && m.userId && m.userId !== org?.createdBy)
  const voters = new Set(db.responses.filter(r => r.pollId === poll.id && r.kind === 'answer').map(r => r.voter))
  const missing = people.filter(m => !voters.has(voterKey(poll, m.userId!)))
  return { total: people.length, answered: people.length - missing.length, missing: missing.map(m => ({ userId: m.userId!, name: m.name, picture: m.picture })) }
}

/** Tudo o que a página de um inquérito precisa, para quem tem conta ou para um visitante */
/** justAnswered: acabou de responder (um visitante sem conta não tem outra forma de o provar) */
export function pollDetail(db: DB, poll: Poll, who: Who, justAnswered = false) {
  const manager = canEdit(who.access)
  const mine = myResponses(db, poll, who.user)
  const answer = mine.find(r => r.kind === 'answer')
  const answered = justAnswered || !!answer || mine.some(r => r.kind === 'entry')
  const votedEntries = !!who.user && db.responses.some(r => r.pollId === poll.id && r.kind === 'entry' && r.votes?.[who.user!.id] !== undefined)
  const showResults = manager || resultsVisible(poll, answered || votedEntries)
  const answers = db.responses.filter(r => r.pollId === poll.id && r.kind === 'answer')
  return {
    poll: who.access ? pollView(poll, who.access) : publicPollView(poll),
    access: who.access,
    phase: phaseOf(poll),
    me: {
      answered,
      // a resposta de cada um só volta a aparecer se a puder mudar
      response: answer && poll.settings.canChange ? { answers: answer.answers, other: answer.other, createdAt: answer.createdAt } : undefined,
      answeredAt: answer?.createdAt,
      block: answerBlock(db, poll, who),
      entryBlock: entryBlock(poll, who),
      isJury: isJury(poll, who.user),
      entries: mine.filter(r => r.kind === 'entry').length,
      votesUsed: who.user ? db.responses.filter(r => r.pollId === poll.id && r.kind === 'entry' && r.votes?.[who.user!.id] !== undefined).length : 0,
    },
    results: showResults && poll.type !== 'ideas' && poll.type !== 'contest' ? summarize(poll, answers) : undefined,
    entries: entriesFor(db, poll, who),
    turnout: manager ? turnout(db, poll) : undefined,
    people: who.access ? peopleOf(db, poll) : [],
    candidates: poll.type === 'election' ? candidatePictures(db, poll) : undefined,
    orgName: db.orgs.find(o => o.id === poll.orgId)?.name,
    requests: who.access === 'owner' ? db.grants.filter(g => g.resourceId === poll.id && g.role === 'pending').length : 0,
  }
}

/** Fotos dos candidatos que são pessoas da empresa */
function candidatePictures(db: DB, poll: Poll) {
  const out: Record<string, string> = {}
  for (const f of poll.fields) for (const o of f.options ?? []) {
    if (!o.userId) continue
    const m = db.members.find(x => x.orgId === poll.orgId && x.userId === o.userId)
    const pic = m?.picture ?? db.users.find(u => u.id === o.userId)?.picture
    if (pic) out[o.id] = pic
  }
  return out
}

export const whoIs = (db: DB, poll: Poll, user: User | null): Who => ({ user, access: accessOf(db, poll, user) })
