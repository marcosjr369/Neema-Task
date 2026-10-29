/** Cliente HTTP da API interna (/api/...) */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Options = { method?: string; body?: unknown; form?: FormData }

/**
 * Token da sessão do Clerk (definido pelo AccountProvider). Vai em cada pedido para o servidor
 * não depender do cookie, que pode estar expirado quando o separador volta de segundo plano
 * ou logo a seguir ao login.
 */
let getToken: (() => Promise<string | null>) | null = null
export const setTokenSource = (fn: typeof getToken) => { getToken = fn }

export async function api<T = { ok: true }>(url: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = await getToken?.().catch(() => null)
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      headers,
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
