'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { api } from '../lib/api'
import { clearBrowserStorage } from '../lib/browserStorage'
import { accountTypeOf, businessRoleOf } from '../lib/account'
import { DEFAULT_SETTINGS, type AccountType, type BusinessRole, type Member, type Membership, type Org, type RankingVisibility, type Settings, type User, type Workspace } from '../types'

type Suggestion = { id: string; name: string; sector: string }
type MeResponse = {
  user: User | null
  memberships: Membership[]
  suggestions: Suggestion[]
  /** conta desactivada pelo administrador da plataforma */
  disabled?: boolean
}

export type OrgInput = { name: string; sector: string; size?: string; domain?: string; departments?: string[] }

type AccountValue = {
  /** à espera do Clerk e da primeira resposta do servidor */
  loading: boolean
  disabled: boolean
  user: User | null
  /** pessoal ou empresa; undefined enquanto a conta nova não escolher */
  accountType: AccountType | undefined
  /** contas de empresa: conta da própria empresa ou de funcionário (undefined se ainda não se sabe) */
  businessRole: BusinessRole | undefined
  /** conta sem tipo, ou de empresa sem nenhuma empresa: tem de passar pela entrada */
  needsSetup: boolean
  memberships: Membership[]
  suggestions: Suggestion[]
  workspace: Workspace
  /** empresa activa (se o espaço for de empresa) */
  current: Membership | null
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  refresh: () => Promise<void>
  setWorkspace: (ws: Workspace) => void
  logout: () => Promise<void>
  updateMe: (patch: { name?: string; rankingVisibility?: RankingVisibility }) => Promise<void>
  /** fixa a conta como pessoal (passo final da entrada) */
  choosePersonal: () => Promise<void>
  createOrg: (input: OrgInput) => Promise<Membership>
  /** convert: conta pessoal que aceita passar a conta de empresa */
  joinOrg: (by: { code?: string; orgId?: string; convert?: boolean }) => Promise<Membership>
}

const AccountContext = createContext<AccountValue | null>(null)

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount tem de ser usado dentro de <AccountProvider>')
  return ctx
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId: clerkUserId } = useAuth()
  const clerk = useClerk()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [settingsPatch, setSettingsPatch] = useState<Partial<Settings>>({})
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSettings = useRef<Partial<Settings>>({})

  const refresh = useCallback(async () => {
    try {
      setMe(await api<MeResponse>('/api/me'))
    } catch {
      // sem ligação: mantém o que houver; no primeiro arranque mostra o ecrã de entrada
      setMe(m => m ?? { user: null, memberships: [], suggestions: [] })
    }
  }, [])

  useEffect(() => {
    clearBrowserStorage()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  // Sempre que alguém entra ou sai no Clerk, volta a pedir a conta ao servidor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização com o servidor
    if (isLoaded) refresh()
  }, [isLoaded, clerkUserId, refresh])

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

  const logout = useCallback(async () => {
    await clerk.signOut().catch(() => undefined)
    setSettingsPatch({})
    setMe({ user: null, memberships: [], suggestions: [] })
  }, [clerk])

  const updateMe = useCallback(async (patch: { name?: string; rankingVisibility?: RankingVisibility }) => {
    await api('/api/me', { method: 'PATCH', body: patch })
    await refresh()
  }, [refresh])

  const choosePersonal = useCallback(async () => {
    await api('/api/me', { method: 'PATCH', body: { accountType: 'personal' } })
    await refresh()
  }, [refresh])

  // o servidor já deixa a empresa nova como espaço activo
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
  // contas de empresa: a empresa guardada ou, se deixou de existir, a primeira; contas pessoais: o espaço pessoal
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
    loading: !isLoaded || me === null,
    disabled: !!me?.disabled,
    user,
    accountType,
    businessRole,
    needsSetup,
    memberships,
    suggestions: me?.suggestions ?? [],
    workspace,
    current,
    settings,
    updateSettings,
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
