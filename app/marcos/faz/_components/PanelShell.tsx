'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowClockwiseIcon, BuildingsIcon, CaretRightIcon, CheckCircleIcon, EnvelopeSimpleIcon, LockKeyIcon, ShieldCheckIcon,
  SignOutIcon, SquaresFourIcon, TrashIcon, TrophyIcon, UsersThreeIcon, XIcon, type Icon,
} from '@phosphor-icons/react'
import Mascot from '../../../components/ui/Mascot'
import { api, ApiError, errorText } from '../../../lib/api'
import type { PanelOverview, PanelUser } from '../../../lib/server/panelStats'
import ConfirmUserModal, { type ActionResult, type UserAction } from './ConfirmUserModal'

/*
 * Estrutura do painel (/marcos/faz): entrada com email e palavra-passe, menu lateral por secções,
 * barra de topo com o período, avisos em toast, e os dados partilhados por todas as páginas.
 */

export const RANGES = [7, 30, 90] as const
export type Range = (typeof RANGES)[number]

type Target = Pick<PanelUser, 'id' | 'name' | 'email' | 'disabled' | 'orgs'>

type PanelValue = {
  data: PanelOverview | null
  days: Range
  loading: boolean
  reload: () => Promise<void>
  /** abre a confirmação com palavra-passe para desactivar / reactivar / eliminar */
  ask: (user: Target, action: UserAction) => void
  /** sobe a cada actualização (as fichas de detalhe voltam a carregar) */
  version: number
}

const PanelContext = createContext<PanelValue | null>(null)

export function usePanel() {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error('usePanel tem de ser usado dentro do painel')
  return ctx
}

/** Dados de uma ficha (utilizador/empresa) com o período do painel; recarrega com "Actualizar" */
export function usePanelFetch<T>(path: string) {
  const { days, version } = usePanel()
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key: '', data: null, error: '' })
  const key = `${path}|${days}|${version}`
  useEffect(() => {
    let alive = true
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    api<T>(`${path}?dias=${days}&tz=${encodeURIComponent(tz)}`)
      .then(data => { if (alive) setState({ key, data, error: '' }) })
      .catch(err => { if (alive) setState(s => ({ key, data: s.data, error: errorText(err) })) })
    return () => { alive = false }
  }, [path, days, key])
  // enquanto a nova resposta não chega, mantém a anterior (sem saltos)
  return { data: state.data, error: state.error, loading: state.key !== key }
}

const BASE = '/marcos/faz'

type NavItem = {
  href: string
  label: string
  desc: string
  icon: Icon
  count?: (d: PanelOverview) => number
  /** a página usa o período (7/30/90 dias) */
  range: boolean
}
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Análise',
    items: [
      { href: BASE, label: 'Visão geral', desc: 'Crescimento, actividade e foco na plataforma', icon: SquaresFourIcon, range: true },
      { href: `${BASE}/ranking`, label: 'Ranking', desc: 'Empresas, contas pessoais e funcionários', icon: TrophyIcon, range: false },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: `${BASE}/utilizadores`, label: 'Utilizadores', desc: 'Todas as contas: pesquisar, ver a ficha, desactivar ou eliminar', icon: UsersThreeIcon, count: d => d.totals.users, range: true },
      { href: `${BASE}/empresas`, label: 'Empresas', desc: 'Equipas registadas, administradores e actividade', icon: BuildingsIcon, count: d => d.totals.orgs, range: true },
      { href: `${BASE}/eliminados`, label: 'Eliminados', desc: 'Registo das contas eliminadas e porquê', icon: TrashIcon, count: d => d.totals.deleted, range: false },
    ],
  },
]
const NAV = NAV_GROUPS.flatMap(g => g.items)

const isActive = (pathname: string, href: string) => (href === BASE ? pathname === BASE : pathname.startsWith(href))

function Login({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/painel/sessao', { body: { email, password } })
      setPassword('')
      onDone(email.trim().toLowerCase())
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }
  const field = `input pl-10 ${error ? 'border-danger! bg-danger-light!' : ''}`
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-5">
      <span className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand/10 blur-3xl" aria-hidden />
      <span className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <form onSubmit={submit} className="card relative w-full max-w-sm overflow-hidden">
        <div className="flex flex-col items-center bg-brand px-6 pb-5 pt-6 text-center text-white">
          <span className="rounded-full bg-white/15 p-2"><Mascot size={72} mood={error ? 'sad' : 'happy'} /></span>
          <h1 className="mt-3 text-2xl font-black">Painel</h1>
          <p className="text-sm font-semibold text-white/80">udacha · área reservada</p>
        </div>
        <div className="p-6">
          <label className="relative block">
            <EnvelopeSimpleIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              className={field}
              value={email}
              onChange={e => { setEmail(e.target.value); if (error) setError('') }}
              autoFocus
              autoComplete="username"
              placeholder="Email"
              aria-label="Email"
              aria-invalid={!!error}
            />
          </label>
          <label className="relative mt-3 block">
            <LockKeyIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              className={field}
              value={password}
              onChange={e => { setPassword(e.target.value); if (error) setError('') }}
              autoComplete="current-password"
              placeholder="Palavra-passe"
              aria-label="Palavra-passe"
              aria-invalid={!!error}
            />
          </label>
          {error && <p className="mt-2 text-sm font-bold text-danger">{error}</p>}
          <button type="submit" disabled={busy || !password || !email} className={`btn mt-5 w-full ${busy || !password || !email ? 'btn-disabled' : 'btn-primary'}`}>
            {busy ? 'A verificar…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Aviso no canto (resultado das acções); fecha sozinho */
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 7000)
    return () => clearTimeout(id)
  }, [text, onClose])
  return (
    <div role="status" className="fixed bottom-5 right-5 z-[70] flex max-w-md items-start gap-3 rounded-2xl border-2 border-line bg-white p-4 shadow-xl animate-toast-in">
      <CheckCircleIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-accent" />
      <p className="flex-1 text-sm font-bold text-body">{text}</p>
      <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-0.5 text-muted hover:bg-snow cursor-pointer"><XIcon size={16} /></button>
    </div>
  )
}

function SideNav({ pathname, data, email, onLogout }: { pathname: string; data: PanelOverview | null; email: string; onLogout: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 border-line bg-white lg:flex">
      <Link href={BASE} className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="rounded-2xl bg-brand-light p-1"><Mascot size={40} /></span>
        <span>
          <span className="block text-lg font-black leading-tight text-brand">udacha</span>
          <span className="block text-[11px] font-extrabold uppercase tracking-wider text-muted">Painel</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-2" aria-label="Painel">
        {NAV_GROUPS.map(g => (
          <div key={g.title}>
            <p className="px-3 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted">{g.title}</p>
            <ul className="space-y-1">
              {g.items.map(n => {
                const on = isActive(pathname, n.href)
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={on ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2 font-extrabold transition-colors ${on ? 'bg-brand-light text-brand-dark' : 'text-body hover:bg-snow'}`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${on ? 'bg-brand text-white' : 'bg-snow text-muted group-hover:text-body'}`}>
                        <n.icon size={20} weight={on ? 'fill' : 'bold'} />
                      </span>
                      <span className="flex-1">{n.label}</span>
                      {data && n.count && (
                        <span className={`min-w-7 rounded-lg px-1.5 py-0.5 text-center text-xs font-black tabular-nums ${on ? 'bg-white text-brand-dark' : 'bg-snow text-muted'}`}>
                          {n.count(data)}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      {/* quem está com a sessão aberta */}
      <div className="m-3 flex items-center gap-3 rounded-2xl border-2 border-line p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white"><ShieldCheckIcon size={20} weight="fill" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-ink">Administrador</span>
          <span className="block truncate text-xs font-semibold text-muted" title={email}>{email || '—'}</span>
        </span>
        <button onClick={onLogout} aria-label="Sair do painel" title="Sair do painel" className="rounded-xl p-2 text-muted hover:bg-danger-light hover:text-danger cursor-pointer">
          <SignOutIcon size={20} />
        </button>
      </div>
    </aside>
  )
}

export default function PanelShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [version, setVersion] = useState(0)
  const [session, setSession] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [days, setDays] = useState<Range>(30)
  const [data, setData] = useState<PanelOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<{ user: Target; action: UserAction } | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setData(await api<PanelOverview>(`/api/painel/resumo?dias=${days}&tz=${encodeURIComponent(tz)}`))
      setVersion(v => v + 1)
      setError('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSession(false)
      else setError(errorText(err))
    }
    setLoading(false)
  }, [days])

  useEffect(() => {
    api<{ ok: boolean; email?: string }>('/api/painel/sessao')
      .then(r => { setSession(r.ok); setEmail(r.email ?? '') })
      .catch(() => setSession(false))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    if (session) reload()
  }, [session, reload])

  const closeNotice = useCallback(() => setNotice(''), [])

  const done = async (r: ActionResult) => {
    if (!pending) return
    const { user: u, action } = pending
    setPending(null)
    if (action === 'delete') {
      const extra = [
        r.deletedOrgs?.length ? `empresa apagada: ${r.deletedOrgs.join(', ')}` : '',
        r.promoted?.length ? `novo administrador: ${r.promoted.join(', ')}` : '',
        r.clerk === 'falhou' ? 'o Clerk não respondeu (apaga a conta lá à mão)' : '',
      ].filter(Boolean)
      setNotice(`${u.name} foi eliminado.${extra.length ? ` ${extra.join(' · ')}.` : ''}`)
      // estava na ficha dessa pessoa: volta à lista
      if (pathname.includes(u.id)) router.push(`${BASE}/utilizadores`)
    } else {
      setNotice(
        r.clerk === 'falhou'
          ? 'Guardado, mas o Clerk não respondeu: o login pode continuar activo.'
          : `${u.name}: conta ${action === 'enable' ? 'reactivada' : 'desactivada'}.`,
      )
    }
    await reload()
  }

  const logout = async () => {
    await api('/api/painel/sessao', { method: 'DELETE' }).catch(() => undefined)
    setSession(false)
    setData(null)
  }

  if (session === null) return <div className="flex min-h-dvh items-center justify-center"><Mascot size={80} className="animate-bounce-soft" /></div>
  if (!session) return <Login onDone={e => { setEmail(e); setSession(true) }} />

  const page = NAV.find(n => isActive(pathname, n.href)) ?? NAV[0]
  const isDetail = pathname !== page.href

  return (
    <PanelContext.Provider value={{ data, days, loading, reload, version, ask: (user, action) => setPending({ user, action }) }}>
      <SideNav pathname={pathname} data={data} email={email} onLogout={logout} />

      <div className="min-h-dvh lg:pl-64">
        {/* topo: onde estou, período e actualizar; no mobile também o menu */}
        <header className="sticky top-0 z-20 border-b-2 border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
            <span className="lg:hidden"><Mascot size={36} /></span>
            <div className="mr-auto min-w-0">
              {isDetail ? (
                <p className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-muted">
                  <Link href={page.href} className="hover:text-brand">{page.label}</Link> <CaretRightIcon size={12} /> Ficha
                </p>
              ) : null}
              <h1 className="truncate text-2xl font-black text-ink">{isDetail ? (page.label === 'Empresas' ? 'Ficha da empresa' : 'Ficha do utilizador') : page.label}</h1>
              {!isDetail && <p className="hidden truncate text-sm font-semibold text-muted sm:block">{page.desc}</p>}
            </div>
            {page.range && (
              <div className="flex gap-1 rounded-2xl bg-snow p-1" role="radiogroup" aria-label="Período">
                {RANGES.map(r => (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={days === r}
                    onClick={() => setDays(r)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-extrabold transition-colors cursor-pointer ${days === r ? 'bg-white text-brand-dark shadow-[0_2px_0_#E9E7F2]' : 'text-muted hover:text-body'}`}
                  >
                    {r} dias
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={reload}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl border-2 border-line px-3 py-1.5 text-sm font-extrabold text-body hover:bg-snow cursor-pointer"
              title={data ? `Actualizado às ${new Date(data.generatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : undefined}
            >
              <ArrowClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">
                {data ? new Date(data.generatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : 'Actualizar'}
              </span>
            </button>
            <button onClick={logout} className="rounded-2xl border-2 border-line p-2 text-muted lg:hidden cursor-pointer" aria-label="Sair do painel"><SignOutIcon size={16} /></button>
          </div>
          <nav className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden" aria-label="Painel">
            {NAV.map(n => {
              const on = isActive(pathname, n.href)
              return (
                <Link key={n.href} href={n.href} className={`chip shrink-0 ${on ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}>
                  <n.icon size={16} weight={on ? 'fill' : 'bold'} /> {n.label}
                  {data && n.count && <span className="text-xs text-muted">{n.count(data)}</span>}
                </Link>
              )
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
          {error && <p className="card mb-4 border-danger/40 bg-danger-light p-4 font-bold text-danger">{error}</p>}
          {data ? (
            <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>{children}</div>
          ) : (
            !error && <div className="flex justify-center py-20"><Mascot size={80} className="animate-bounce-soft" /></div>
          )}
        </main>
      </div>

      {notice && <Toast text={notice} onClose={closeNotice} />}
      {pending && (
        <ConfirmUserModal key={`${pending.user.id}-${pending.action}`} user={pending.user} action={pending.action} onClose={() => setPending(null)} onDone={done} />
      )}
    </PanelContext.Provider>
  )
}
