export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** keepalive: o pedido continua mesmo que a página feche (ex.: guardar o tempo ao sair de um jogo) */
type Options = { method?: string; body?: unknown; form?: FormData; headers?: Record<string, string>; keepalive?: boolean }

/**
 * Token da sessão do Clerk (definido pelo AccountProvider). Vai em cada pedido para o servidor
 * não depender do cookie, que pode estar expirado quando o separador volta de segundo plano
 * ou logo a seguir ao login.
 */
let getToken: (() => Promise<string | null>) | null = null
export const setTokenSource = (fn: typeof getToken) => { getToken = fn }

/**
 * Todos os pedidos à API passam pelo proxy (/api/proxy/...): é a única porta pública.
 * O resto do código continua a escrever os endereços como "/api/...".
 */
export const apiUrl = (url: string) => (url.startsWith('/api/') && !url.startsWith('/api/proxy/') ? `/api/proxy/${url.slice(5)}` : url)

export async function api<T = { ok: true }>(path: string, opts: Options = {}): Promise<T> {
  const url = apiUrl(path)
  const headers: Record<string, string> = { ...opts.headers }
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
      keepalive: opts.keepalive,
    })
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Erro ${res.status}`)
  return data as T
}

/**
 * Para as actualizações periódicas (polling): se o servidor devolveu exactamente o mesmo,
 * fica o valor antigo. Um array novo com o mesmo conteúdo faria redesenhar a app inteira.
 */
export const keepIfSame = <T,>(prev: T, next: T): T => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)

export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Algo correu mal')

export const fileUrl = (orgBase: string, taskId: string, id: string, view = false) =>
  apiUrl(`${orgBase}/tasks/${taskId}/attachments?id=${encodeURIComponent(id)}${view ? '&ver=1' : ''}`)

/** Para temporizadores: só corre com o separador à vista (escondido não vale a pena ir ao servidor) */
export const whenVisible = (fn: () => unknown) => () => {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') fn()
}

/** Para recarregar ao voltar à janela: ignora se já correu há menos de "ms" (Alt+Tab seguidos) */
export function throttled(fn: () => unknown, ms = 15 * 1000) {
  let last = 0
  return () => {
    const n = Date.now()
    if (n - last < ms) return
    last = n
    fn()
  }
}
