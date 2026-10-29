export type TaskCategory =
  | 'trabalho'
  | 'estudo'
  | 'pessoal'
  | 'descanso'
  | 'lazer'
  | 'alocacao'
  | 'outro'

export type TaskStatus = 'todo' | 'doing' | 'done'

export type Priority = 'baixa' | 'media' | 'alta'

export type Task = {
  id: string
  title: string
  description: string
  category: TaskCategory
  status: TaskStatus
  priority: Priority
  /** minutos de foco antes do alerta de pausa */
  focusDuration: number
  deadline?: string
  tags: string[]
  createdAt: number
  completedAt?: number
  notified?: boolean
  checklist?: ChecklistItem[]
} & OrgTaskFields

/** Um bloco contínuo de tempo trabalhado numa tarefa */
export type Session = {
  id: string
  taskId: string
  category: TaskCategory
  start: number
  end: number
  seconds: number
  /** sessões de empresa: membro que trabalhou */
  memberId?: string
  /** sessões pessoais: utilizador */
  userId?: string
}

export type TimerPhase = 'focus' | 'break'

export type ActiveTimer = {
  taskId: string
  phase: TimerPhase
  /** quando o segmento actual começou a contar (null = em pausa) */
  segmentStart: number | null
  /** segundos já contados nesta fase antes de segmentStart */
  accumulated: number
  /** segundos de foco até ao alerta de pausa */
  blockSeconds: number
  breakSeconds: number
  /** alerta desta fase já disparou */
  alerted: boolean
  pomodoros: number
}

export type Settings = {
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  dailyGoalMinutes: number
  sound: boolean
  breakAlerts: boolean
  /** minutos sem foco até a Udacha reclamar (0 = desligado) */
  idleReminderMinutes: number
  /** horário dos lembretes: [início, fim) em horas */
  reminderStartHour: number
  reminderEndHour: number
}

export const DEFAULT_SETTINGS: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  dailyGoalMinutes: 120,
  sound: true,
  breakAlerts: true,
  idleReminderMinutes: 60,
  reminderStartHour: 8,
  reminderEndHour: 20,
}

export type CategoryConfig = {
  label: string
  /** cor principal */
  color: string
  /** sombra / borda inferior dos botões 3D */
  dark: string
  /** fundo suave */
  light: string
  defaultFocus: number
  /** true = descanso/lazer: sem alertas de pausa */
  isRest: boolean
}

export const CATEGORY_CONFIG: Record<TaskCategory, CategoryConfig> = {
  trabalho: { label: 'Trabalho', color: '#4C7DFF', dark: '#3461E0', light: '#E6EDFF', defaultFocus: 25, isRest: false },
  estudo: { label: 'Estudo', color: '#EC5BA6', dark: '#C93F87', light: '#FDE6F2', defaultFocus: 25, isRest: false },
  pessoal: { label: 'Pessoal', color: '#12B5A6', dark: '#0D9488', light: '#DCF7F3', defaultFocus: 25, isRest: false },
  alocacao: { label: 'Alocação', color: '#FFC53D', dark: '#E0A419', light: '#FFF4D6', defaultFocus: 60, isRest: false },
  descanso: { label: 'Descanso', color: '#4CC9F0', dark: '#22A6CF', light: '#E0F6FD', defaultFocus: 15, isRest: true },
  lazer: { label: 'Lazer', color: '#FF8A3D', dark: '#DB6A1F', light: '#FFEDE0', defaultFocus: 30, isRest: true },
  outro: { label: 'Outro', color: '#A3A0B8', dark: '#86829B', light: '#F1F0F6', defaultFocus: 25, isRest: false },
}

export const CATEGORIES = Object.keys(CATEGORY_CONFIG) as TaskCategory[]

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'A fazer',
  doing: 'Em curso',
  done: 'Concluída',
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: '#A3A0B8' },
  media: { label: 'Média', color: '#FFC53D' },
  alta: { label: 'Alta', color: '#F2545B' },
}

// ─── Contas, empresas e equipas ─────────────────────────────────────────────

export type ChecklistItem = { id: string; text: string; done: boolean }

export type Attachment = {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: number
  uploadedBy: string
}

export type CommentKind = 'comment' | 'submitted' | 'approved' | 'rejected'

export type TaskComment = {
  id: string
  authorId: string
  authorName: string
  text: string
  at: number
  kind: CommentKind
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type Review = {
  status: ReviewStatus
  by?: string
  at?: number
  comment?: string
  /** quantas vezes foi rejeitada (aprovação à primeira dá bónus) */
  rejections: number
}

export type Recurrence = 'diaria' | 'semanal' | 'mensal'

/** Campos extra das tarefas de empresa (todos em ids de membro) */
export type OrgTaskFields = {
  /** tarefas pessoais: utilizador dono */
  ownerId?: string
  orgId?: string
  assigneeId?: string
  createdBy?: string
  departmentId?: string
  /** quem aprova a tarefa (id de membro); sem isto, aprova quem gere o responsável */
  reviewerId?: string
  requiresApproval?: boolean
  requiresAttachment?: boolean
  review?: Review
  attachments?: Attachment[]
  comments?: TaskComment[]
  recurrence?: Recurrence
  updatedAt?: number
}

export type RankingVisibility = 'nome' | 'iniciais' | 'oculto'

/**
 * Tipo de conta, escolhido uma vez na entrada:
 *  - pessoal: só o espaço pessoal; ranking entre contas pessoais
 *  - empresa: só empresas (quem cria fica administrador; funcionários entram por convite)
 */
export type AccountType = 'personal' | 'business'

/** Dentro das contas de empresa: a conta da empresa ou a de um funcionário (não mudam depois) */
export type BusinessRole = 'company' | 'employee'

export type User = {
  id: string
  email: string
  name: string
  picture?: string
  /** false quando o fornecedor não confirmou o email (não entra em empresas pelo domínio) */
  emailVerified?: boolean
  /** identificador do utilizador no Clerk (login) */
  clerkId?: string
  createdAt: number
  rankingVisibility: RankingVisibility
  accountType?: AccountType
  /** contas de empresa: a conta da própria empresa (criou-a) ou de um funcionário (entrou por convite) */
  businessRole?: BusinessRole
  /** desactivado no painel de administração: não usa a app (e fica bloqueado no Clerk) */
  disabled?: boolean
  disabledAt?: number
  settings?: Partial<Settings>
  /** último espaço usado */
  workspace?: Workspace
  /** cronómetro activo por espaço ('personal' ou id da empresa) */
  timers?: Record<string, ActiveTimer>
  /** fuso horário do dispositivo (para o horário dos lembretes) */
  timezone?: string
  /** último lembrete de inactividade e quantos seguidos (frases cada vez mais tristes) */
  lastNudgeAt?: number
  nudgeCount?: number
}

/** Registo de um utilizador eliminado no painel (os dados dele já foram apagados) */
export type DeletedUser = {
  /** id que o utilizador tinha */
  id: string
  name: string
  email: string
  picture?: string
  type: AccountType | 'none'
  createdAt: number
  deletedAt: number
  reason?: string
  /** empresas a que pertencia (nome · papel) */
  orgs: string[]
  /** empresas apagadas com ele (era a única pessoa) */
  deletedOrgs: string[]
  /** totais de sempre, no momento da eliminação */
  focusSeconds: number
  tasksDone: number
}

export type Role = 'admin' | 'supervisor' | 'membro'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  membro: 'Funcionário',
}

/** Progresso de uma pessoa da equipa (perfil da empresa) */
export type TeamProgress = {
  id: string
  name: string
  picture?: string
  jobTitle?: string
  departmentId?: string
  role: Role
  xp: number
  level: number
  seconds: number
  progress: { done: number; hours: number; record: number; longest: number }
}

/** Como aparece a conta que criou a empresa (gere tudo, mas não é funcionário) */
export const COMPANY_ACCOUNT_LABEL = 'Conta da empresa'

export type Org = {
  id: string
  name: string
  sector: string
  size?: string
  /** domínio de email (ex.: empresa.com) cujos utilizadores podem entrar sem convite */
  domain?: string
  inviteCode: string
  createdAt: number
  createdBy: string
  /** não aparece no ranking geral de empresas */
  hideFromRanking?: boolean
}

export type Department = {
  id: string
  orgId: string
  name: string
  color: string
  /** ids de membro */
  supervisorIds: string[]
}

export type PresenceStatus = 'trabalho' | 'pausa' | 'almoco' | 'reuniao' | 'formacao' | 'ausente' | 'offline'

export const PRESENCE_CONFIG: Record<PresenceStatus, { label: string; color: string; light: string }> = {
  trabalho: { label: 'A trabalhar', color: '#12B5A6', light: '#DCF7F3' },
  reuniao: { label: 'Em reunião', color: '#7B61FF', light: '#EEEAFF' },
  formacao: { label: 'Formação', color: '#EC5BA6', light: '#FDE6F2' },
  pausa: { label: 'Pausa', color: '#FFC53D', light: '#FFF4D6' },
  almoco: { label: 'Almoço', color: '#FF8A3D', light: '#FFEDE0' },
  ausente: { label: 'Ausente', color: '#A3A0B8', light: '#F1F0F6' },
  offline: { label: 'Offline', color: '#D3D0E0', light: '#F7F6FC' },
}

export const PRESENCE_STATUSES = Object.keys(PRESENCE_CONFIG) as PresenceStatus[]

export type Member = {
  id: string
  orgId: string
  /** vazio enquanto o funcionário não entrar pela primeira vez; com status pendente, conta já existente a quem foi enviado o convite */
  userId?: string
  email: string
  name: string
  picture?: string
  jobTitle?: string
  phone?: string
  departmentId?: string
  role: Role
  status: 'activo' | 'pendente'
  joinedAt?: number
  /** aceitou o registo de tempo e estado */
  consentAt?: number
  presence: PresenceStatus
  lastSeen?: number
  /** início do dia de trabalho em curso ("Começar a trabalhar"); vazio depois de terminar */
  workStart?: number
  /** pontos e conquistas que a pessoa já tinha quando aceitou o convite */
  history?: CarriedHistory
}

/** Resumo do que a pessoa fez antes de entrar na empresa (conta pessoal e outras empresas) */
export type CarriedHistory = { at: number; xp: number; seconds: number; done: number; record: number; longest: number }

export type PresenceSegment = {
  id: string
  orgId: string
  memberId: string
  status: PresenceStatus
  start: number
  end: number | null
}

export type Membership = { org: Org; member: Member }

/** Espaço de trabalho activo no cliente */
export type Workspace = { kind: 'personal' } | { kind: 'org'; orgId: string; memberId: string }

export type RankMetric = 'points' | 'hours' | 'tasks'

/** Linha do ranking geral de empresas (totais e média por pessoa activa) */
export type OrgRankEntry = {
  id: string
  name: string
  sector: string
  members: number
  seconds: number
  tasks: number
  points: number
  isMine: boolean
  /** escondida do ranking geral (só a própria equipa a vê) */
  hidden?: boolean
}

export type RankEntry = {
  id: string
  name: string
  picture?: string
  departmentId?: string
  seconds: number
  tasks: number
  points: number
  isMe: boolean
}
