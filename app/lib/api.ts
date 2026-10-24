/** Cliente HTTP da API interna (/api/...) */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Options = { method?: string; body?: unknown; form?: FormData }

export async function api<T = { ok: true }>(url: string, opts: Options = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Erro ${res.status}`)
  return data as T
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Algo correu mal')

/** Endereço de um anexo de tarefa de empresa ("view" abre no browser em vez de descarregar) */
export const fileUrl = (orgBase: string, taskId: string, id: string, view = false) =>
  `${orgBase}/tasks/${taskId}/attachments?id=${encodeURIComponent(id)}${view ? '&ver=1' : ''}`
