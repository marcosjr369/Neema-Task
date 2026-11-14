import { promises as fs } from 'fs'
import path from 'path'
import { emptyDB, TABLES, type DB, type Loader, type Scope, type Table } from './store'
import { keyOf, matches } from './columns'

type Row = Record<string, unknown>
type Snapshot = Map<string, string>

// NEEMA_DATA_DIR permite usar outra pasta (ex.: testes sem tocar nos dados do servidor de desenvolvimento)
export const DATA_DIR = process.env.NEEMA_DATA_DIR ? path.resolve(process.env.NEEMA_DATA_DIR) : path.join(process.cwd(), '.data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DB_FILE = path.join(DATA_DIR, 'db.json')

// Cache em memória partilhada entre recarregamentos do servidor de desenvolvimento.
// Guarda a data de modificação do ficheiro: se alguém o apagar ou alterar por fora
// (ex.: limpar a pasta .data com o servidor ligado), recarrega em vez de reescrever dados antigos.
const g = globalThis as unknown as { __neemaDb?: DB; __neemaMtime?: number; __neemaQueue?: Promise<unknown> }

async function fileMtime() {
  try {
    return (await fs.stat(DB_FILE)).mtimeMs
  } catch {
    return null
  }
}

async function load(): Promise<DB> {
  const mtime = await fileMtime()
  if (g.__neemaDb && mtime !== null && mtime === g.__neemaMtime) return g.__neemaDb
  let db: DB
  try {
    db = { ...emptyDB(), ...JSON.parse(await fs.readFile(DB_FILE, 'utf8')) }
  } catch {
    db = emptyDB()
    await persist(db)
  }
  g.__neemaDb = db
  g.__neemaMtime = (await fileMtime()) ?? undefined
  return db
}

async function persist(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const data = JSON.stringify(db)
  const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, data)
  // No Windows o rename falha (EPERM/EBUSY) se outro processo tiver o ficheiro aberto
  // (antivírus, indexação, editor): tenta de novo e, em último caso, escreve directamente.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rename(tmp, DB_FILE)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw err
      await new Promise(r => setTimeout(r, 30 * (attempt + 1)))
    }
  }
  await fs.writeFile(DB_FILE, data)
  await fs.rm(tmp, { force: true })
}

/**
 * Uma cópia só com o âmbito pedido, filtrada como no Postgres (ver columns.ts). Antes devolvia a
 * base inteira: "a conta com este clerkId" era a primeira conta do ficheiro, um código de convite
 * qualquer encontrava a primeira empresa, etc. Erros que só se viam em produção (ou nunca).
 */
async function scoped(full: DB, scope: Scope): Promise<{ db: DB; snap: Snapshot }> {
  const db = emptyDB()
  const snap: Snapshot = new Map()
  const add = (table: Table, row: Row) => {
    const k = `${table}:${keyOf(table, row)}`
    if (snap.has(k)) return
    const json = JSON.stringify(row)
    snap.set(k, json)
    ;(db[table] as unknown as Row[]).push(JSON.parse(json))
  }
  if (typeof scope === 'function') {
    const load: Loader['load'] = async (table, where) => {
      if (Object.values(where ?? {}).some(v => Array.isArray(v) && v.length === 0)) return
      for (const row of full[table] as unknown as Row[]) if (matches(table, row, where)) add(table, row)
    }
    await scope({ db, load })
  } else {
    for (const table of scope === 'all' ? TABLES : [...new Set(scope)]) for (const row of full[table] as unknown as Row[]) add(table, row)
  }
  return { db, snap }
}

/** Aplica à base inteira o que mudou na cópia: linhas novas/alteradas e as que saíram (como no Postgres) */
function apply(full: DB, db: DB, snap: Snapshot) {
  for (const table of TABLES) {
    const rows = db[table] as unknown as Row[]
    const target = full[table] as unknown as Row[]
    const index = new Map(target.map((r, i) => [keyOf(table, r), i]))
    const present = new Set<string>()
    for (const row of rows) {
      const key = keyOf(table, row)
      present.add(key)
      if (snap.get(`${table}:${key}`) === JSON.stringify(row)) continue
      const i = index.get(key)
      if (i === undefined) { index.set(key, target.length); target.push(row) } else target[i] = row
    }
    const removed = new Set([...snap.keys()].filter(k => k.startsWith(`${table}:`)).map(k => k.slice(table.length + 1)).filter(k => !present.has(k)))
    if (removed.size) (full as unknown as Record<Table, Row[]>)[table] = target.filter(r => !removed.has(keyOf(table, r)))
  }
}

export async function read(scope: Scope = 'all'): Promise<DB> {
  return (await scoped(await load(), scope)).db
}

export function mutate<T>(scope: Scope, fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const full = await load()
    const { db, snap } = await scoped(full, scope)
    const result = await fn(db)
    apply(full, db, snap)
    await persist(full)
    g.__neemaMtime = (await fileMtime()) ?? undefined
    return result
  }
  const next = (g.__neemaQueue ?? Promise.resolve()).then(run, run)
  g.__neemaQueue = next.catch(() => undefined)
  return next
}
