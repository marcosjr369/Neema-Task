import { body, fail, handle, requireMemberWith, requireUser } from '../../lib/server/api'
import { MAX_POLLS, asPollError, voterKey } from '../../lib/server/polls'
import { accessOf, loadMine, summaryBase } from '../../lib/server/shared'
import { canEdit, shareToken } from '../../lib/server/sharing'
import { mutate, newId, read } from '../../lib/server/store'
import { canUse } from '../../lib/permissions'
import { POLL_LIMITS, POLL_TYPES, cleanFields, defaultSettings, defaultTheme, phaseOf, starter } from '../../lib/polls'
import type { Poll, PollSummary, PollType, ShareVisibility } from '../../types'

/** Inquéritos a que tenho acesso: os meus, os das empresas onde estou e os partilhados comigo */
export const GET = handle(async () => {
  const user = await requireUser()
  const db = await read(async l => {
    await loadMine(user, 'polls', l)
    // já respondi? (nos anónimos, o código de quem vota muda de inquérito para inquérito)
    await l.load('responses', { voter: [user.id, ...l.db.polls.filter(p => p.settings.anonymous).map(p => voterKey(p, user.id))] })
  })
  const polls: PollSummary[] = []
  for (const p of db.polls) {
    const access = accessOf(db, p, user)
    // os rascunhos só aparecem a quem os prepara
    if (!access || (p.status === 'draft' && !canEdit(access))) continue
    const key = voterKey(p, user.id)
    polls.push({
      ...summaryBase(db, p, user, access),
      type: p.type,
      status: phaseOf(p),
      count: p.count,
      closesAt: p.status === 'open' ? p.settings.closesAt : undefined,
      answered: db.responses.some(r => r.pollId === p.id && r.voter === key),
    })
  }
  polls.sort((a, z) => z.updatedAt - a.updatedAt)
  return { polls }
})

/** Novo inquérito (rascunho), em branco ou com o exemplo do tipo */
export const POST = handle(async req => {
  const input = await body<{ type?: PollType; title?: string; orgId?: string; visibility?: ShareVisibility; sample?: boolean }>(req)
  const type = POLL_TYPES.includes(input.type as PollType) ? (input.type as PollType) : fail(400, 'Escolhe o tipo de inquérito')
  const start = starter(type, !!input.sample)
  const title = (String(input.title ?? '').trim() || start.title).slice(0, POLL_LIMITS.title)
  if (!title) fail(400, 'Dá um nome ao inquérito')
  // na empresa, só quem tem permissão cria (Definições → Permissões)
  const access = input.orgId ? await requireMemberWith(input.orgId, 'inqueritos') : null
  const user = access ? access.user : await requireUser()
  // os formulários vêm abertos ao link: só se a pessoa puder abrir inquéritos a pessoas de fora
  const settings = defaultSettings(type)
  if (access && settings.publicLink && !canUse(access.org.permissions, access.db.departments.filter(d => d.orgId === access.org.id), access.me, 'formulariosPublicos')) settings.publicLink = false
  const visibility: ShareVisibility = input.orgId ? (input.visibility === 'private' ? 'private' : 'org') : input.visibility === 'link' ? 'link' : 'private'
  const fields = asPollError(() => cleanFields(type, start.fields))

  // na empresa com aparência própria, o formulário nasce com a cor principal da empresa
  const brandColor = access?.org.brand?.primary
  const now = Date.now()
  return mutate(
    async l => { await l.load('polls', { owner_id: user.id }) },
    db => {
      if (db.polls.filter(p => p.ownerId === user.id).length >= MAX_POLLS) fail(400, `Já tens ${MAX_POLLS} inquéritos. Apaga algum antes de criar outro.`)
      const poll: Poll = {
        id: newId(),
        title,
        description: start.description,
        type,
        orgId: input.orgId || undefined,
        ownerId: user.id,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        fields,
        settings,
        theme: brandColor ? { ...defaultTheme(type), color: brandColor } : defaultTheme(type),
        count: 0,
        // na empresa, os colegas respondem; gerir fica com o dono, os administradores e quem for convidado a editar
        sharing: { visibility, orgRole: input.orgId ? 'view' : undefined, token: shareToken() },
      }
      db.polls.push(poll)
      return { id: poll.id }
    },
  )
})
