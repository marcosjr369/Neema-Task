'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, errorText, throttled, whenVisible } from '../lib/api'
import { assignableMembers, canManageRole, isCompanyAccount, isWorking, managedDepartmentIds, teamMembers } from '../lib/org'
import type { Department, Member, Org, PresenceStatus, Task } from '../types'

type OrgData = { org: Org; me: Member; departments: Department[]; members: Member[] }

type OrgValue = OrgData & {
  base: string
  isCompany: boolean
  isAdmin: boolean
  isManager: boolean
  scope: Set<string> | 'all'
  assignable: Member[]
  memberById: (id?: string) => Member | undefined
  deptById: (id?: string) => Department | undefined
  refresh: () => Promise<void>
  presence: PresenceStatus
  setPresence: (status: PresenceStatus) => void
  workStart: number | null
  startWork: () => void
  endWork: () => void
  teamTasks: Task[]
  refreshTeam: () => Promise<void>
  upsertTeamTask: (task: Task) => void
  removeTeamTask: (id: string) => void
  error: string | null
  /** a equipa (membros, departamentos) já chegou do servidor: antes disso as listas estão vazias */
  loaded: boolean
  /** as tarefas da equipa já chegaram (quem não gere equipa: sempre true) */
  teamLoaded: boolean
}

const OrgContext = createContext<OrgValue | null>(null)

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
  const [workStart, setWorkStart] = useState<number | null>(() => (isWorking(initial.member.workStart) ? initial.member.workStart! : null))
  const workStartRef = useRef(workStart)
  useEffect(() => { workStartRef.current = workStart }, [workStart])
  const [teamTasks, setTeamTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [teamFetched, setTeamFetched] = useState(false)
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
    // mesmo com erro: mostra o erro em vez de ficar a carregar para sempre
    setLoaded(true)
  }, [base])

  const isManager = canManageRole(data.me.role)

  const refreshTeam = useCallback(async () => {
    if (!isManager) return
    try {
      const { tasks } = await api<{ tasks: Task[] }>(`${base}/tasks?scope=team`)
      setTeamTasks(tasks)
    } catch { /* offline */ }
    setTeamFetched(true)
  }, [base, isManager])

  const applyLocal = useCallback((status: PresenceStatus, start: number | null) => {
    presenceRef.current = status
    workStartRef.current = start
    setPresenceState(status)
    setWorkStart(start)
  }, [])

  const sendPresence = useCallback(async (body: { status?: PresenceStatus; work?: 'start' | 'end'; beat?: boolean }) => {
    try {
      const res = await api<{ presence: PresenceStatus; workStart?: number }>(`${base}/presence`, { body })
      if (body.beat && res.presence === 'offline') applyLocal('offline', null)
      else if (res.workStart) setWorkStart(res.workStart)
    } catch { /* tenta de novo no próximo sinal */ }
  }, [base, applyLocal])

  const setPresence = useCallback((status: PresenceStatus) => {
    applyLocal(status, status === 'offline' ? null : workStartRef.current ?? Date.now())
    sendPresence({ status })
  }, [sendPresence, applyLocal])

  const startWork = useCallback(() => {
    applyLocal('trabalho', workStartRef.current ?? Date.now())
    sendPresence({ work: 'start' })
  }, [sendPresence, applyLocal])
  const endWork = useCallback(() => {
    applyLocal('offline', null)
    sendPresence({ work: 'end' })
  }, [sendPresence, applyLocal])

  const isCompany = isCompanyAccount(data.me, data.org)
  const tracksPresence = !!data.me.consentAt && !isCompany
  const resumeWith = useRef(initial.member.presence !== 'offline' ? initial.member.presence : 'trabalho')
  useEffect(() => {
    if (tracksPresence && workStartRef.current) setPresence(resumeWith.current)
  }, [tracksPresence, setPresence])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    refresh()
    refreshTeam()
    const beat = setInterval(() => {
      if (presenceRef.current !== 'offline') sendPresence({ status: presenceRef.current, beat: true })
    }, HEARTBEAT)
    // a presença continua a bater; os dados da equipa só se recarregam com o separador à vista
    const poll = setInterval(whenVisible(() => {
      refresh()
      refreshTeam()
    }), 45 * 1000)
    const onFocus = throttled(() => {
      refresh()
      refreshTeam()
      if (presenceRef.current !== 'offline') sendPresence({ status: presenceRef.current, beat: true })
    })
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
      workStart,
      startWork,
      endWork,
      teamTasks,
      refreshTeam,
      upsertTeamTask,
      removeTeamTask,
      error,
      loaded,
      teamLoaded: !isManager || teamFetched,
    }
  }, [data, base, isCompany, isManager, refresh, presence, setPresence, workStart, startWork, endWork, teamTasks, refreshTeam, upsertTeamTask, removeTeamTask, error, loaded, teamFetched])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
