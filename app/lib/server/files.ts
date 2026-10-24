import { promises as fs } from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { UPLOAD_DIR } from './store-file'

/**
 * Anexos das tarefas. Com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vão para o Supabase
 * Storage (bucket privado "attachments"); sem eles ficam em .data/uploads.
 */

const BUCKET = 'attachments'
const g = globalThis as unknown as { __neemaStorage?: SupabaseClient; __neemaBucket?: Promise<void> }

const usingSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

function storage() {
  g.__neemaStorage ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return g.__neemaStorage.storage
}

/** Cria o bucket privado na primeira utilização */
function bucket() {
  g.__neemaBucket ??= (async () => {
    const { data } = await storage().getBucket(BUCKET)
    if (!data) {
      const { error } = await storage().createBucket(BUCKET, { public: false })
      if (error && !/already exists/i.test(error.message)) throw error
    }
  })().catch(err => {
    g.__neemaBucket = undefined
    throw err
  })
  return g.__neemaBucket
}

const localPath = (id: string) => path.join(UPLOAD_DIR, path.basename(id))

export async function saveFile(id: string, bytes: Buffer, contentType: string) {
  if (usingSupabase()) {
    await bucket()
    const { error } = await storage().from(BUCKET).upload(id, bytes, { contentType, upsert: true })
    if (error) throw error
    return
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(localPath(id), bytes)
}

export async function readFile(id: string): Promise<Buffer | null> {
  if (usingSupabase()) {
    const { data, error } = await storage().from(BUCKET).download(id)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  }
  return fs.readFile(localPath(id)).catch(() => null)
}

export async function removeFiles(ids: string[]) {
  if (ids.length === 0) return
  if (usingSupabase()) {
    await storage().from(BUCKET).remove(ids)
    return
  }
  await Promise.all(ids.map(id => fs.rm(localPath(id), { force: true })))
}
