import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Department, Member, Org, User } from '../app/types'
import {
  backgroundCss, backgroundFor, cleanBrand, contrast, mergeBrand, pageKeyOf, palette, paletteVars, readableOnWhiteText, resolveBrand,
} from '../app/lib/brand'

process.env.NEEMA_DATA_DIR = '.data-test/brand'

/* ─── Regras ─── */

const dept = (id: string, parentId?: string, brand?: Department['brand']): Department =>
  ({ id, orgId: 'o', name: id, color: '#000', supervisorIds: [], parentId, brand })

describe('aparência: herança e regras', () => {
  const org = { primary: '#1F6FEB', font: 'inter', logo: 'brand-o-logo1234', background: { kind: 'preset' as const, value: 'dots' } }
  const tree = [
    dept('vendas', undefined, { primary: '#F97316', pages: { inicio: { kind: 'color', value: '#FFF6E5' } } }),
    dept('norte', 'vendas', { secondary: '#0E9F6E', background: null }),
    dept('ti'),
  ]

  it('o departamento muda só o que define; o resto (e o logótipo) vem da empresa', () => {
    const t = resolveBrand(org, tree, 'norte')
    expect(t).toMatchObject({ primary: '#F97316', secondary: '#0E9F6E', font: 'inter', logo: 'brand-o-logo1234', background: null })
    expect(t.pages?.inicio).toEqual({ kind: 'color', value: '#FFF6E5' })
    // quem não tem departamento personalizado vê a da empresa
    expect(resolveBrand(org, tree, 'ti')).toMatchObject({ primary: '#1F6FEB', background: { kind: 'preset', value: 'dots' } })
    expect(resolveBrand(org, tree, undefined).primary).toBe('#1F6FEB')
  })

  it('o fundo da página ganha ao geral; páginas sem fundo próprio usam o geral', () => {
    const t = mergeBrand(org, { pages: { tarefas: null, inicio: { kind: 'color', value: '#EEEEEE' } } })
    expect(backgroundFor(t, '/')).toEqual({ kind: 'color', value: '#EEEEEE' })
    expect(backgroundFor(t, '/tarefas/abc')).toBeNull()
    expect(backgroundFor(t, '/calendario')).toEqual({ kind: 'preset', value: 'dots' })
    // os editores (quadro aberto) têm o seu próprio fundo
    expect(pageKeyOf('/quadros/123')).toBeUndefined()
    expect(pageKeyOf('/empresa/pessoas')).toBe('empresa')
  })

  it('cores: versão escura e clara, e aviso quando o texto branco não se lê', () => {
    const v = paletteVars({ primary: '#7B61FF' })
    expect(v['--color-brand']).toBe('#7B61FF')
    expect(v['--color-brand-dark']).toMatch(/^#[0-9A-F]{6}$/)
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21)
    expect(readableOnWhiteText('#7B61FF')).toBe(true)
    expect(readableOnWhiteText('#FFE680')).toBe(false)
  })

  it('cor clara (ex.: branco): botões com letra escura e textos num tom que se lê', () => {
    const w = palette('#FFFFFF')
    expect(w.on).toBe('#2B2840')
    expect(contrast(w.dark, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    const gold = palette('#BCAE87')
    expect(gold.on).toBe('#2B2840')
    expect(contrast(gold.dark, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(palette('#1F6FEB').on).toBe('#FFFFFF')
    const v = paletteVars({ primary: '#FFFFFF', text: '#111827' })
    expect(v).toMatchObject({ '--color-on-brand': '#2B2840', '--color-ink': '#111827' })
  })

  it('o "clarear" põe uma camada branca por cima do fundo', () => {
    expect(backgroundCss({ kind: 'color', value: '#112233', soften: 50 }, '#7B61FF', id => id)).toContain('rgb(255 255 255 / 0.5)')
    expect(backgroundCss({ kind: 'image', image: 'brand-x', soften: 0 }, '#7B61FF', id => `/img/${id}`)).toContain('url("/img/brand-x")')
  })

  it('valida o que chega: cores, letras, páginas e imagens; só a empresa tem logótipo', () => {
    expect(() => cleanBrand({ primary: 'red' }, true)).toThrow('Cor principal')
    expect(() => cleanBrand({ font: 'comic' }, true)).toThrow('letra')
    expect(() => cleanBrand({ background: { kind: 'image', image: '../segredo' } }, true)).toThrow()
    const ok = cleanBrand({ primary: '#abcdef', logo: 'brand-o-12345678', pages: { inicio: null, inexistente: { kind: 'color', value: '#FFFFFF' } } }, false)
    expect(ok).toEqual({ primary: '#ABCDEF', pages: { inicio: null } })
  })
})

/* ─── API ─── */

const base = { createdAt: 0, rankingVisibility: 'nome' as const, accountType: 'business' as const }
const users: Record<string, User> = {
  adm: { ...base, id: 'u-adm', email: 'adm@x.pt', name: 'Adm' },
  chefe: { ...base, id: 'u-chefe', email: 'chefe@x.pt', name: 'Chefe' },
  ana: { ...base, id: 'u-ana', email: 'ana@x.pt', name: 'Ana' },
  fora: { ...base, id: 'u-fora', email: 'fora@x.pt', name: 'Fora' },
}
let as: User = users.adm

vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const orgId = 'org-brand'
const call = async (handler: unknown, method: string, params: Record<string, string>, body?: unknown) => {
  const req = new Request('http://t/x', { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const res = await (handler as (r: Request, c: unknown) => Promise<Response>)(req, { params: Promise.resolve(params) })
  return { status: res.status, json: await res.json() }
}
const m = (id: string, userId: string, role: Member['role'], departmentId?: string, org = orgId): Member =>
  ({ id, orgId: org, userId, email: `${id}@x.pt`, name: id, role, status: 'activo', presence: 'offline', joinedAt: 1, consentAt: 1, departmentId })

beforeAll(async () => {
  rmSync('.data-test/brand', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  const org: Org = { id: orgId, name: 'Acme', sector: 'Outro', inviteCode: 'BRAND1', createdAt: 0, createdBy: 'u-adm' }
  const other: Org = { id: 'org-outra', name: 'Outra', sector: 'Outro', inviteCode: 'BRAND2', createdAt: 0, createdBy: 'u-fora' }
  await mutate('all', db => {
    db.users.push(...Object.values(users))
    db.orgs.push(org, other)
    db.departments.push(
      { id: 'd-vendas', orgId, name: 'Vendas', color: '#000', supervisorIds: ['m-chefe'] },
      { id: 'd-norte', orgId, name: 'Norte', color: '#000', supervisorIds: [], parentId: 'd-vendas' },
      { id: 'd-ti', orgId, name: 'TI', color: '#000', supervisorIds: [] },
    )
    db.members.push(m('m-adm', 'u-adm', 'admin'), m('m-chefe', 'u-chefe', 'supervisor', 'd-vendas'), m('m-ana', 'u-ana', 'membro', 'd-norte'), m('m-fora', 'u-fora', 'admin', undefined, 'org-outra'))
  })
})

describe('API da aparência', () => {
  const route = () => import('../app/api/orgs/[orgId]/marca/route')
  const images = () => import('../app/api/orgs/[orgId]/marca/imagem/route')
  const upload = async (org = orgId) => {
    const form = new FormData()
    form.set('file', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9])], 'logo.png', { type: 'image/png' }))
    const res = await (await images()).POST(new Request('http://t/x', { method: 'POST', body: form }), { params: Promise.resolve({ orgId: org }) })
    return { status: res.status, json: await res.json() }
  }

  it('o administrador muda a da empresa, com logótipo', async () => {
    as = users.adm
    const logo = (await upload()).json.id as string
    expect(logo.startsWith(`brand-${orgId}-`)).toBe(true)
    const r = await call((await route()).PATCH, 'PATCH', { orgId }, { brand: { primary: '#1F6FEB', logo, font: 'poppins' } })
    expect(r.status).toBe(200)
    expect(r.json.brand).toMatchObject({ primary: '#1F6FEB', logo, font: 'poppins', updatedBy: 'u-adm' })
  })

  it('a chefia muda o seu departamento (e os de baixo), mas não a empresa nem outros', async () => {
    as = users.chefe
    expect((await call((await route()).PATCH, 'PATCH', { orgId }, { departmentId: 'd-vendas', brand: { primary: '#F97316' } })).status).toBe(200)
    expect((await call((await route()).PATCH, 'PATCH', { orgId }, { departmentId: 'd-norte', brand: { secondary: '#0E9F6E' } })).status).toBe(200)
    expect((await call((await route()).PATCH, 'PATCH', { orgId }, { departmentId: 'd-ti', brand: { primary: '#000000' } })).status).toBe(403)
    expect((await call((await route()).PATCH, 'PATCH', { orgId }, { brand: { primary: '#000000' } })).status).toBe(403)
  })

  it('quem não gere não muda nada nem envia imagens', async () => {
    as = users.ana
    expect((await call((await route()).PATCH, 'PATCH', { orgId }, { departmentId: 'd-norte', brand: { primary: '#000000' } })).status).toBe(403)
    expect((await upload()).status).toBe(403)
  })

  it('a Ana (Norte, dentro de Vendas) vê a cor de Vendas, a secundária do Norte e a letra da empresa', async () => {
    const { read } = await import('../app/lib/server/store')
    const db = await read('all')
    const t = resolveBrand(db.orgs.find(o => o.id === orgId)!.brand, db.departments.filter(d => d.orgId === orgId), 'd-norte')
    expect(t).toMatchObject({ primary: '#F97316', secondary: '#0E9F6E', font: 'poppins' })
  })

  it('imagens: nunca de outra empresa, e a imagem antiga apaga-se ao trocar', async () => {
    as = users.fora
    const foreign = (await upload('org-outra')).json.id as string
    as = users.adm
    expect((await call((await route()).PATCH, 'PATCH', { orgId }, { brand: { logo: foreign } })).status).toBe(400)
    const get = async (f: string) => (await (await images()).GET(new Request(`http://t/x?f=${f}`), { params: Promise.resolve({ orgId }) })).status
    expect(await get(foreign)).toBe(404)

    const { read } = await import('../app/lib/server/store')
    const old = (await read('all')).orgs.find(o => o.id === orgId)!.brand!.logo!
    expect(await get(old)).toBe(200)
    const next = (await upload()).json.id as string
    await call((await route()).PATCH, 'PATCH', { orgId }, { brand: { primary: '#1F6FEB', logo: next } })
    const { readFile } = await import('../app/lib/server/files')
    expect(await readFile(old)).toBeNull()
  })

  it('"Usar a da empresa": o departamento perde a aparência própria', async () => {
    as = users.chefe
    const r = await call((await route()).PATCH, 'PATCH', { orgId }, { departmentId: 'd-norte', brand: null })
    expect(r.json.departments.find((d: { id: string }) => d.id === 'd-norte').brand).toBeUndefined()
  })
})
