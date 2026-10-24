import { promises as fs } from 'fs'
import path from 'path'
import { emptyDB, type DB } from './store'

/** Armazenamento num ficheiro JSON (.data/db.json), para desenvolvimento sem base de dados */

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
    // ficheiro inexistente (ou apagado): começa vazio
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

export function read(): Promise<DB> {
  return load()
}

export function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await load()
    const result = await fn(db)
    await persist(db)
    g.__neemaMtime = (await fileMtime()) ?? undefined
    return result
  }
  const next = (g.__neemaQueue ?? Promise.resolve()).then(run, run)
  g.__neemaQueue = next.catch(() => undefined)
  return next
}
