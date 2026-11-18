'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { api, ApiError, errorText, setTokenSource, throttled } from '../lib/api'
import { clearBrowserStorage } from '../lib/browserStorage'
import { accountTypeOf, businessRoleOf } from '../lib/account'
import { isBetter, recordScore } from '../lib/games'
import { DEFAULT_SETTINGS, type AccountType, type BusinessRole, type Member, type Membership, type Org, type RankingVisibility, type Settings, type User, type Workspace, type GameId } from '../types'

type Suggestion = { id: string; name: string; sector: string }
type MeResponse = {
  user: User | null
  memberships: Membership[]
  suggestions: Suggestion[]
  invites: Membership[]
  disabled?: boolean
}
type MeState = MeResponse & { clerkId: string | null; failed?: string }
const SIGNED_OUT: MeResponse = { user: null, memberships: [], invites: [], suggestions: [] }

export type OrgInput = { name: string; sector: string; size?: string; domain?: string; departments?: string[] }

type AccountValue = {
  loading: boolean
  switching: boolean
  disabled: boolean
  failed: string | null
  user: User | null
  accountType: AccountType | undefined
  businessRole: BusinessRole | undefined
  needsSetup: boolean
  memberships: Membership[]
  suggestions: Suggestion[]
  invites: Membership[]
  answerInvite: (memberId: string, accept: boolean, convert?: boolean) => Promise<void>
  workspace: Workspace
  current: Membership | null
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  /** progresso do tutorial (aplica-se logo no ecrã e grava na conta) */
  updateTutorial: (patch: { seen?: boolean; done?: string; reset?: boolean }) => void
  /** guarda o resultado de um minijogo; devolve se foi recorde */
  recordGame: (game: GameId, score: number) => boolean
  refresh: () => Promise<void>
  setWorkspace: (ws: Workspace) => void
  logout: () => Promise<void>
  updateMe: (patch: { name?: string; rankingVisibility?: RankingVisibility }) => Promise<void>
  choosePersonal: () => Promise<void>
  createOrg: (input: OrgInput) => Promise<Membership>
  joinOrg: (by: { code?: string; orgId?: string; convert?: boolean }) => Promise<Membership>
}

const AccountContext = createContext<AccountValue | null>(null)

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount tem de ser usado dentro de <AccountProvider>')
  return ctx
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId, getToken } = useAuth()
  const clerkUserId = userId ?? null
  const clerk = useClerk()
  const [me, setMe] = useState<MeState | null>(null)
  const clerkRef = useRef(clerkUserId)
  const seq = useRef(0)
  const [settingsPatch, setSettingsPatch] = useState<Partial<Settings>>({})
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSettings = useRef<Partial<Settings>>({})

  useEffect(() => {
    clerkRef.current = clerkUserId
    setTokenSource(isLoaded && clerkUserId ? () => getToken() : null)
  }, [isLoaded, clerkUserId, getToken])

  const refresh = useCallback(async () => {
    // só conta a resposta do pedido mais recente: uma resposta antiga (ex.: de antes do login)
    // não pode apagar a conta que entretanto chegou
    const n = ++seq.current
    const clerkId = clerkRef.current
    let lastError: unknown = null
    // com sessão no Clerk, o servidor tem de devolver a conta: o token pode estar a meio da
    // renovação (logo a seguir ao login ou ao voltar de segundo plano) ou a rede falhar por instantes
    for (let attempt = 0; attempt < (clerkId ? 4 : 1); attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 400 * 2 ** (attempt - 1)))
        if (n !== seq.current) return
        await getToken({ skipCache: true }).catch(() => null)
      }
      try {
        const res = await api<MeResponse>('/api/me')
        if (res.user || res.disabled || !clerkId) {
          if (n === seq.current) setMe({ ...SIGNED_OUT, ...res, clerkId })
          return
        }
        lastError = null
      } catch (err) {
        lastError = err
        // erros definitivos (ex.: conta sem email) não melhoram a tentar outra vez
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) break
      }
    }
    if (n !== seq.current) return
    if (!clerkId) {
      setMe(m => m ?? { ...SIGNED_OUT, clerkId })
      return
    }
    // o Clerk tem sessão mas a conta não chegou: mantém a que houver; senão mostra o erro
    // (mostrar o login aqui fazia o Clerk, já com sessão, redireccionar em ciclo)
    const failed = lastError ? errorText(lastError, 'Não foi possível carregar a tua conta.') : 'Não foi possível carregar a tua conta.'
    setMe(m => (m?.user && m.clerkId === clerkId ? m : { ...SIGNED_OUT, clerkId, failed }))
  }, [getToken])

  useEffect(() => {
    clearBrowserStorage()
    // voltar à janela várias vezes seguidas não repete o pedido
    const onFocus = throttled(() => refresh())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  useEffect(() => {
    if (isLoaded) refresh()
  }, [isLoaded, clerkUserId, refresh])

  const answerInvite = useCallback(async (memberId: string, accept: boolean, convert?: boolean) => {
    await api(`/api/convites/${memberId}`, { body: { accept, convert } })
    await refresh()
  }, [refresh])

  const setWorkspace = useCallback((ws: Workspace) => {
    setMe(m => (m?.user ? { ...m, user: { ...m.user, workspace: ws } } : m))
    api('/api/me', { method: 'PATCH', body: { workspace: ws } }).catch(() => undefined)
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsPatch(p => ({ ...p, ...patch }))
    // várias mudanças seguidas (ex.: carregar no + várias vezes) vão num só pedido
    pendingSettings.current = { ...pendingSettings.current, ...patch }
    if (settingsTimer.current) clearTimeout(settingsTimer.current)
    settingsTimer.current = setTimeout(() => {
      const body = pendingSettings.current
      pendingSettings.current = {}
      api('/api/me', { method: 'PATCH', body: { settings: body } }).catch(() => undefined)
    }, 600)
  }, [])

  const updateTutorial = useCallback((patch: { seen?: boolean; done?: string; reset?: boolean }) => {
    setMe(m => {
      if (!m?.user) return m
      const t = patch.reset ? {} : { ...m.user.tutorial }
      if (patch.seen) t.seenAt ??= Date.now()
      if (patch.done) t.done = [...new Set([...(t.done ?? []), patch.done])]
      return { ...m, user: { ...m.user, tutorial: t } }
    })
    api('/api/me', { method: 'PATCH', body: { tutorial: patch } }).catch(() => undefined)
  }, [])

  const recordGame = useCallback((game: GameId, score: number) => {
    const prev = me?.user?.games?.[game]
    const record = isBetter(game, score, prev?.best)
    setMe(m => (m?.user ? { ...m, user: { ...m.user, games: { ...m.user.games, [game]: recordScore(m.user.games?.[game], game, score) } } } : m))
    api('/api/jogos', { body: { game, score } }).catch(() => undefined)
    return record
  }, [me])

  const logout = useCallback(async () => {
    seq.current++ // ignora pedidos ainda em curso da sessão que terminou
    await clerk.signOut().catch(() => undefined)
    setSettingsPatch({})
    setMe({ ...SIGNED_OUT, clerkId: null })
  }, [clerk])

  const updateMe = useCallback(async (patch: { name?: string; rankingVisibility?: RankingVisibility }) => {
    await api('/api/me', { method: 'PATCH', body: patch })
    await refresh()
  }, [refresh])

  const choosePersonal = useCallback(async () => {
    await api('/api/me', { method: 'PATCH', body: { accountType: 'personal' } })
    await refresh()
  }, [refresh])

  const enter = useCallback(async (res: { org: Org; member: Member }) => {
    await refresh()
    return res
  }, [refresh])

  const createOrg = useCallback(
    async (input: OrgInput) => enter(await api<Membership>('/api/orgs', { body: input })),
    [enter],
  )

  const joinOrg = useCallback(
    async (by: { code?: string; orgId?: string; convert?: boolean }) => enter(await api<Membership>('/api/orgs/join', { body: by })),
    [enter],
  )

  const user = me?.user ?? null
  const memberships = useMemo(() => me?.memberships ?? [], [me])
  const accountType = user ? accountTypeOf(user, memberships.length > 0) : undefined
  const businessRole =
    user && accountType === 'business'
      ? businessRoleOf(user, memberships.some(m => m.org.createdBy === user.id), memberships.length > 0)
      : undefined
  const saved = user?.workspace
  const current =
    accountType === 'business'
      ? (saved?.kind === 'org' ? memberships.find(m => m.org.id === saved.orgId) : undefined) ?? memberships[0] ?? null
      : null
  const workspace: Workspace = current ? { kind: 'org', orgId: current.org.id, memberId: current.member.id } : { kind: 'personal' }
  const needsSetup = !!user && (!accountType || (accountType === 'business' && !current))
  const settings = useMemo<Settings>(
    () => ({ ...DEFAULT_SETTINGS, ...user?.settings, ...settingsPatch }),
    [user?.settings, settingsPatch],
  )

  const value: AccountValue = {
    loading: !isLoaded || me === null || me.clerkId !== clerkUserId,
    switching: isLoaded && me !== null && me.clerkId !== clerkUserId,
    disabled: !!me?.disabled,
    failed: me && !me.user && me.clerkId === clerkUserId ? me.failed ?? null : null,
    user,
    accountType,
    businessRole,
    needsSetup,
    memberships,
    suggestions: me?.suggestions ?? [],
    invites: me?.invites ?? [],
    answerInvite,
    workspace,
    current,
    settings,
    updateSettings,
    updateTutorial,
    recordGame,
    refresh,
    setWorkspace,
    logout,
    updateMe,
    choosePersonal,
    createOrg,
    joinOrg,
  }

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
