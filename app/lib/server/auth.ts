import { auth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server'
import type { User } from '../../types'
import { clerkUserScope } from './scopes'
import { mutate, newId, read } from './store'

/**
 * Sessões geridas pelo Clerk (Google, Microsoft, Apple, Facebook, GitHub, email…).
 * A nossa tabela "users" guarda o perfil da app, ligado ao Clerk pelo clerkId.
 */

/** Utilizador com sessão iniciada; na primeira visita cria-o a partir do perfil do Clerk */
export async function currentUser(): Promise<User | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const existing = (await read(clerkUserScope(clerkId))).users[0]
  return existing ?? provisionUser(clerkId)
}

async function provisionUser(clerkId: string): Promise<User | null> {
  const profile = await clerkCurrentUser()
  if (!profile) return null
  const primary = profile.primaryEmailAddress ?? profile.emailAddresses[0]
  const email = primary?.emailAddress.trim().toLowerCase() ?? ''
  if (!email) return null
  // só um email confirmado pelo Clerk se liga a contas ou convites que já existam
  const verified = primary?.verification?.status === 'verified'
  const name = profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || email.split('@')[0]
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
