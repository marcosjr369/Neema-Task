import postgres from 'postgres'
import { emptyDB, TABLES, type Condition, type DB, type Loader, type Scope, type Table } from './store'

/**
 * Postgres (Supabase). Cada tabela guarda o objecto inteiro em "data" (jsonb) e, à parte,
 * as colunas usadas para filtrar. Um pedido carrega só o âmbito de que precisa; no fim de
 * mutate() comparamos com o que foi lido e gravamos apenas as linhas novas/alteradas/apagadas.
 * As escritas correm numa transacção com bloqueio global, por isso várias instâncias do
 * servidor (ex.: Vercel) não se atropelam.
 */

type Sql = postgres.Sql
type Row = Record<string, unknown>

const COLUMNS: Record<Table, (r: Row) => Record<string, string | number | null>> = {
  users: r => ({ id: r.id as string, clerk_id: (r.clerkId as string) ?? null, email: (r.email as string) ?? null }),
  orgs: r => ({ id: r.id as string, invite_code: r.inviteCode as string, domain: (r.domain as string) ?? null }),
  departments: r => ({ id: r.id as string, org_id: r.orgId as string }),
  members: r => ({ id: r.id as string, org_id: r.orgId as string, user_id: (r.userId as string) ?? null, email: (r.email as string) ?? null }),
  tasks: r => ({ id: r.id as string, org_id: (r.orgId as string) ?? null, owner_id: (r.ownerId as string) ?? null, assignee_id: (r.assigneeId as string) ?? null }),
  sessions: r => ({ id: r.id as string, task_id: r.taskId as string, user_id: (r.userId as string) ?? null, member_id: (r.memberId as string) ?? null, start_at: r.start as number }),
  presence: r => ({ id: r.id as string, org_id: r.orgId as string, member_id: r.memberId as string, start_at: r.start as number, end_at: (r.end as number) ?? null }),
  push: r => ({ id: r.endpoint as string, user_id: r.userId as string }),
  events: r => ({ id: r.id as string, org_id: (r.orgId as string) ?? null, owner_id: (r.ownerId as string) ?? null, start_at: r.start as number }),
  deleted: r => ({ id: r.id as string, deleted_at: r.deletedAt as number }),
  boards: r => ({
    id: r.id as string,
    org_id: (r.orgId as string) ?? null,
    owner_id: r.ownerId as string,
    token: (r.sharing as { token?: string } | undefined)?.token ?? null,
  }),
  sheets: r => ({
    id: r.id as string,
    org_id: (r.orgId as string) ?? null,
    owner_id: r.ownerId as string,
    token: (r.sharing as { token?: string } | undefined)?.token ?? null,
  }),
  diagrams: r => ({
    id: r.id as string,
    org_id: (r.orgId as string) ?? null,
    owner_id: r.ownerId as string,
    token: (r.sharing as { token?: string } | undefined)?.token ?? null,
  }),
  grants: r => ({ id: r.id as string, resource_id: r.resourceId as string, email: (r.email as string) ?? null, user_id: (r.userId as string) ?? null }),
}

const keyOf = (table: Table, r: Row) => (table === 'push' ? (r.endpoint as string) : (r.id as string))

const SCHEMA = `
create table if not exists users (id text primary key, clerk_id text, email text, data jsonb not null);
create unique index if not exists users_clerk_id on users (clerk_id);
create index if not exists users_email on users (email);
create table if not exists orgs (id text primary key, invite_code text, domain text, data jsonb not null);
create unique index if not exists orgs_invite_code on orgs (invite_code);
create index if not exists orgs_domain on orgs (domain);
create table if not exists departments (id text primary key, org_id text not null, data jsonb not null);
create index if not exists departments_org on departments (org_id);
create table if not exists members (id text primary key, org_id text not null, user_id text, email text, data jsonb not null);
create index if not exists members_org on members (org_id);
create index if not exists members_user on members (user_id);
create index if not exists members_email on members (email);
create table if not exists tasks (id text primary key, org_id text, owner_id text, assignee_id text, data jsonb not null);
create index if not exists tasks_org on tasks (org_id);
create index if not exists tasks_owner on tasks (owner_id);
create table if not exists sessions (id text primary key, task_id text not null, user_id text, member_id text, start_at bigint not null, data jsonb not null);
create index if not exists sessions_user on sessions (user_id, start_at);
create index if not exists sessions_member on sessions (member_id, start_at);
create index if not exists sessions_task on sessions (task_id);
create table if not exists presence (id text primary key, org_id text not null, member_id text not null, start_at bigint not null, end_at bigint, data jsonb not null);
create index if not exists presence_org on presence (org_id, start_at);
create index if not exists presence_member_open on presence (member_id) where end_at is null;
create table if not exists push (id text primary key, user_id text not null, data jsonb not null);
create index if not exists push_user on push (user_id);
create table if not exists events (id text primary key, org_id text, owner_id text, start_at bigint not null, data jsonb not null);
create index if not exists events_org on events (org_id, start_at);
create index if not exists events_owner on events (owner_id, start_at);
create index if not exists events_start on events (start_at);
create table if not exists deleted (id text primary key, deleted_at bigint not null, data jsonb not null);
create index if not exists deleted_at on deleted (deleted_at);
create table if not exists boards (id text primary key, org_id text, owner_id text not null, token text, data jsonb not null);
create index if not exists boards_org on boards (org_id);
create index if not exists boards_owner on boards (owner_id);
create unique index if not exists boards_token on boards (token);
create table if not exists sheets (id text primary key, org_id text, owner_id text not null, token text, data jsonb not null);
create index if not exists sheets_org on sheets (org_id);
create index if not exists sheets_owner on sheets (owner_id);
create unique index if not exists sheets_token on sheets (token);
create table if not exists diagrams (id text primary key, org_id text, owner_id text not null, token text, data jsonb not null);
create index if not exists diagrams_org on diagrams (org_id);
create index if not exists diagrams_owner on diagrams (owner_id);
create unique index if not exists diagrams_token on diagrams (token);
create table if not exists grants (id text primary key, resource_id text not null, email text, user_id text, data jsonb not null);
create index if not exists grants_resource on grants (resource_id);
create index if not exists grants_email on grants (email);
create index if not exists grants_user on grants (user_id);
-- Sem políticas, o RLS fecha estas tabelas à API pública do Supabase (chaves anon/authenticated).
-- A app liga como dona das tabelas (DATABASE_URL), por isso não é afectada.
alter table users enable row level security;
alter table orgs enable row level security;
alter table departments enable row level security;
alter table members enable row level security;
alter table tasks enable row level security;
alter table sessions enable row level security;
alter table presence enable row level security;
alter table push enable row level security;
alter table events enable row level security;
alter table deleted enable row level security;
alter table boards enable row level security;
alter table grants enable row level security;
alter table sheets enable row level security;
alter table diagrams enable row level security;
`

// "__neemaSchema6": muda de nome quando o esquema ganha tabelas, para o servidor em execução as criar
const g = globalThis as unknown as { __neemaSql?: Sql; __neemaSchema6?: Promise<void>; __neemaSlots?: Slots }

const POOL_MAX = Number(process.env.DATABASE_POOL_MAX) || 5

/**
 * Nunca mais pedidos em curso do que ligações.
 * Quando há mais pedidos do que ligações, o postgres.js envia vários na mesma ligação
 * (pipelining). O "transaction pooler" do Supabase (porta 6543) não lida com isso fora de uma
 * transacção e o pedido fica pendurado para sempre (ex.: 6 leituras em paralelo com 5 ligações).
 * Por isso cada leitura fora de transacção, e cada transacção inteira, ocupa uma vaga; os
 * restantes esperam pela sua vez. Dentro de uma transacção a ligação é exclusiva e pode-se
 * mandar vários pedidos seguidos sem problema.
 */
type Slots = { active: number; waiting: (() => void)[] }
const slots = (g.__neemaSlots ??= { active: 0, waiting: [] })

export async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (slots.active >= POOL_MAX) await new Promise<void>(resolve => slots.waiting.push(resolve))
  else slots.active++
  try {
    return await fn()
  } finally {
    // passa a vaga directamente ao próximo da fila (sem a libertar), ou liberta-a
    const next = slots.waiting.shift()
    if (next) next()
    else slots.active--
  }
}

function client(): Sql {
  if (!g.__neemaSql) {
    const url = process.env.DATABASE_URL!
    const local = /localhost|127\.0\.0\.1/.test(url)
    g.__neemaSql = postgres(url, {
      // o "transaction pooler" do Supabase (porta 6543) não suporta prepared statements
      prepare: false,
      max: POOL_MAX,
      // em produção (funções serverless) as ligações paradas fecham depressa; em desenvolvimento
      // reabrir uma ligação a uma base distante custa ~2 s, por isso ficam abertas mais tempo
      idle_timeout: process.env.NODE_ENV === 'production' ? 20 : 300,
      ssl: local ? false : 'require',
      onnotice: () => {},
    })
  }
  return g.__neemaSql
}

function ready(): Promise<void> {
  g.__neemaSchema6 ??= withSlot(() => client().unsafe(SCHEMA).then(() => undefined)).catch(err => {
    g.__neemaSchema6 = undefined
    throw err
  })
  return g.__neemaSchema6
}

function condition(sql: Sql, col: string, value: Condition) {
  const c = sql(col)
  if (value === null) return sql`${c} is null`
  if (Array.isArray(value)) return sql`${c} = any(${sql.array(value.map(String))})`
  if (typeof value === 'object') {
    if (value.gte !== undefined && value.lte !== undefined) return sql`${c} >= ${value.gte} and ${c} <= ${value.lte}`
    return value.lte !== undefined ? sql`${c} <= ${value.lte}` : sql`${c} >= ${value.gte ?? 0}`
  }
  return sql`${c} = ${value}`
}

type Snapshot = Map<string, string>

/** inTx: dentro de uma transacção (ligação exclusiva, não precisa de vaga) */
async function loadScope(sql: Sql, scope: Scope, inTx = false): Promise<{ db: DB; snap: Snapshot }> {
  const db = emptyDB()
  const snap: Snapshot = new Map()
  const load: Loader['load'] = async (table, where) => {
    const entries = Object.entries(where ?? {})
    // "x = any([])" não devolve nada: evita a ida à base de dados
    if (entries.some(([, v]) => Array.isArray(v) && v.length === 0)) return
    const conds = entries.map(([col, v]) => condition(sql, col, v))
    const filter = conds.length ? conds.reduce((acc, c) => sql`${acc} and ${c}`) : null
    const query = () => filter
      ? sql<{ data: Row }[]>`select data from ${sql(table)} where ${filter}`.execute()
      : sql<{ data: Row }[]>`select data from ${sql(table)}`.execute()
    const rows = inTx ? await query() : await withSlot(query)
    for (const { data } of rows) add(table, data)
  }
  const add = (table: Table, data: Row) => {
    const k = `${table}:${keyOf(table, data)}`
    if (snap.has(k)) return
    snap.set(k, JSON.stringify(data))
    ;(db[table] as unknown as Row[]).push(data)
  }
  if (typeof scope === 'function') {
    await scope({ db, load })
  } else {
    // tabelas inteiras: um só pedido ("union all") em vez de um por tabela, o que poupa
    // várias viagens à base de dados (com 5 ligações, 14 tabelas eram 3 viagens)
    const tables = scope === 'all' ? TABLES : [...new Set(scope)]
    if (tables.length) {
      const query = () => tables
        .map(t => sql`select ${t}::text as t, data from ${sql(t)}`)
        .reduce((a, b) => sql`${a} union all ${b}`)
        .execute() as unknown as Promise<{ t: Table; data: Row }[]>
      const rows = inTx ? await query() : await withSlot(query)
      for (const { t, data } of rows) add(t, data)
    }
  }
  return { db, snap }
}

const UPSERT_CHUNK = 1000

/**
 * Grava só o que mudou: por tabela, um único "insert … on conflict" com todas as linhas
 * novas/alteradas e um "delete" com as removidas. Os pedidos seguem todos de uma vez
 * (na mesma ligação da transacção), em vez de esperar pela resposta de cada um.
 */
async function save(sql: Sql, db: DB, snap: Snapshot) {
  const writes: Promise<unknown>[] = []
  for (const table of TABLES) {
    const rows = db[table] as unknown as Row[]
    const present = new Set<string>()
    const changed: Record<string, unknown>[] = []
    for (const row of rows) {
      const k = `${table}:${keyOf(table, row)}`
      present.add(k)
      if (snap.get(k) === JSON.stringify(row)) continue
      changed.push({ ...COLUMNS[table](row), data: sql.json(row as postgres.JSONValue) })
    }
    if (changed.length) {
      const cols = Object.keys(changed[0])
      const updates = cols
        .filter(c => c !== 'id')
        .map(c => sql`${sql(c)} = excluded.${sql(c)}`)
        .reduce((acc, f) => sql`${acc}, ${f}`)
      for (let i = 0; i < changed.length; i += UPSERT_CHUNK) {
        // os tipos do postgres.js não aceitam colunas dinâmicas; o SQL gerado é o normal
        const values = sql(changed.slice(i, i + UPSERT_CHUNK) as never, cols as never) as unknown as postgres.Fragment
        writes.push(sql`insert into ${sql(table)} ${values} on conflict (id) do update set ${updates}`.execute())
      }
    }
    // só apaga o que foi lido neste pedido e já não está na lista
    const removed = [...snap.keys()].filter(k => k.startsWith(`${table}:`) && !present.has(k)).map(k => k.slice(table.length + 1))
    if (removed.length) writes.push(sql`delete from ${sql(table)} where id = any(${sql.array(removed)})`.execute())
  }
  await Promise.all(writes)
}

export async function read(scope: Scope): Promise<DB> {
  await ready()
  return (await loadScope(client(), scope)).db
}

export async function mutate<T>(scope: Scope, fn: (db: DB) => T | Promise<T>): Promise<T> {
  await ready()
  return withSlot(() => client().begin(async tx => {
    // uma escrita de cada vez em todo o sistema (simples e seguro para equipas pequenas/médias).
    // O bloqueio segue logo, seguido das leituras na mesma ligação: o servidor trata-os por ordem,
    // por isso as leituras só correm com o bloqueio já obtido, sem esperar uma viagem de rede a mais.
    const lock = tx`select pg_advisory_xact_lock(7301)`.execute()
    const [, { db, snap }] = await Promise.all([lock, loadScope(tx as unknown as Sql, scope, true)])
    const result = await fn(db)
    await save(tx as unknown as Sql, db, snap)
    return result
  })) as Promise<T>
}
