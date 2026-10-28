'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, errorText } from '../lib/api'
import { assignableMembers, canManageRole, isCompanyAccount, managedDepartmentIds, teamMembers } from '../lib/org'
import type { Department, Member, Org, PresenceStatus, Task } from '../types'

type OrgData = { org: Org; me: Member; departments: Department[]; members: Member[] }

type OrgValue = OrgData & {
  base: string
  /** sessão iniciada com a conta da própria empresa (gere, mas não é funcionário) */
  isCompany: boolean
  isAdmin: boolean
  isManager: boolean
  /** departamentos geridos ('all' = admin) */
  scope: Set<string> | 'all'
  assignable: Member[]
  memberById: (id?: string) => Member | undefined
  deptById: (id?: string) => Department | undefined
  refresh: () => Promise<void>
  presence: PresenceStatus
  setPresence: (status: PresenceStatus) => void
  /** tarefas que giro ou criei (supervisores e admins) */
  teamTasks: Task[]
  refreshTeam: () => Promise<void>
  upsertTeamTask: (task: Task) => void
  removeTeamTask: (id: string) => void
  error: string | null
}

const OrgContext = createContext<OrgValue | null>(null)

/** Dados da empresa activa, ou null no espaço pessoal */
export function useOrg() {
  return useContext(OrgContext)
}

export function useOrgRequired() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('Só disponível no espaço de empresa')
  return ctx
}

const HEARTBEAT = 60 * 1000

export function OrgProvider({ orgId, initial, children }: { orgId: string; initial: { org: Org; member: Member }; children: ReactNode }) {
  const base = `/api/orgs/${orgId}`
  const [data, setData] = useState<OrgData>(() => ({ org: initial.org, me: initial.member, departments: [], members: [] }))
  const [presence, setPresenceState] = useState<PresenceStatus>('offline')
  const [teamTasks, setTeamTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const presenceRef = useRef(presence)
  useEffect(() => { presenceRef.current = presence }, [presence])

  const refresh = useCallback(async () => {
    try {
      const next = await api<OrgData>(base)
      setData(next)
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [base])

  const isManager = canManageRole(data.me.role)

  const refreshTeam = useCallback(async () => {
    if (!isManager) return
    try {
      const { tasks } = await api<{ tasks: Task[] }>(`${base}/tasks?scope=team`)
      setTeamTasks(tasks)
    } catch { /* offline */ }
  }, [base, isManager])

  const sendPresence = useCallback(async (status: PresenceStatus) => {
    try {
      await api(`${base}/presence`, { body: { status } })
    } catch { /* tenta de novo no próximo sinal */ }
  }, [base])

  const setPresence = useCallback((status: PresenceStatus) => {
    presenceRef.current = status
    setPresenceState(status)
    sendPresence(status)
  }, [sendPresence])

  // Abrir a app conta como entrada: fica "a trabalhar" até mudar (só depois do consentimento).
  // A conta da empresa não tem estado.
  const isCompany = isCompanyAccount(data.me, data.org)
  const tracksPresence = !!data.me.consentAt && !isCompany
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- registo de entrada
    if (tracksPresence) setPresence('trabalho')
  }, [tracksPresence, setPresence])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    refresh()
    refreshTeam()
    const beat = setInterval(() => {
      if (presenceRef.current !== 'offline') sendPresence(presenceRef.current)
    }, HEARTBEAT)
    const poll = setInterval(() => {
      refresh()
      refreshTeam()
    }, 30 * 1000)
    const onFocus = () => {
      refresh()
      refreshTeam()
      if (presenceRef.current !== 'offline') sendPresence(presenceRef.current)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(beat)
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh, refreshTeam, sendPresence])

  const upsertTeamTask = useCallback((task: Task) => {
    setTeamTasks(ts => (ts.some(t => t.id === task.id) ? ts.map(t => (t.id === task.id ? task : t)) : [...ts, task]))
  }, [])
  const removeTeamTask = useCallback((id: string) => setTeamTasks(ts => ts.filter(t => t.id !== id)), [])

  const value = useMemo<OrgValue>(() => {
    const all = data.members.length ? data.members : [data.me]
    // "members" são as pessoas da equipa; a conta da empresa só aparece por id (ex.: quem atribuiu)
    const members = teamMembers(all, data.org)
    return {
      ...data,
      members,
      base,
      isCompany,
      isAdmin: data.me.role === 'admin',
      isManager,
      scope: managedDepartmentIds(data.departments, data.me),
      assignable: assignableMembers(members.filter(m => m.status === 'activo' || m.status === 'pendente'), data.departments, data.me),
      memberById: id => all.find(m => m.id === id),
      deptById: id => data.departments.find(d => d.id === id),
      refresh,
      presence,
      setPresence,
      teamTasks,
      refreshTeam,
      upsertTeamTask,
      removeTeamTask,
      error,
    }
  }, [data, base, isCompany, isManager, refresh, presence, setPresence, teamTasks, refreshTeam, upsertTeamTask, removeTeamTask, error])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
