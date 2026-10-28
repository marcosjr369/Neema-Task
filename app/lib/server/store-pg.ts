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

/** Colunas de filtro de cada tabela, calculadas a partir do objecto */
const COLUMNS: Record<Table, (r: Row) => Record<string, string | number | null>> = {
  users: r => ({ id: r.id as string, clerk_id: (r.clerkId as string) ?? null, email: (r.email as string) ?? null }),
  orgs: r => ({ id: r.id as string, invite_code: r.inviteCode as string, domain: (r.domain as string) ?? null }),
  departments: r => ({ id: r.id as string, org_id: r.orgId as string }),
  members: r => ({ id: r.id as string, org_id: r.orgId as string, user_id: (r.userId as string) ?? null, email: (r.email as string) ?? null }),
  tasks: r => ({ id: r.id as string, org_id: (r.orgId as string) ?? null, owner_id: (r.ownerId as string) ?? null, assignee_id: (r.assigneeId as string) ?? null }),
  sessions: r => ({ id: r.id as string, task_id: r.taskId as string, user_id: (r.userId as string) ?? null, member_id: (r.memberId as string) ?? null, start_at: r.start as number }),
  presence: r => ({ id: r.id as string, org_id: r.orgId as string, member_id: r.memberId as string, start_at: r.start as number, end_at: (r.end as number) ?? null }),
  push: r => ({ id: r.endpoint as string, user_id: r.userId as string }),
  deleted: r => ({ id: r.id as string, deleted_at: r.deletedAt as number }),
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
create table if not exists deleted (id text primary key, deleted_at bigint not null, data jsonb not null);
create index if not exists deleted_at on deleted (deleted_at);
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
alter table deleted enable row level security;
`

// "__neemaSchema2": muda de nome quando o esquema ganha tabelas, para o servidor em execução as criar
const g = globalThis as unknown as { __neemaSql?: Sql; __neemaSchema2?: Promise<void> }

function client(): Sql {
  if (!g.__neemaSql) {
    const url = process.env.DATABASE_URL!
    const local = /localhost|127\.0\.0\.1/.test(url)
    g.__neemaSql = postgres(url, {
      // o "transaction pooler" do Supabase (porta 6543) não suporta prepared statements
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX) || 5,
      idle_timeout: 20,
      ssl: local ? false : 'require',
      onnotice: () => {},
    })
  }
  return g.__neemaSql
}

/** Cria as tabelas na primeira utilização (idempotente) */
function ready(): Promise<void> {
  g.__neemaSchema2 ??= client().unsafe(SCHEMA).then(() => undefined).catch(err => {
    g.__neemaSchema2 = undefined
    throw err
  })
  return g.__neemaSchema2
}

function condition(sql: Sql, col: string, value: Condition) {
  const c = sql(col)
  if (value === null) return sql`${c} is null`
  if (Array.isArray(value)) return sql`${c} = any(${sql.array(value.map(String))})`
  if (typeof value === 'object') return sql`${c} >= ${value.gte}`
  return sql`${c} = ${value}`
}

type Snapshot = Map<string, string>

async function loadScope(sql: Sql, scope: Scope): Promise<{ db: DB; snap: Snapshot }> {
  const db = emptyDB()
  const snap: Snapshot = new Map()
  const load: Loader['load'] = async (table, where) => {
    const entries = Object.entries(where ?? {})
    // "x = any([])" não devolve nada: evita a ida à base de dados
    if (entries.some(([, v]) => Array.isArray(v) && v.length === 0)) return
    const conds = entries.map(([col, v]) => condition(sql, col, v))
    const filter = conds.length ? conds.reduce((acc, c) => sql`${acc} and ${c}`) : null
    const rows = filter
      ? await sql<{ data: Row }[]>`select data from ${sql(table)} where ${filter}`
      : await sql<{ data: Row }[]>`select data from ${sql(table)}`
    const list = db[table] as unknown as Row[]
    for (const { data } of rows) {
      const k = `${table}:${keyOf(table, data)}`
      if (snap.has(k)) continue // já carregada por outra condição
      snap.set(k, JSON.stringify(data))
      list.push(data)
    }
  }
  if (scope === 'all') {
    for (const t of TABLES) await load(t)
  } else {
    await scope({ db, load })
  }
  return { db, snap }
}

async function save(sql: Sql, db: DB, snap: Snapshot) {
  for (const table of TABLES) {
    const rows = db[table] as unknown as Row[]
    const present = new Set<string>()
    for (const row of rows) {
      const k = `${table}:${keyOf(table, row)}`
      present.add(k)
      const json = JSON.stringify(row)
      if (snap.get(k) === json) continue
      const record: Record<string, unknown> = { ...COLUMNS[table](row), data: sql.json(row as postgres.JSONValue) }
      const cols = Object.keys(record)
      // os tipos do postgres.js não aceitam colunas dinâmicas; o SQL gerado é o normal
      const values = sql(record as never, cols as never) as unknown as postgres.Fragment
      const updates = sql(record as never, cols.filter(c => c !== 'id') as never) as unknown as postgres.Fragment
      await sql`insert into ${sql(table)} ${values} on conflict (id) do update set ${updates}`
    }
    // só apaga o que foi lido neste pedido e já não está na lista
    const removed = [...snap.keys()].filter(k => k.startsWith(`${table}:`) && !present.has(k)).map(k => k.slice(table.length + 1))
    if (removed.length) await sql`delete from ${sql(table)} where id = any(${sql.array(removed)})`
  }
}

export async function read(scope: Scope): Promise<DB> {
  await ready()
  return (await loadScope(client(), scope)).db
}

export async function mutate<T>(scope: Scope, fn: (db: DB) => T | Promise<T>): Promise<T> {
  await ready()
  return client().begin(async tx => {
    // uma escrita de cada vez em todo o sistema (simples e seguro para equipas pequenas/médias)
    await tx`select pg_advisory_xact_lock(7301)`
    const { db, snap } = await loadScope(tx as unknown as Sql, scope)
    const result = await fn(db)
    await save(tx as unknown as Sql, db, snap)
    return result
  }) as Promise<T>
}
