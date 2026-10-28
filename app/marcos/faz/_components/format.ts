import type { AccountType } from '../../../types'

/** Formatação partilhada pelas páginas do painel */

export const TYPE: Record<AccountType | 'none', { label: string; cls: string }> = {
  personal: { label: 'Pessoal', cls: 'bg-brand-light text-brand-dark' },
  business: { label: 'Empresa', cls: 'bg-accent-light text-accent-dark' },
  none: { label: 'Por escolher', cls: 'bg-snow text-muted' },
}

export const date = (ts: number) => new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })

export const dateTime = (ts: number) =>
  new Date(ts).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "há 5 min", "há 3 dias"… */
export function ago(ts: number | undefined, now: number) {
  if (!ts) return 'Nunca'
  const m = Math.floor((now - ts) / 60000)
  if (m < 2) return 'Agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d < 30 ? `há ${d} dia${d === 1 ? '' : 's'}` : date(ts)
}

export const dayLabel = (day: string, long = false) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-PT', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
