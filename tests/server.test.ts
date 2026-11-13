import { describe, expect, it } from 'vitest'
import { accessKey, best, canEdit, checkPassword, cleanEmail, grantOf, hashPassword, resolveAccess, shareToken, validKey } from '../app/lib/server/sharing'
import { matchRoute } from '../app/lib/server/routes'
import { cleanPreview, cleanXml, EMPTY_DIAGRAM } from '../app/lib/server/diagrams'
import { HttpError } from '../app/lib/server/api'
import type { Member, ShareGrant, User } from '../app/types'

const user = (p: Partial<User> = {}): User => ({ id: 'u1', email: 'ana@x.pt', name: 'Ana', createdAt: 0, rankingVisibility: 'nome', ...p })
const member = (p: Partial<Member> = {}): Member => ({ id: 'm1', orgId: 'o1', userId: 'u1', role: 'membro', status: 'activo', name: 'Ana', email: 'ana@x.pt', ...p } as Member)
const grant = (p: Partial<ShareGrant>): ShareGrant => ({ id: 'g', resourceId: 'r1', kind: 'board', email: 'ana@x.pt', role: 'view', createdAt: 0, ...p })
const resource = (p: object = {}) => ({ id: 'r1', ownerId: 'dono', sharing: { visibility: 'private' as const, token: 't' }, ...p })

describe('partilha: quem tem acesso', () => {
  it('o dono é dono; sem sessão ou conta desactivada, nada', () => {
    expect(resolveAccess(resource({ ownerId: 'u1' }), user(), { grants: [] })).toBe('owner')
    expect(resolveAccess(resource(), null, { grants: [] })).toBeNull()
    expect(resolveAccess(resource({ ownerId: 'u1' }), user({ disabled: true }), { grants: [] })).toBeNull()
  })
  it('convite por email dá o papel do convite; pedido pendente não dá acesso', () => {
    expect(resolveAccess(resource(), user(), { grants: [grant({ role: 'edit' })] })).toBe('edit')
    expect(resolveAccess(resource(), user(), { grants: [grant({ role: 'pending' })] })).toBeNull()
  })
  it('email por confirmar não usa convites por email (só por id)', () => {
    const u = user({ emailVerified: false })
    expect(resolveAccess(resource(), u, { grants: [grant({ role: 'edit' })] })).toBeNull()
    expect(resolveAccess(resource(), u, { grants: [grant({ role: 'edit', userId: 'u1', email: 'outro@x.pt' })] })).toBe('edit')
  })
  it('empresa: "org" dá acesso aos membros activos; admin é dono; inactivos não', () => {
    const r = resource({ orgId: 'o1', sharing: { visibility: 'org', orgRole: 'view', token: 't' } })
    expect(resolveAccess(r, user(), { member: member(), grants: [] })).toBe('view')
    expect(resolveAccess(r, user(), { member: { ...member(), role: 'admin' }, grants: [] })).toBe('owner')
    expect(resolveAccess(r, user(), { member: { ...member(), status: 'pendente' } as Member, grants: [] })).toBeNull()
    const priv = resource({ orgId: 'o1', sharing: { visibility: 'private', token: 't' } })
    expect(resolveAccess(priv, user(), { member: member(), grants: [] })).toBeNull()
  })
  it('vale o melhor acesso entre convite e empresa', () => {
    const r = resource({ orgId: 'o1', sharing: { visibility: 'org', orgRole: 'view', token: 't' } })
    expect(resolveAccess(r, user(), { member: member(), grants: [grant({ role: 'edit' })] })).toBe('edit')
    expect(best('view', null, 'edit')).toBe('edit')
    expect(canEdit('view')).toBe(false)
    expect(canEdit('owner')).toBe(true)
  })
  it('grantOf encontra o convite por id ou email confirmado', () => {
    const gs = [grant({ id: 'a', email: 'outro@x.pt' }), grant({ id: 'b' })]
    expect(grantOf(gs, 'r1', user())?.id).toBe('b')
    expect(grantOf(gs, 'r1', null)).toBeUndefined()
  })
})

describe('partilha: senhas e chaves', () => {
  it('a senha guardada confere e outra não', () => {
    const p = hashPassword('segredo1')
    expect(p.hash).not.toContain('segredo1')
    expect(checkPassword('segredo1', p)).toBe(true)
    expect(checkPassword('segredo2', p)).toBe(false)
    expect(checkPassword('', p)).toBe(false)
  })
  it('senhas curtas ou enormes são recusadas', () => {
    expect(() => hashPassword('abc')).toThrow(HttpError)
    expect(() => hashPassword('x'.repeat(101))).toThrow(HttpError)
  })
  it('a chave de acesso vale para aquele recurso e aquela senha', () => {
    const p = hashPassword('segredo1')
    const key = accessKey('r1', p)
    expect(validKey('r1', p, key)).toBe(true)
    expect(validKey('r2', p, key)).toBe(false)
    expect(validKey('r1', hashPassword('segredo1'), key)).toBe(false) // senha mudada: chaves antigas deixam de valer
    expect(validKey('r1', p, 'lixo')).toBe(false)
    expect(validKey('r1', p, null)).toBe(false)
  })
  it('os links de partilha são aleatórios e seguros em URL', () => {
    const a = shareToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,}$/)
    expect(shareToken()).not.toBe(a)
  })
  it('emails são limpos e validados', () => {
    expect(cleanEmail('  Ana@X.PT ')).toBe('ana@x.pt')
    expect(() => cleanEmail('sem-arroba')).toThrow(HttpError)
    expect(() => cleanEmail(42)).toThrow(HttpError)
  })
})

describe('rotas da API', () => {
  it('encontra rotas com parâmetros', () => {
    const r = matchRoute(['diagramas', 'abc-123'])
    expect(r?.params).toEqual({ id: 'abc-123' })
  })
  it('segmentos fixos ganham aos parâmetros', () => {
    expect(matchRoute(['orgs', 'join'])?.params).toEqual({})
    expect(matchRoute(['orgs', 'xyz'])?.params).toEqual({ orgId: 'xyz' })
  })
  it('recusa parâmetros perigosos e rotas inexistentes', () => {
    expect(matchRoute(['diagramas', '..'])).toBeNull()
    expect(matchRoute(['diagramas', 'a%2Fb'])).toBeNull()
    expect(matchRoute(['diagramas', 'a.b'])).toBeNull()
    expect(matchRoute(['nada'])).toBeNull()
    expect(matchRoute([])).toBeNull()
  })
  it('todas as rotas da tabela carregam um módulo com métodos HTTP', async () => {
    const paths = [['me'], ['diagramas'], ['planilhas'], ['quadros'], ['partilha', 'tok']]
    for (const p of paths) {
      const mod = await matchRoute(p)!.load()
      expect(Object.keys(mod).some(k => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(k))).toBe(true)
    }
  })
})

describe('diagramas: validação', () => {
  it('aceita XML do draw.io', () => {
    expect(cleanXml(EMPTY_DIAGRAM)).toBe(EMPTY_DIAGRAM)
    expect(cleanXml('<?xml version="1.0"?>\n<mxfile host="x"><diagram/></mxfile>')).toContain('<mxfile')
    expect(cleanXml('<mxGraphModel><root/></mxGraphModel>')).toContain('mxGraphModel')
  })
  it('recusa o resto', () => {
    expect(() => cleanXml('')).toThrow(HttpError)
    expect(() => cleanXml('<html><script>x</script></html>')).toThrow(HttpError)
    expect(() => cleanXml(123)).toThrow(HttpError)
    expect(() => cleanXml('<mxfile>' + 'x'.repeat(3_000_000))).toThrow(/grande/)
  })
  it('miniatura: só SVG em base64, o resto ignora-se', () => {
    expect(cleanPreview('data:image/svg+xml;base64,PHN2Zy8+')).toBe('data:image/svg+xml;base64,PHN2Zy8+')
    expect(cleanPreview('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined()
    expect(cleanPreview('javascript:alert(1)')).toBeUndefined()
    expect(cleanPreview('data:image/svg+xml;base64,' + 'A'.repeat(500_000))).toBeUndefined()
  })
})

describe('painel de administração', () => {
  it('o cookie da sessão vai para todas as rotas do painel (que passam pelo proxy)', async () => {
    const { PANEL_COOKIE_PATH } = await import('../app/lib/server/panel')
    const { apiUrl } = await import('../app/lib/api')
    for (const route of ['/api/painel/sessao', '/api/painel/resumo', '/api/painel/utilizadores/x', '/api/painel/ranking?a=1']) {
      expect(apiUrl(route).startsWith(PANEL_COOKIE_PATH + '/'), route).toBe(true)
    }
  })
})

describe('base de dados: fila de ligações', () => {
  it('nunca há mais pedidos em curso do que ligações, e todos terminam pela ordem de chegada', async () => {
    const { withSlot } = await import('../app/lib/server/store-pg')
    const max = Number(process.env.DATABASE_POOL_MAX) || 5
    let running = 0
    let peak = 0
    const done: number[] = []
    const job = (i: number) => withSlot(async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise(r => setTimeout(r, 5 + (i % 3)))
      running--
      done.push(i)
      return i
    })
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => job(i)))
    expect(results).toEqual(Array.from({ length: 40 }, (_, i) => i))
    expect(peak).toBe(max)
    expect(done).toHaveLength(40)
  })
  it('um erro liberta a vaga', async () => {
    const { withSlot } = await import('../app/lib/server/store-pg')
    const max = Number(process.env.DATABASE_POOL_MAX) || 5
    await Promise.allSettled(Array.from({ length: max * 2 }, () => withSlot(async () => { throw new Error('falhou') })))
    // se as vagas não fossem libertadas, isto ficava à espera para sempre
    await expect(withSlot(async () => 'ok')).resolves.toBe('ok')
  })
})
