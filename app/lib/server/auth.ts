import { auth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server'
import type { User } from '../../types'
import { fail } from './api'
import { clerkUserScope } from './scopes'
import { mutate, newId, read } from './store'

/**
 * Em desenvolvimento, a conta de cada sessão fica guardada uns segundos: cada pedido à API
 * começa por a ler, e a base de dados pode estar longe (~200 ms por ida). Qualquer escrita
 * limpa a cache (ver store.ts). Em produção não se usa: há várias instâncias do servidor e a
 * base de dados está na mesma região, por isso ler é barato e evita dados desactualizados.
 */
const USER_TTL = 10 * 1000
const cache = process.env.NODE_ENV === 'production'
  ? null
  : ((globalThis as unknown as { __neemaUsers?: Map<string, { user: User; at: number }> }).__neemaUsers ??= new Map())

export async function currentUser(): Promise<User | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const hit = cache?.get(clerkId)
  if (hit && Date.now() - hit.at < USER_TTL) return structuredClone(hit.user)
  const existing = (await read(clerkUserScope(clerkId))).users[0]
  if (existing && cache) cache.set(clerkId, { user: structuredClone(existing), at: Date.now() })
  return existing ?? provisionUser(clerkId)
}

/** Sem nome no login: "joao.silva@x.pt" → "Joao Silva" (em vez de "joao.silva") */
export function nameFromEmail(email: string) {
  const words = email.split('@')[0].split(/[._\-+]+/).filter(w => w && !/^\d+$/.test(w))
  const name = words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 60)
  return name || email.split('@')[0] || 'Utilizador'
}

async function provisionUser(clerkId: string): Promise<User | null> {
  const profile = await clerkCurrentUser()
  if (!profile) return null
  const primary = profile.primaryEmailAddress ?? profile.emailAddresses[0]
  const email = primary?.emailAddress.trim().toLowerCase() ?? ''
  // sem email não há conta na app; um erro claro em vez de "sem sessão" (que deixava a entrada presa)
  if (!email) fail(409, 'A tua conta não tem email. Entra com um método que partilhe o email (Google, Microsoft ou email e código).')
  // só um email confirmado pelo Clerk se liga a contas ou convites que já existam
  const verified = primary?.verification?.status === 'verified'
  const name = profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || nameFromEmail(email)
  const picture = profile.hasImage ? profile.imageUrl : undefined

  return mutate(
    async l => {
      await l.load('users', { clerk_id: clerkId })
      if (verified) {
        await l.load('users', { email })
        await l.load('members', { email })
      }
    },
    db => {
      let user = db.users.find(u => u.clerkId === clerkId) ?? (verified ? db.users.find(u => u.email === email && !u.clerkId) : undefined)
      if (user) {
        user.clerkId = clerkId
        user.picture = picture ?? user.picture
        if (verified) user.emailVerified = true
      } else {
        user = {
          id: newId(),
          clerkId,
          email,
          name,
          picture,
          createdAt: Date.now(),
          rankingVisibility: 'nome',
          emailVerified: verified,
        }
        db.users.push(user)
      }
      // funcionários adicionados à mão ou por importação, à espera desta pessoa
      // (contas pessoais e contas de empresa ficam de fora)
      if (verified && user.accountType !== 'personal' && user.businessRole !== 'company') {
        for (const m of db.members) {
          if (m.status === 'pendente' && m.email === email && !m.userId) {
            user.accountType = 'business'
            user.businessRole = 'employee'
            m.userId = user.id
            m.status = 'activo'
            m.joinedAt = Date.now()
            m.picture = user.picture
            if (!m.name) m.name = user.name
          }
        }
      }
      return user
    },
  )
}
