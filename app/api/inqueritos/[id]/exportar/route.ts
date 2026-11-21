import { fail, handle, requireUser } from '../../../../lib/server/api'
import { entriesFor, findPoll, pollScope, whoIs } from '../../../../lib/server/polls'
import { canEdit, shareToken } from '../../../../lib/server/sharing'
import { mutate, newId } from '../../../../lib/server/store'
import { cleanTab } from '../../../../lib/sheets/ops'
import { MAX_COLS, MAX_ROWS, cellKey } from '../../../../lib/sheets/refs'
import { IDEA_STATUS, responseTable } from '../../../../lib/polls'
import { canUse } from '../../../../lib/permissions'
import type { CellFmt, Sheet } from '../../../../types'

/** Cria uma planilha com as respostas (ou as ideias/candidaturas) e devolve o id */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  return mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const who = whoIs(db, poll, user)
    if (!canEdit(who.access)) fail(403, 'Só quem gere o inquérito exporta as respostas')

    let table: string[][]
    if (poll.type === 'ideas' || poll.type === 'contest') {
      const jury = !!poll.settings.jury?.length
      const anon = poll.settings.anonymous
      table = [
        ['Título', 'Detalhes', ...(anon ? [] : ['Autor']), jury ? 'Nota média' : 'Votos', ...(poll.type === 'ideas' ? ['Estado'] : [])],
        ...entriesFor(db, poll, who).map(e => [
          e.text, e.details ?? '', ...(anon ? [] : [e.author ?? '']), String(e.score ?? 0),
          ...(poll.type === 'ideas' ? [IDEA_STATUS[e.status ?? 'new'].name] : []),
        ]),
      ]
    } else {
      const rows = db.responses
        .filter(r => r.pollId === poll.id && r.kind === 'answer')
        .sort((a, z) => a.createdAt - z.createdAt)
        .map(r => ({ ...r, name: r.userId ? db.users.find(u => u.id === r.userId)?.name ?? r.name : r.name }))
      table = responseTable(poll, rows, !poll.settings.anonymous)
    }
    table = table.slice(0, MAX_ROWS - 1)
    const cols = Math.min(table[0].length, MAX_COLS)

    const cells: Record<string, string> = {}
    table.forEach((row, r) => row.slice(0, cols).forEach((v, c) => {
      // o texto das respostas nunca vira fórmula na planilha
      if (v !== '') cells[cellKey(r, c)] = (v.startsWith('=') ? `'${v}` : v).slice(0, 5000)
    }))
    const fmt: Record<string, CellFmt> = {}
    const widths: Record<string, number> = {}
    for (let c = 0; c < cols; c++) {
      fmt[cellKey(0, c)] = { b: true, bg: '#EEEAFF' }
      widths[String(c)] = c === 0 ? 140 : 200
    }

    // na empresa (se lá estiver e puder criar planilhas: Definições → Permissões) fica privada da empresa; senão, pessoal
    // (sem permissão para criar planilhas na empresa, fica nas pessoais)
    const me = poll.orgId ? db.members.find(m => m.orgId === poll.orgId && m.userId === user.id && m.status === 'activo') : undefined
    const org = db.orgs.find(o => o.id === poll.orgId)
    const inOrg = !!me && !!org && canUse(org.permissions, db.departments.filter(d => d.orgId === org.id), me, 'planilhas')
    const now = Date.now()
    const sheet: Sheet = {
      id: newId(),
      title: `Respostas: ${poll.title}`.slice(0, 80),
      orgId: inOrg ? poll.orgId : undefined,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
      tabs: [cleanTab({ rows: Math.max(table.length + 5, 20), cols: Math.max(cols, 6), cells, fmt, widths }, newId(), 'Respostas')],
      sharing: { visibility: 'private', orgRole: inOrg ? 'edit' : undefined, token: shareToken() },
    }
    db.sheets.push(sheet)
    return { id: sheet.id }
  })
})
