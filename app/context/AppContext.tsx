'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ActiveTimer,
  CATEGORY_CONFIG,
  Session,
  Settings,
  Task,
  TaskStatus,
  Workspace,
} from '../types'
import { pushNotification, sounds } from '../lib/sounds'
import { formatDuration, liveSession, phaseElapsed, taskSeconds } from '../lib/stats'
import { taskPoints } from '../lib/points'
import { api, errorText } from '../lib/api'
import { useAccount } from './AccountContext'
import { useOrg } from './OrgContext'

export type Prompt = 'break' | 'breakOver' | 'restDone'
export type Celebration = {
  title: string
  subtitle: string
  xp: number
  seconds: number
  /** enviada para revisão: XP só depois de aprovada */
  pending?: boolean
}
export type Toast = { id: number; text: string; tone: 'info' | 'danger' | 'success' }
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'status'> & { status?: TaskStatus }

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

type AppContextValue = {
  now: number
  workspace: Workspace
  /** espaço de empresa (tarefas atribuídas, aprovações, presença) */
  orgMode: boolean
  /** já chegaram as tarefas do servidor */
  ready: boolean
  tasks: Task[]
  sessions: Session[]
  /** sessões guardadas + o segmento a correr agora */
  allSessions: Session[]
  settings: Settings
  timer: ActiveTimer | null
  activeTask: Task | null
  prompt: Prompt | null
  celebration: Celebration | null
  toast: Toast | null
  sheet: { open: boolean; task: Task | null }

  addTask: (input: TaskInput) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  setStatus: (id: string, status: TaskStatus) => void
  /** substitui a tarefa local pela versão do servidor */
  replaceTask: (task: Task) => void
  refreshTasks: () => Promise<boolean>

  startTimer: (taskId: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  startBreak: () => void
  extendFocus: (minutes: number) => void
  backToFocus: () => void

  updateSettings: (patch: Partial<Settings>) => void
  resetAll: () => Promise<void>
  openTaskSheet: (task?: Task) => void
  closeTaskSheet: () => void
  dismissCelebration: () => void
  showToast: (text: string, tone?: Toast['tone']) => void
  notificationPermission: NotificationPermission | 'unsupported'
  requestNotifications: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp tem de ser usado dentro de <AppProvider>')
  return ctx
}

/** Campos que o servidor aceita numa actualização */
const REMOTE_FIELDS = [
  'title', 'description', 'category', 'priority', 'focusDuration', 'deadline', 'tags',
  'checklist', 'requiresApproval', 'requiresAttachment', 'recurrence', 'notified', 'assigneeId', 'reviewerId',
] as const

function remotePatch(patch: Partial<Task>) {
  const out: Record<string, unknown> = {}
  for (const k of REMOTE_FIELDS) {
    if (k in patch) out[k] = patch[k] === undefined ? null : patch[k]
  }
  return out
}

/**
 * Estado da app no espaço activo. Tudo vive no servidor:
 * pessoal → /api/personal, empresa → /api/orgs/:id. O provider é recriado ao mudar de espaço.
 */
export function AppProvider({ workspace, children }: { workspace: Workspace; children: ReactNode }) {
  const account = useAccount()
  const org = workspace.kind === 'org' ? workspace : null
  const [base] = useState(() => (org ? `/api/orgs/${org.orgId}` : '/api/personal'))
  const [timerKey] = useState(() => (org ? org.orgId : 'personal'))
  const orgCtx = useOrg()
  const orgRef = useRef(orgCtx)
  useEffect(() => { orgRef.current = orgCtx }, [orgCtx])

  const [tasks, setTasks] = useState<Task[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [ready, setReady] = useState(false)
  const settings = account.settings
  const [timer, setTimer] = useState<ActiveTimer | null>(() => account.user?.timers?.[timerKey] ?? null)
  const [now, setNow] = useState(() => Date.now())
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  // Atalho da app instalada: /tarefas?nova=1 abre logo o formulário
  const [sheet, setSheet] = useState<{ open: boolean; task: Task | null }>(() => ({
    open: new URLSearchParams(window.location.search).has('nova'),
    task: null,
  }))
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    () => ('Notification' in window ? Notification.permission : 'unsupported'),
  )

  const tasksRef = useRef(tasks)
  const timerRef = useRef(timer)
  const settingsRef = useRef(settings)
  const sessionsRef = useRef(sessions)
  useEffect(() => {
    tasksRef.current = tasks
    timerRef.current = timer
    settingsRef.current = settings
    sessionsRef.current = sessions
  }, [tasks, timer, settings, sessions])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('nova')) {
      url.searchParams.delete('nova')
      window.history.replaceState(window.history.state, '', url)
    }
  }, [])

  // ─── Toast ──────────────────────────────────────────────────────────────
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    setToast({ id: Date.now(), text, tone })
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(null), 3500)
  }, [])

  const playSound = useCallback((fn: () => void) => {
    if (settingsRef.current.sound) fn()
  }, [])

  // ─── Cronómetro guardado na conta (continua noutro dispositivo) ─────────
  const firstTimer = useRef(true)
  useEffect(() => {
    if (firstTimer.current) {
      firstTimer.current = false
      return
    }
    api('/api/me/timer', { method: 'PUT', body: { key: timerKey, timer } }).catch(() => undefined)
  }, [timer, timerKey])

  // ─── Sincronização com o servidor ───────────────────────────────────────
  /** pedidos em curso: enquanto houver, o polling não sobrepõe o estado local */
  const inflight = useRef(0)
  /** sessões ainda não confirmadas (ex.: sem rede) */
  const pendingSessions = useRef<Session[]>([])

  const replaceTask = useCallback((task: Task) => {
    setTasks(ts => (ts.some(t => t.id === task.id) ? ts.map(t => (t.id === task.id ? task : t)) : ts))
  }, [])

  const refreshTasks = useCallback(async (): Promise<boolean> => {
    if (inflight.current > 0) return false
    try {
      const { tasks: fresh } = await api<{ tasks: Task[] }>(`${base}/tasks?scope=mine`)
      if (inflight.current > 0) return false
      const prev = tasksRef.current
      if (org && prev.length > 0) {
        const byId = new Map(prev.map(t => [t.id, t]))
        for (const t of fresh) {
          const old = byId.get(t.id)
          if (!old && t.createdBy !== org.memberId) {
            pushNotification('Nova tarefa atribuída', t.title, `assigned-${t.id}`, `/tarefas/${t.id}`)
            showToast(`Nova tarefa: ${t.title}`, 'info')
            playSound(sounds.warning)
          } else if (old && old.review?.status !== t.review?.status) {
            if (t.review?.status === 'approved') {
              pushNotification('Tarefa aprovada', t.title, `review-${t.id}`, `/tarefas/${t.id}`)
              showToast(`Aprovada: ${t.title}`, 'success')
              playSound(sounds.success)
            } else if (t.review?.status === 'rejected') {
              pushNotification('Tarefa devolvida', t.review.comment || t.title, `review-${t.id}`, `/tarefas/${t.id}`)
              showToast(`Devolvida: ${t.title}`, 'danger')
              playSound(sounds.warning)
            }
          }
        }
      }
      setTasks(fresh)
      return true
    } catch {
      return false // sem ligação: mantém o que está no ecrã
    }
  }, [base, org, showToast, playSound])

  const flushSessions = useCallback(async () => {
    const pending = pendingSessions.current
    if (pending.length === 0) return
    try {
      await api(`${base}/sessions`, { body: { sessions: pending } })
      const sent = new Set(pending.map(s => s.id))
      pendingSessions.current = pendingSessions.current.filter(s => !sent.has(s.id))
    } catch { /* tenta mais tarde */ }
  }, [base])

  const refreshSessions = useCallback(async (): Promise<boolean> => {
    try {
      const { sessions: fresh } = await api<{ sessions: Session[] }>(`${base}/sessions?scope=mine`)
      const ids = new Set(fresh.map(s => s.id))
      setSessions([...fresh, ...pendingSessions.current.filter(s => !ids.has(s.id))])
      return true
    } catch {
      return false
    }
  }, [base])

  useEffect(() => {
    const sync = async () => {
      await flushSessions()
      const [t, s] = await Promise.all([refreshTasks(), refreshSessions()])
      if (t && s) setReady(true)
    }
    sync()
    const id = setInterval(() => {
      flushSessions()
      refreshTasks()
    }, 20 * 1000)
    window.addEventListener('focus', sync)
    window.addEventListener('online', sync)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', sync)
      window.removeEventListener('online', sync)
    }
  }, [flushSessions, refreshTasks, refreshSessions])

  /** Executa um pedido ao servidor; a resposta {task} substitui a cópia local */
  const remote = useCallback(
    async (fn: () => Promise<unknown>) => {
      inflight.current++
      try {
        const res = (await fn()) as { task?: Task } | undefined
        if (res && typeof res === 'object' && 'task' in res && res.task) {
          replaceTask(res.task)
          if (orgRef.current?.isManager) orgRef.current.upsertTeamTask(res.task)
        }
      } catch (err) {
        showToast(errorText(err), 'danger')
        inflight.current = 0
        refreshTasks()
        return
      }
      inflight.current = Math.max(0, inflight.current - 1)
    },
    [replaceTask, showToast, refreshTasks],
  )

  const remoteStatus = useCallback(
    (id: string, status: TaskStatus) =>
      remote(() => api(`${base}/tasks/${id}`, { method: 'PATCH', body: { action: 'status', status } })),
    [remote, base],
  )

  // ─── Temporizador: verificação a cada tick ──────────────────────────────
  const checkTimer = useCallback((n: number) => {
    const t = timerRef.current
    if (!t || !t.segmentStart || t.alerted) return
    const task = tasksRef.current.find(x => x.id === t.taskId)
    if (!task) return
    const elapsed = phaseElapsed(t, n)

    if (t.phase === 'focus') {
      if (elapsed < t.blockSeconds) return
      const isRest = CATEGORY_CONFIG[task.category].isRest
      if (!isRest && !settingsRef.current.breakAlerts) return
      const next = { ...t, alerted: true }
      timerRef.current = next
      setTimer(next)
      if (isRest) {
        playSound(sounds.gentle)
        pushNotification('Tempo planeado terminado', `"${task.title}" chegou ao fim do tempo planeado.`, 'timer', '/foco')
        setPrompt('restDone')
      } else {
        playSound(sounds.breakTime)
        pushNotification('Hora de pausar', `Já focaste ${formatDuration(elapsed)} em "${task.title}". Faz uma pausa.`, 'timer', '/foco')
        setPrompt('break')
      }
    } else if (elapsed >= t.breakSeconds) {
      const next = { ...t, alerted: true }
      timerRef.current = next
      setTimer(next)
      playSound(sounds.backToWork)
      pushNotification('Pausa terminada', `Pronto para voltar a "${task.title}"?`, 'timer', '/foco')
      setPrompt('breakOver')
    }
  }, [playSound])

  const running = !!timer?.segmentStart
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now()
      setNow(n)
      checkTimer(n)
    }, running ? 1000 : 30000)
    return () => clearInterval(id)
  }, [running, checkTimer])

  // ─── Alertas de prazo ───────────────────────────────────────────────────
  const markNotified = useCallback((id: string) => {
    setTasks(ts => ts.map(x => (x.id === id ? { ...x, notified: true } : x)))
    remote(() => api(`${base}/tasks/${id}`, { method: 'PATCH', body: { action: 'update', patch: { notified: true } } }))
  }, [base, remote])

  useEffect(() => {
    const warned = new Set<string>()
    const check = () => {
      const n = Date.now()
      tasksRef.current.forEach(task => {
        if (!task.deadline || task.status === 'done') return
        const diff = new Date(task.deadline).getTime() - n
        if (diff <= 0 && !task.notified) {
          pushNotification('Prazo expirado', `A tarefa "${task.title}" está atrasada.`, `expired-${task.id}`, `/tarefas/${task.id}`)
          playSound(sounds.deadline)
          showToast(`Prazo expirado: ${task.title}`, 'danger')
          markNotified(task.id)
        } else if (diff > 0 && diff <= 5 * 60 * 1000 && !warned.has(task.id)) {
          warned.add(task.id)
          const mins = Math.ceil(diff / 60000)
          pushNotification('Prazo a aproximar-se', `"${task.title}" vence em ${mins} min.`, `warning-${task.id}`, `/tarefas/${task.id}`)
          playSound(sounds.warning)
          showToast(`"${task.title}" vence em ${mins} min`, 'info')
        }
      })
    }
    const first = setTimeout(check, 2000)
    const id = setInterval(check, 30 * 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [playSound, showToast, markNotified])

  // ─── Sessões ────────────────────────────────────────────────────────────
  /** Grava o segmento de foco a correr como sessão */
  const logSegment = useCallback((t: ActiveTimer, end: number) => {
    if (t.phase !== 'focus' || !t.segmentStart) return
    const seconds = Math.round((end - t.segmentStart) / 1000)
    if (seconds < 1) return
    const category = tasksRef.current.find(x => x.id === t.taskId)?.category ?? 'outro'
    const session: Session = { id: newId(), taskId: t.taskId, category, start: t.segmentStart, end, seconds }
    setSessions(s => [...s, session])
    pendingSessions.current = [...pendingSessions.current, session]
    flushSessions()
  }, [flushSessions])

  const blockFor = useCallback((taskId: string) => {
    const task = tasksRef.current.find(x => x.id === taskId)
    return (task?.focusDuration || settingsRef.current.workMinutes) * 60
  }, [])

  const stopTimer = useCallback(() => {
    const t = timerRef.current
    if (!t) return
    logSegment(t, Date.now())
    timerRef.current = null
    setTimer(null)
    setPrompt(null)
  }, [logSegment])

  const startTimer = useCallback((taskId: string) => {
    const n = Date.now()
    const t = timerRef.current
    if (t?.taskId === taskId) {
      if (!t.segmentStart) setTimer({ ...t, segmentStart: n })
      return
    }
    if (t) logSegment(t, n)
    setPrompt(null)
    const next: ActiveTimer = {
      taskId,
      phase: 'focus',
      segmentStart: n,
      accumulated: 0,
      blockSeconds: blockFor(taskId),
      breakSeconds: settingsRef.current.shortBreakMinutes * 60,
      alerted: false,
      pomodoros: 0,
    }
    timerRef.current = next
    setTimer(next)
    if (tasksRef.current.find(x => x.id === taskId)?.status === 'todo') {
      setTasks(ts => ts.map(x => (x.id === taskId ? { ...x, status: 'doing' } : x)))
      remoteStatus(taskId, 'doing')
    }
  }, [logSegment, blockFor, remoteStatus])

  const pauseTimer = useCallback(() => {
    const t = timerRef.current
    if (!t || !t.segmentStart) return
    const n = Date.now()
    logSegment(t, n)
    setTimer({ ...t, accumulated: phaseElapsed(t, n), segmentStart: null })
  }, [logSegment])

  const resumeTimer = useCallback(() => {
    const t = timerRef.current
    if (!t || t.segmentStart) return
    setTimer({ ...t, segmentStart: Date.now() })
  }, [])

  const startBreak = useCallback(() => {
    const t = timerRef.current
    if (!t) return
    const n = Date.now()
    logSegment(t, n)
    const s = settingsRef.current
    const pomodoros = t.pomodoros + 1
    const long = pomodoros % Math.max(1, s.longBreakEvery) === 0
    setTimer({
      ...t,
      phase: 'break',
      segmentStart: n,
      accumulated: 0,
      alerted: false,
      pomodoros,
      breakSeconds: (long ? s.longBreakMinutes : s.shortBreakMinutes) * 60,
    })
    setPrompt(null)
  }, [logSegment])

  const extendFocus = useCallback((minutes: number) => {
    const t = timerRef.current
    if (!t) return
    setTimer({ ...t, blockSeconds: phaseElapsed(t, Date.now()) + minutes * 60, alerted: false })
    setPrompt(null)
  }, [])

  const backToFocus = useCallback(() => {
    const t = timerRef.current
    if (!t) return
    setTimer({
      ...t,
      phase: 'focus',
      segmentStart: Date.now(),
      accumulated: 0,
      alerted: false,
      blockSeconds: blockFor(t.taskId),
    })
    setPrompt(null)
  }, [blockFor])

  // ─── Tarefas ────────────────────────────────────────────────────────────
  const addTask = useCallback((input: TaskInput) => {
    const task: Task = {
      ...input,
      id: newId(),
      createdAt: Date.now(),
      status: input.status ?? 'todo',
      ...(org ? { orgId: org.orgId, assigneeId: input.assigneeId ?? org.memberId, createdBy: org.memberId, attachments: [], comments: [] } : {}),
    }
    // tarefas atribuídas a outra pessoa não entram na minha lista
    if (!org || task.assigneeId === org.memberId) setTasks(ts => [...ts, task])
    remote(() => api<{ task: Task }>(`${base}/tasks`, { body: { ...remotePatch(task), id: task.id } }))
    return task
  }, [org, base, remote])

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(ts =>
      ts.map(t => {
        if (t.id !== id) return t
        const next = { ...t, ...patch }
        // novo prazo → volta a poder notificar
        if (patch.deadline !== undefined && patch.deadline !== t.deadline) next.notified = false
        return next
      }),
    )
    remote(() => api(`${base}/tasks/${id}`, { method: 'PATCH', body: { action: 'update', patch: remotePatch(patch) } }))
    // reatribuída a outra pessoa: sai da minha lista
    if (patch.assigneeId && org && patch.assigneeId !== org.memberId) setTasks(ts => ts.filter(t => t.id !== id))
    const t = timerRef.current
    if (t?.taskId === id && patch.focusDuration && t.phase === 'focus') {
      setTimer({ ...t, blockSeconds: patch.focusDuration * 60, alerted: false })
    }
  }, [base, org, remote])

  const deleteTask = useCallback((id: string) => {
    if (timerRef.current?.taskId === id) {
      timerRef.current = null
      setTimer(null)
      setPrompt(null)
    }
    setTasks(ts => ts.filter(t => t.id !== id))
    setSessions(s => s.filter(x => x.taskId !== id))
    orgRef.current?.removeTeamTask(id)
    remote(() => api(`${base}/tasks/${id}`, { method: 'DELETE' }))
  }, [base, remote])

  const setStatus = useCallback((id: string, status: TaskStatus) => {
    const task = tasksRef.current.find(t => t.id === id)
    if (!task || task.status === status) return
    if (task.review?.status === 'approved') {
      showToast('Esta tarefa já foi aprovada', 'info')
      return
    }
    if (status === 'done' && task.requiresAttachment && !task.attachments?.length) {
      showToast('Anexa um ficheiro que comprove o trabalho antes de concluir', 'danger')
      return
    }
    const n = Date.now()
    const t = timerRef.current
    let liveSecs = 0
    if (t?.taskId === id && status !== 'doing') {
      if (t.phase === 'focus' && t.segmentStart) liveSecs = (n - t.segmentStart) / 1000
      stopTimer()
    }
    const pending = status === 'done' && !!task.requiresApproval
    if (status === 'done') {
      const doneTask: Task = {
        ...task,
        status: 'done',
        completedAt: n,
        review: pending ? { status: 'approved', rejections: task.review?.rejections ?? 0 } : task.review,
      }
      setCelebration({
        title: pending ? 'Enviada!' : 'Perfeito!',
        subtitle: task.title,
        xp: taskPoints(doneTask),
        seconds: taskSeconds(sessionsRef.current, id) + liveSecs,
        pending,
      })
      playSound(sounds.success)
    }
    setTasks(ts =>
      ts.map(x =>
        x.id === id
          ? {
              ...x,
              status,
              completedAt: status === 'done' ? n : undefined,
              review: pending ? { status: 'pending', rejections: x.review?.rejections ?? 0 } : x.review,
            }
          : x,
      ),
    )
    remoteStatus(id, status)
  }, [stopTimer, playSound, showToast, remoteStatus])

  // ─── Outros ─────────────────────────────────────────────────────────────
  const resetAll = useCallback(async () => {
    if (org) return
    await api('/api/personal', { method: 'DELETE' })
    timerRef.current = null
    setTimer(null)
    setTasks([])
    setSessions([])
    setPrompt(null)
    await account.refresh()
  }, [org, account])

  const requestNotifications = useCallback(async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotificationPermission(result)
    if (result === 'granted') showToast('Notificações activadas', 'success')
  }, [showToast])

  const openTaskSheet = useCallback((task?: Task) => setSheet({ open: true, task: task ?? null }), [])
  const closeTaskSheet = useCallback(() => setSheet(s => ({ ...s, open: false })), [])
  const dismissCelebration = useCallback(() => setCelebration(null), [])

  const allSessions = useMemo(() => {
    const live = liveSession(timer, tasks, now)
    return live ? [...sessions, live] : sessions
  }, [sessions, timer, tasks, now])

  const activeTask = timer ? tasks.find(t => t.id === timer.taskId) ?? null : null

  const value: AppContextValue = {
    now,
    workspace,
    orgMode: !!org,
    ready,
    tasks,
    sessions,
    allSessions,
    settings,
    timer,
    activeTask,
    prompt,
    celebration,
    toast,
    sheet,
    addTask,
    updateTask,
    deleteTask,
    setStatus,
    replaceTask,
    refreshTasks,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    startBreak,
    extendFocus,
    backToFocus,
    updateSettings: account.updateSettings,
    resetAll,
    openTaskSheet,
    closeTaskSheet,
    dismissCelebration,
    showToast,
    notificationPermission,
    requestNotifications,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
