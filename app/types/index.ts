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
  focusDuration: number
  deadline?: string
  tags: string[]
  createdAt: number
  completedAt?: number
  notified?: boolean
  checklist?: ChecklistItem[]
} & OrgTaskFields

export type Session = {
  id: string
  taskId: string
  category: TaskCategory
  start: number
  end: number
  seconds: number
  memberId?: string
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
  blockSeconds: number
  breakSeconds: number
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
  color: string
  dark: string
  light: string
  defaultFocus: number
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
  rejections: number
}

export type Recurrence = 'diaria' | 'semanal' | 'mensal'

export type OrgTaskFields = {
  ownerId?: string
  orgId?: string
  assigneeId?: string
  createdBy?: string
  departmentId?: string
  reviewerId?: string
  requiresApproval?: boolean
  requiresAttachment?: boolean
  /**
   * Tarefa de grupo: a mesma tarefa atribuída a várias pessoas. Cada pessoa tem a sua cópia
   * (estado, tempo, checklist, anexos, comentários e revisão próprios), todas com o mesmo groupId.
   */
  groupId?: string
  /** repetição a que a cópia pertence (tarefas recorrentes de grupo; vazio = 0) */
  occurrence?: number
  /** só nas respostas do servidor (não se grava): quantas pessoas têm a tarefa e quantas concluíram */
  groupSummary?: { total: number; done: number }
  review?: Review
  attachments?: Attachment[]
  comments?: TaskComment[]
  recurrence?: Recurrence
  updatedAt?: number
}

export type RankingVisibility = 'nome' | 'iniciais' | 'oculto'

export type AccountType = 'personal' | 'business'

export type BusinessRole = 'company' | 'employee'

export type User = {
  id: string
  email: string
  name: string
  picture?: string
  /** false quando o fornecedor não confirmou o email (não entra em empresas pelo domínio) */
  emailVerified?: boolean
  clerkId?: string
  createdAt: number
  rankingVisibility: RankingVisibility
  accountType?: AccountType
  businessRole?: BusinessRole
  disabled?: boolean
  disabledAt?: number
  settings?: Partial<Settings>
  workspace?: Workspace
  timers?: Record<string, ActiveTimer>
  timezone?: string
  lastNudgeAt?: number
  nudgeCount?: number
  /** tutorial: quando viu as boas-vindas e que lições já fez */
  tutorial?: TutorialProgress
}

export type TutorialProgress = { seenAt?: number; done?: string[] }

export type DeletedUser = {
  id: string
  name: string
  email: string
  picture?: string
  type: AccountType | 'none'
  createdAt: number
  deletedAt: number
  reason?: string
  orgs: string[]
  deletedOrgs: string[]
  focusSeconds: number
  tasksDone: number
}

export type Role = 'admin' | 'supervisor' | 'membro'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  membro: 'Funcionário',
}

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

export const COMPANY_ACCOUNT_LABEL = 'Conta da empresa'

export type Org = {
  id: string
  name: string
  sector: string
  size?: string
  domain?: string
  inviteCode: string
  createdAt: number
  createdBy: string
  hideFromRanking?: boolean
  /** meta diária de trabalho activo por pessoa, em horas (vazio = 8h) */
  dailyGoalHours?: number
}

export type Department = {
  id: string
  orgId: string
  name: string
  color: string
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
  consentAt?: number
  presence: PresenceStatus
  lastSeen?: number
  workStart?: number
  history?: CarriedHistory
}

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

export type Workspace = { kind: 'personal' } | { kind: 'org'; orgId: string; memberId: string }

export type RankMetric = 'points' | 'hours' | 'tasks'

export type OrgRankEntry = {
  id: string
  name: string
  sector: string
  members: number
  seconds: number
  tasks: number
  points: number
  isMine: boolean
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

export type EventKind = 'reuniao' | 'compromisso' | 'lembrete'

export const EVENT_KINDS: Record<EventKind, { label: string; color: string; light: string }> = {
  reuniao: { label: 'Reunião', color: '#7B61FF', light: '#EEEAFF' },
  compromisso: { label: 'Compromisso', color: '#12B5A6', light: '#DCF7F3' },
  lembrete: { label: 'Lembrete', color: '#FF8A3D', light: '#FFEDE0' },
}

export type EventResponse = 'sim' | 'nao'

export type CalendarEvent = {
  id: string
  orgId?: string
  ownerId?: string
  createdBy: string
  title: string
  description?: string
  kind: EventKind
  start: number
  end: number
  location?: string
  attendeeIds: string[]
  responses?: Record<string, EventResponse>
  sentPre?: boolean
  sentStart?: boolean
  createdAt: number
  updatedAt: number
}

export const EVENT_LEAD_MINUTES = 5

/* ─── Partilha (quadros e, mais tarde, planilhas) ─────────────────────── */

export type ShareRole = 'view' | 'edit'

/**
 * - org: todos os membros activos da empresa (com orgRole);
 * - link: qualquer pessoa com o link vê, mesmo sem conta (só quadros pessoais);
 * - private: só quem foi convidado, ou quem souber a senha (se houver).
 */
export type ShareVisibility = 'org' | 'link' | 'private'

export type Sharing = {
  visibility: ShareVisibility
  orgRole?: ShareRole
  /** parte final do link público (/p/<token>) */
  token: string
  /** só no servidor: nunca vai para o browser */
  password?: { salt: string; hash: string; at: number }
}

/** O que o browser recebe da partilha */
export type SharingInfo = Omit<Sharing, 'password' | 'token'> & { token?: string; hasPassword: boolean }

export type ShareKind = 'board' | 'sheet' | 'diagram'

export type ShareGrant = {
  id: string
  resourceId: string
  kind: ShareKind
  email: string
  userId?: string
  name?: string
  /** pending: pedido de acesso à espera do dono */
  role: ShareRole | 'pending'
  createdAt: number
  invitedBy?: string
}

export type Access = 'owner' | 'edit' | 'view'


/* ─── Quadros ─────────────────────────────────────────────────────────── */

export type BoardLabel = { id: string; name: string; color: string }

export type BoardList = {
  id: string
  title: string
  color?: string
  pinned?: boolean
  archived?: boolean
  createdAt: number
}

export type CardComment = { id: string; userId: string; name: string; text: string; at: number }

export type BoardCard = {
  id: string
  listId: string
  title: string
  description?: string
  labelIds: string[]
  /** ids de utilizador */
  memberIds: string[]
  /** AAAA-MM-DD */
  start?: string
  due?: string
  dueDone?: boolean
  /** cor da capa */
  cover?: string
  checklist?: ChecklistItem[]
  comments?: CardComment[]
  archived?: boolean
  createdAt: number
  createdBy: string
  updatedAt: number
}

export type Board = {
  id: string
  title: string
  description?: string
  color: string
  /** foto de fundo (id de BOARD_IMAGES); vazio = só a cor */
  background?: string
  /** quadro da empresa (vazio = pessoal) */
  orgId?: string
  /** utilizador que criou e gere o quadro */
  ownerId: string
  createdAt: number
  updatedAt: number
  lists: BoardList[]
  cards: BoardCard[]
  labels: BoardLabel[]
  sharing: Sharing
}

/** Quadro como chega ao browser (sem a senha) */
export type BoardView = Omit<Board, 'sharing'> & { sharing: SharingInfo }

export type BoardPerson = { userId: string; name: string; picture?: string }

export type BoardSummary = {
  id: string
  title: string
  color: string
  background?: string
  orgId?: string
  orgName?: string
  ownerName?: string
  mine: boolean
  access: Access
  visibility: ShareVisibility
  lists: number
  cards: number
  updatedAt: number
}

/* ─── Planilhas ───────────────────────────────────────────────────────── */

export type CellAlign = 'left' | 'center' | 'right'

/** num2: 2 casas decimais; eur: moeda; pct: percentagem */
export type NumberFormat = 'num2' | 'eur' | 'pct'

export type CellFmt = { b?: boolean; i?: boolean; align?: CellAlign; bg?: string; nf?: NumberFormat }

export type SheetTab = {
  id: string
  name: string
  rows: number
  cols: number
  /** "A1" → o que foi escrito (texto, número ou fórmula começada por "=") */
  cells: Record<string, string>
  fmt?: Record<string, CellFmt>
  /** largura das colunas em px, por índice */
  widths?: Record<string, number>
}

export type Sheet = {
  id: string
  title: string
  orgId?: string
  ownerId: string
  createdAt: number
  updatedAt: number
  tabs: SheetTab[]
  sharing: Sharing
}

export type SheetView = Omit<Sheet, 'sharing'> & { sharing: SharingInfo }

export type SheetSummary = Omit<BoardSummary, 'lists' | 'cards' | 'color'> & { tabs: number }

/* ─── Diagramas ───────────────────────────────────────────────────────── */

/** Diagrama/fluxo desenhado no editor do diagrams.net (draw.io), guardado como XML */
export type Diagram = {
  id: string
  title: string
  orgId?: string
  ownerId: string
  createdAt: number
  updatedAt: number
  /** quem gravou o conteúdo por último */
  updatedBy?: string
  /** conteúdo no formato do draw.io (<mxfile>…) */
  xml: string
  /** versão: sobe a cada gravação do conteúdo (para não apagar as alterações de outra pessoa) */
  rev: number
  /** miniatura (data:image/svg+xml;base64,…), mostrada só com <img> */
  preview?: string
  sharing: Sharing
}

export type DiagramView = Omit<Diagram, 'sharing'> & { sharing: SharingInfo }

export type DiagramSummary = Omit<BoardSummary, 'lists' | 'cards' | 'color' | 'background'> & { preview?: string }
