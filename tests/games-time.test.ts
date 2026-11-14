import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '../app/types'
import { playTotals, topGames } from '../app/lib/games'

/*
 * Tempo nos jogos: guardar (com o funcionário, no espaço da empresa), juntar visitas seguidas
 * e o relatório que só a administração vê.
 */
process.env.NEEMA_DATA_DIR = '.data-test/games-time'

const u = (id: string): User => ({ id, email: `${id}@x.pt`, name: id, createdAt: 0, rankingVisibility: 'nome' })
const admin = u('u-admin'), ana = u('u-ana'), rui = u('u-rui'), fora = u('u-fora')
let as: User | null = ana

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>
async function call(handler: unknown, method: string, body?: unknown, url = 'http://t/x', params: Record<string, string> = {}) {
  const res = await (handler as Handler)(
    new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
    { params: Promise.resolve(params) },
  )
  return { status: res.status, json: await res.json() }
}
const db = async () => (await import('../app/lib/server/store')).read()
const tempo = async (body: unknown) => call((await import('../app/api/jogos/tempo/route')).POST, 'POST', body)
const report = async (from = 0) => call((await import('../app/api/orgs/[orgId]/jogos/route')).GET, 'GET', undefined, `http://t/x?from=${from}`, { orgId: 'o1' })

const now = Date.now()
const min = 60_000

beforeAll(async () => {
  rmSync('.data-test/games-time', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  await mutate('all', d => {
    d.users.push(admin, ana, rui, fora)
    d.orgs.push({ id: 'o1', name: 'Acme', sector: '', inviteCode: 'ACME01', createdAt: 0, createdBy: 'u-admin' })
    d.members.push(
      { id: 'm-admin', orgId: 'o1', userId: 'u-admin', email: 'a@x', name: 'Admin', role: 'admin', status: 'activo', presence: 'offline' },
      { id: 'm-ana', orgId: 'o1', userId: 'u-ana', email: 'ana@x', name: 'Ana', role: 'membro', status: 'activo', presence: 'offline' },
      { id: 'm-rui', orgId: 'o1', userId: 'u-rui', email: 'rui@x', name: 'Rui', role: 'supervisor', status: 'activo', presence: 'offline' },
    )
  })
})

describe('guardar o tempo a jogar', () => {
  it('no espaço da empresa fica ligado ao funcionário', async () => {
    as = ana
    expect((await tempo({ game: 'sudoku', start: now - 10 * min, end: now - 4 * min, seconds: 300, orgId: 'o1' })).status).toBe(200)
    const play = (await db()).plays.find(p => p.userId === 'u-ana')!
    expect(play).toMatchObject({ game: 'sudoku', seconds: 300, orgId: 'o1', memberId: 'm-ana' })
  })

  it('voltar ao mesmo jogo logo a seguir junta tudo numa visita', async () => {
    as = ana
    await tempo({ game: 'sudoku', start: now - 3 * min, end: now - 2 * min, seconds: 50, orgId: 'o1' })
    const mine = (await db()).plays.filter(p => p.userId === 'u-ana' && p.game === 'sudoku')
    expect(mine).toHaveLength(1)
    expect(mine[0].seconds).toBe(350)
    expect(mine[0].end).toBe(now - 2 * min)
  })

  it('outro jogo, ou muito tempo depois, é outra visita', async () => {
    as = ana
    await tempo({ game: 'galo', start: now - 90 * 1000, end: now - 30 * 1000, seconds: 60, orgId: 'o1' })
    expect((await db()).plays.filter(p => p.userId === 'u-ana')).toHaveLength(2)
  })

  it('quem não é da empresa não conta para ela (fica só pessoal)', async () => {
    as = fora
    await tempo({ game: 'cores', start: now - 2 * min, end: now - min, seconds: 45, orgId: 'o1' })
    const play = (await db()).plays.find(p => p.userId === 'u-fora')!
    expect(play.orgId).toBeUndefined()
    expect(play.memberId).toBeUndefined()
  })

  it('ignora visitas curtas e não aceita mais tempo do que o período', async () => {
    as = rui
    expect((await tempo({ game: 'pares', start: now - 10_000, end: now, seconds: 3, orgId: 'o1' })).json.skipped).toBe(true)
    await tempo({ game: 'pares', start: now - 60_000, end: now, seconds: 5000, orgId: 'o1' })
    const play = (await db()).plays.find(p => p.userId === 'u-rui')!
    expect(play.seconds).toBeLessThanOrEqual(65)
  })

  it('recusa jogos e períodos impossíveis, e sem sessão', async () => {
    as = ana
    expect((await tempo({ game: 'xadrez', start: now - min, end: now, seconds: 30 })).status).toBe(400)
    expect((await tempo({ game: 'galo', start: now, end: now + 10 * min, seconds: 30 })).status).toBe(400)
    expect((await tempo({ game: 'galo', start: now, end: now - min, seconds: 30 })).status).toBe(400)
    expect((await tempo({ game: 'galo', start: now - 3 * 86_400_000, end: now - 3 * 86_400_000 + min, seconds: 30 })).status).toBe(400)
    as = null
    expect((await tempo({ game: 'galo', start: now - min, end: now, seconds: 30 })).status).toBe(401)
  })
})

describe('relatório da empresa', () => {
  it('a administração vê o tempo por pessoa e por jogo', async () => {
    as = admin
    const res = await report()
    expect(res.status).toBe(200)
    const anaRow = res.json.members.find((m: { memberId: string }) => m.memberId === 'm-ana')
    expect(anaRow).toMatchObject({ seconds: 410, sessions: 2, games: { sudoku: 350, galo: 60 } })
    expect(res.json.games).toMatchObject({ sudoku: 350, galo: 60 })
    // o tempo pessoal de quem não é da empresa não aparece
    expect(res.json.members.some((m: { memberId: string }) => !m.memberId.startsWith('m-'))).toBe(false)
  })

  it('o período filtra pelo início da visita', async () => {
    as = admin
    const res = await report(now - 5 * min)
    const anaRow = res.json.members.find((m: { memberId: string }) => m.memberId === 'm-ana')
    expect(anaRow.games.sudoku).toBeUndefined()
    expect(anaRow.games.galo).toBe(60)
  })

  it('funcionários e supervisores não vêem', async () => {
    as = ana
    expect((await report()).status).toBe(403)
    as = rui
    expect((await report()).status).toBe(403)
    as = fora
    expect((await report()).status).toBe(403)
  })
})

describe('somas', () => {
  it('soma por pessoa e por jogo, e ordena os jogos', () => {
    const { byMember, byGame } = playTotals([
      { memberId: 'a', game: 'galo', seconds: 30, end: 5 },
      { memberId: 'a', game: 'forca', seconds: 90, end: 9 },
      { memberId: 'b', game: 'galo', seconds: 10, end: 3 },
      { game: 'galo', seconds: 999, end: 1 }, // sem funcionário (pessoal): não conta
    ])
    expect(byMember.get('a')).toEqual({ seconds: 120, sessions: 2, lastAt: 9, games: { galo: 30, forca: 90 } })
    expect(byGame).toEqual({ galo: 40, forca: 90 })
    expect(topGames(byMember.get('a')!.games).map(([g]) => g)).toEqual(['forca', 'galo'])
  })
})
