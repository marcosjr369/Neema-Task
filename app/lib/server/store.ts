import crypto from 'crypto'
import type { Department, Member, Org, PresenceSegment, Session, Task, User } from '../../types'
import * as fileStore from './store-file'
import * as pgStore from './store-pg'

/**
 * Acesso a dados. As rotas usam só read()/mutate():
 * - com DATABASE_URL (Supabase/Postgres): cada pedido carrega apenas o âmbito pedido
 *   (ex.: os dados de uma empresa) e no fim grava só as linhas que mudaram;
 * - sem DATABASE_URL: ficheiro JSON local em .data/ (desenvolvimento sem internet).
 */

/** Dispositivo que aceitou notificações push */
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
  /** tarefas pessoais (ownerId) e de empresa (orgId) */
  tasks: Task[]
  /** sessões pessoais (userId) e de empresa (memberId) */
  sessions: Session[]
  presence: PresenceSegment[]
  push: PushRecord[]
}

export type Table = keyof DB
export const TABLES: Table[] = ['users', 'orgs', 'departments', 'members', 'tasks', 'sessions', 'presence', 'push']

export const emptyDB = (): DB => ({
  users: [], orgs: [], departments: [], members: [], tasks: [], sessions: [], presence: [], push: [],
})

/** Condição sobre uma coluna: valor (=), lista (IN), null (IS NULL) ou { gte } (>=) */
export type Condition = string | number | null | (string | number)[] | { gte: number }

export type Loader = {
  db: DB
  /** junta ao "db" as linhas da tabela que cumprem todas as condições (colunas em snake_case) */
  load: (table: Table, where?: Record<string, Condition>) => Promise<void>
}

/** O que carregar: 'all' (tudo) ou uma função que pede só o necessário */
export type Scope = 'all' | ((l: Loader) => Promise<void>)

export const usingPostgres = () => !!process.env.DATABASE_URL

export function read(scope: Scope = 'all'): Promise<DB> {
  return usingPostgres() ? pgStore.read(scope) : fileStore.read()
}

/** Executa alterações em série (transacção com bloqueio no Postgres) e grava no fim */
export function mutate<T>(scope: Scope, fn: (db: DB) => T | Promise<T>): Promise<T> {
  return usingPostgres() ? pgStore.mutate(scope, fn) : fileStore.mutate(fn)
}

export const newId = () => crypto.randomUUID()

export function inviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[crypto.randomInt(chars.length)]
  return out
}
