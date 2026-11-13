import crypto from 'crypto'
import type { Board, CalendarEvent, DeletedUser, Department, Diagram, Member, Org, PresenceSegment, Session, ShareGrant, Sheet, Task, User } from '../../types'
import * as fileStore from './store-file'
import * as pgStore from './store-pg'

/**
 * Acesso a dados. As rotas usam só read()/mutate():
 * - com DATABASE_URL (Supabase/Postgres): cada pedido carrega apenas o âmbito pedido
 *   (ex.: os dados de uma empresa) e no fim grava só as linhas que mudaram;
 * - sem DATABASE_URL: ficheiro JSON local em .data/ (desenvolvimento sem internet).
 */

export type PushRecord = {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userId: string
  createdAt: number
  userAgent?: string
}

export type DB = {
  users: User[]
  orgs: Org[]
  departments: Department[]
  members: Member[]
  tasks: Task[]
  sessions: Session[]
  presence: PresenceSegment[]
  push: PushRecord[]
  events: CalendarEvent[]
  deleted: DeletedUser[]
  boards: Board[]
  grants: ShareGrant[]
  sheets: Sheet[]
  diagrams: Diagram[]
}

export type Table = keyof DB
export const TABLES: Table[] = ['users', 'orgs', 'departments', 'members', 'tasks', 'sessions', 'presence', 'push', 'events', 'deleted', 'boards', 'grants', 'sheets', 'diagrams']

export const emptyDB = (): DB => ({
  users: [], orgs: [], departments: [], members: [], tasks: [], sessions: [], presence: [], push: [], events: [], deleted: [], boards: [], grants: [], sheets: [], diagrams: [],
})

export type Condition = string | number | null | (string | number)[] | { gte?: number; lte?: number }

export type Loader = {
  db: DB
  load: (table: Table, where?: Record<string, Condition>) => Promise<void>
}

/** 'all': todas as tabelas; lista: essas tabelas inteiras (num só pedido); função: carregamento à medida */
export type Scope = 'all' | Table[] | ((l: Loader) => Promise<void>)

export const usingPostgres = () => !!process.env.DATABASE_URL

export function read(scope: Scope = 'all'): Promise<DB> {
  return usingPostgres() ? pgStore.read(scope) : fileStore.read()
}

const g = globalThis as unknown as { __neemaUsers?: Map<string, unknown>; __neemaPanelDb?: unknown }

export async function mutate<T>(scope: Scope, fn: (db: DB) => T | Promise<T>): Promise<T> {
  try {
    return await (usingPostgres() ? pgStore.mutate(scope, fn) : fileStore.mutate(fn))
  } finally {
    // a conta em cache (só em desenvolvimento, ver auth.ts) pode ter mudado
    g.__neemaUsers?.clear()
    // os dados em memória do painel de administração (ver panel.ts)
    g.__neemaPanelDb = undefined
  }
}

export const newId = () => crypto.randomUUID()

export function inviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[crypto.randomInt(chars.length)]
  return out
}
