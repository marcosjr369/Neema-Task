/**
 * Erro com uma mensagem escrita para o utilizador (pode ser mostrada tal como está).
 * Qualquer outro erro (TypeError, erros de bibliotecas, ...) nunca é mostrado: em vez dele
 * aparece uma mensagem amigável do contexto (ver errorText).
 */
export class UserError extends Error {}

/** Mensagens para quando o servidor não explica o erro (ou a explicação é técnica). */
const STATUS_TEXT: Record<number, string> = {
  0: 'Sem ligação à internet. Verifica a tua ligação e tenta outra vez.',
  400: 'Não foi possível concluir o pedido. Confirma os dados e tenta outra vez.',
  401: 'A tua sessão expirou. Entra novamente.',
  403: 'Não tens permissão para fazer isto.',
  404: 'Não encontrado.',
  408: 'O servidor demorou demasiado a responder. Tenta outra vez.',
  409: 'Isto foi alterado entretanto. Actualiza a página e tenta outra vez.',
  413: 'O ficheiro ou o conteúdo é demasiado grande.',
  429: 'Demasiados pedidos. Espera um pouco e tenta outra vez.',
  504: 'O servidor demorou demasiado a responder. Tenta outra vez.',
}
const SERVER_TEXT = 'Algo correu mal do nosso lado. Tenta outra vez dentro de momentos.'
export const GENERIC_ERROR = 'Algo correu mal. Tenta outra vez.'

export const statusText = (status: number) =>
  STATUS_TEXT[status] ?? (status >= 500 ? SERVER_TEXT : status >= 400 ? STATUS_TEXT[400] : GENERIC_ERROR)

/** Respostas do servidor que não dizem nada de útil ao utilizador: usa-se a mensagem do contexto */
const VAGUE = new Set(['Pedido inválido', 'Não encontrado', 'Método não permitido', 'Não autorizado', 'Erro interno', 'Pedido recusado', 'Envio inválido'])

/**
 * Erro de um pedido à API. "message" é sempre amigável; "specific" diz se é a explicação
 * concreta do servidor (ex.: "Tarefa não encontrada") ou só a mensagem genérica do estado HTTP.
 * Erros 5xx nunca passam a explicação do servidor (pode ser técnica).
 */
export class ApiError extends UserError {
  readonly specific: boolean
  constructor(public status: number, serverMessage?: unknown) {
    const text = typeof serverMessage === 'string' ? serverMessage.trim() : ''
    const specific = status >= 400 && status < 500 && !!text && !VAGUE.has(text) && text.length <= 300
    super(specific ? text : statusText(status))
    this.specific = specific
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
    throw new ApiError(0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data?.error)
  return data as T
}

/**
 * Para as actualizações periódicas (polling): se o servidor devolveu exactamente o mesmo,
 * fica o valor antigo. Um array novo com o mesmo conteúdo faria redesenhar a app inteira.
 */
export const keepIfSame = <T,>(prev: T, next: T): T => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)

/**
 * O texto a mostrar ao utilizador para um erro. Nunca mostra códigos HTTP nem mensagens técnicas.
 * "fallback" diz o que falhou no contexto (ex.: "Não foi possível carregar as tarefas.") e é
 * usado sempre que não há uma explicação concreta:
 * - erro da API com explicação do servidor ("Tarefa não encontrada") → essa explicação;
 * - sem internet, sessão expirada ou demasiados pedidos → a mensagem do estado (diz o que fazer);
 * - erro do servidor (5xx) ou sem explicação → fallback;
 * - UserError do próprio cliente ("O ficheiro tem mais de 2 MB") → a mensagem;
 * - qualquer outro erro (bug, biblioteca) → fallback.
 */
export function errorText(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) {
    if (err.specific || err.status === 0 || err.status === 401 || err.status === 429) return err.message
    return fallback ?? err.message
  }
  if (err instanceof UserError && err.message) return err.message
  if (err instanceof Error && err.name !== 'AbortError') console.error(err)
  return fallback ?? GENERIC_ERROR
}

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
