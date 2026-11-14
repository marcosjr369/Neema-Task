import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'

/*
 * Primeira entrada de alguém (conta do Clerk → conta da app). Simula o Clerk e corre o código
 * de verdade de app/lib/server/auth.ts: ligar contas e convites que já existiam só com email
 * confirmado, não criar contas repetidas, e um erro claro quando o login não traz email.
 */
process.env.NEEMA_DATA_DIR = '.data-test/provision'

type Profile = {
  email?: string
  verified?: boolean
  name?: string
}
let session: { clerkId: string | null; profile: Profile | null } = { clerkId: null, profile: null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: session.clerkId }),
  currentUser: async () => {
    const p = session.profile
    if (!p) return null
    const addr = p.email === undefined ? undefined : { emailAddress: p.email, verification: { status: p.verified === false ? 'unverified' : 'verified' } }
    return {
      primaryEmailAddress: addr ?? null,
      emailAddresses: addr ? [addr] : [],
      fullName: p.name ?? null,
      firstName: null,
      lastName: null,
      hasImage: false,
      imageUrl: '',
    }
  },
}))

const login = (clerkId: string, profile: Profile) => { session = { clerkId, profile } }
const db = async () => (await import('../app/lib/server/store')).read()

beforeAll(async () => {
  rmSync('.data-test/provision', { recursive: true, force: true })
  const { mutate } = await import('../app/lib/server/store')
  await mutate('all', d => {
    d.orgs.push({ id: 'o1', name: 'Acme', sector: '', inviteCode: 'ACME01', createdAt: 0, createdBy: 'u-dono' })
    // funcionário adicionado à mão, à espera de entrar
    d.members.push({ id: 'm-ana', orgId: 'o1', email: 'ana@acme.pt', name: '', role: 'membro', status: 'pendente', presence: 'offline' })
    d.members.push({ id: 'm-bia', orgId: 'o1', email: 'bia@acme.pt', name: 'Bia', role: 'membro', status: 'pendente', presence: 'offline' })
    // conta antiga, de antes do Clerk
    d.users.push({ id: 'u-velha', email: 'velha@x.pt', name: 'Velha', createdAt: 0, rankingVisibility: 'nome' })
  })
})

describe('primeira entrada (provisionar a conta)', () => {
  it('sem sessão: ninguém', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    session = { clerkId: null, profile: null }
    expect(await currentUser()).toBeNull()
  })

  it('conta nova: email em minúsculas, nome do Clerk (ou do email), sem tipo', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-novo', { email: '  Novo@Gmail.com ', name: '' })
    const user = await currentUser()
    expect(user).toMatchObject({ clerkId: 'c-novo', email: 'novo@gmail.com', name: 'Novo', emailVerified: true })
    expect(user!.accountType).toBeUndefined()
  })

  it('voltar a entrar não cria outra conta (nem em pedidos ao mesmo tempo)', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-novo', { email: 'novo@gmail.com' })
    const again = await Promise.all([currentUser(), currentUser(), currentUser()])
    expect(new Set(again.map(x => x!.id)).size).toBe(1)
    expect((await db()).users.filter(x => x.clerkId === 'c-novo')).toHaveLength(1)
  })

  it('pedidos ao mesmo tempo na primeiríssima entrada: uma só conta', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-pressa', { email: 'pressa@gmail.com' })
    const all = await Promise.all([currentUser(), currentUser(), currentUser(), currentUser()])
    expect(new Set(all.map(x => x!.id)).size).toBe(1)
    expect((await db()).users.filter(x => x.clerkId === 'c-pressa')).toHaveLength(1)
  })

  it('funcionário à espera, email confirmado: fica activo e a conta é de funcionário', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-ana', { email: 'ana@acme.pt', name: 'Ana Silva' })
    const user = await currentUser()
    expect(user).toMatchObject({ accountType: 'business', businessRole: 'employee' })
    const m = (await db()).members.find(x => x.id === 'm-ana')!
    expect(m).toMatchObject({ status: 'activo', userId: user!.id, name: 'Ana Silva' })
  })

  it('email por confirmar: não ocupa o lugar de ninguém', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-bia-falsa', { email: 'bia@acme.pt', verified: false })
    const user = await currentUser()
    expect(user!.accountType).toBeUndefined()
    expect(user!.emailVerified).toBe(false)
    expect((await db()).members.find(x => x.id === 'm-bia')).toMatchObject({ status: 'pendente' })
  })

  it('conta antiga com o mesmo email: só se liga com email confirmado', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-velha-falsa', { email: 'velha@x.pt', verified: false })
    expect((await currentUser())!.id).not.toBe('u-velha')
    login('c-velha', { email: 'velha@x.pt' })
    expect(await currentUser()).toMatchObject({ id: 'u-velha', clerkId: 'c-velha', emailVerified: true })
  })

  it('nome tirado do email quando o login não traz nome', async () => {
    const { nameFromEmail } = await import('../app/lib/server/auth')
    expect(nameFromEmail('joao.silva@x.pt')).toBe('Joao Silva')
    expect(nameFromEmail('ana_m-2024@x.pt')).toBe('Ana M')
    expect(nameFromEmail('123@x.pt')).toBe('123')
  })

  it('login sem email: erro claro (409), não "sem sessão"', async () => {
    const { currentUser } = await import('../app/lib/server/auth')
    login('c-sem-email', {})
    await expect(currentUser()).rejects.toMatchObject({ status: 409 })
  })
})
