'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { EyeIcon, LockIcon } from '@phosphor-icons/react'
import BoardCanvas from '../../components/boards/BoardCanvas'
import CardDialog from '../../components/boards/CardDialog'
import PublicSheet from '../../components/sheets/PublicSheet'
import PublicDiagram from '../../components/diagrams/PublicDiagram'
import Mascot from '../../components/ui/Mascot'
import { api, ApiError, errorText } from '../../lib/api'
import { boardBackground } from '../../lib/boards'
import { loginUrl } from '../../lib/account'
import type { BoardPerson, BoardView, DiagramView, ShareKind, SheetView } from '../../types'
import { Busy } from '../../components/ui/Spinner'

type Res =
  | { status: 'member'; kind: ShareKind; path: string }
  | { status: 'ok'; kind: 'board'; board: BoardView; people: BoardPerson[]; signedIn: boolean }
  | { status: 'ok'; kind: 'sheet'; sheet: SheetView; signedIn: boolean }
  | { status: 'ok'; kind: 'diagram'; diagram: DiagramView; signedIn: boolean }
  | { status: 'password' | 'private'; kind: ShareKind; signedIn: boolean; requested: boolean }

const WORDS: Record<ShareKind, { the: string; this: string; private: string; place: string; open: string }> = {
  board: { the: 'o quadro', this: 'este quadro', private: 'Quadro privado', place: 'nos teus Quadros', open: 'Abrir quadro' },
  sheet: { the: 'a planilha', this: 'esta planilha', private: 'Planilha privada', place: 'nas tuas Planilhas', open: 'Abrir planilha' },
  diagram: { the: 'o diagrama', this: 'este diagrama', private: 'Diagrama privado', place: 'nos teus Diagramas', open: 'Abrir diagrama' },
}

const noop = () => undefined

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-snow px-6 py-12 text-center">{children}</div>
}

/** Link de partilha: abre o quadro, a planilha ou o diagrama só para leitura, pede a senha, ou deixa pedir acesso */
export default function SharedPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [res, setRes] = useState<Res | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cardId, setCardId] = useState<string | null>(null)

  const load = useCallback(async (k: string | null) => {
    try {
      const r = await api<Res>(`/api/partilha/${token}`, { headers: k ? { 'x-share-key': k } : undefined })
      if (r.status === 'member') {
        router.replace(r.path)
        return
      }
      setRes(r)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'Este link não existe ou foi desactivado pelo dono.' : errorText(err))
    }
  }, [token, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load(null)
  }, [load])

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setPwError('')
    try {
      const { key: k } = await api<{ key: string }>(`/api/partilha/${token}`, { body: { password } })
      // a chave da senha fica só em memória (a app não guarda nada no browser)
      await load(k)
    } catch (err) {
      setPwError(errorText(err))
    }
    setBusy(false)
  }

  const request = async () => {
    setBusy(true)
    try {
      const r = await api<{ status: string; path?: string }>(`/api/partilha/${token}`, { body: { request: true } })
      if (r.status === 'member' && r.path) router.replace(r.path)
      else setRes(prev => (prev && prev.status !== 'ok' && prev.status !== 'member' ? { ...prev, requested: true } : prev))
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  if (error) {
    return (
      <Center>
        <Mascot size={100} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">Não foi possível abrir</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">{error}</p>
        <Link href="/" className="btn btn-primary mt-6">Ir para a Udacha</Link>
      </Center>
    )
  }
  if (!res || res.status === 'member') return <Center><Mascot size={96} className="animate-bounce-soft" /></Center>

  if (res.status !== 'ok') {
    const askPassword = res.status === 'password'
    const w = WORDS[res.kind]
    return (
      <Center>
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-brand"><LockIcon size={32} /></span>
        <h1 className="mt-4 text-2xl font-black text-ink">{w.private}</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">
          {askPassword ? `Escreve a senha que te deram para veres ${w.the}.` : `Só pode ver ${w.this} quem o dono convidou.`}
        </p>
        {askPassword && (
          <form onSubmit={unlock} className="mt-5 flex w-full max-w-sm flex-col gap-2">
            <input className="input" type="password" autoFocus autoComplete="off" placeholder="Senha" aria-label="Senha" value={password} onChange={e => setPassword(e.target.value)} />
            {pwError && <p className="text-sm font-bold text-danger">{pwError}</p>}
            <button className="btn btn-primary" disabled={busy || !password}><Busy busy={busy} text="A verificar…">{w.open}</Busy></button>
          </form>
        )}
        <div className="mt-6 w-full max-w-sm border-t-2 border-line pt-5">
          {res.requested ? (
            <p className="font-bold text-accent-dark">Pedido enviado. Quando o dono aceitar, {w.the} aparece {w.place}.</p>
          ) : res.signedIn ? (
            <>
              <p className="mb-3 text-sm font-semibold text-muted">{askPassword ? 'Não sabes a senha?' : 'Precisas de acesso?'} Pede ao dono.</p>
              <button onClick={request} disabled={busy} className="btn btn-ghost w-full"><Busy busy={busy} text="A enviar…">Pedir acesso</Busy></button>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-muted">Foste convidado ou queres pedir acesso? Entra na tua conta e voltas logo a este link.</p>
              <Link href={loginUrl(`/p/${token}`)} className="btn btn-ghost w-full">Entrar</Link>
            </>
          )}
        </div>
      </Center>
    )
  }

  if (res.kind === 'diagram') return <PublicDiagram diagram={res.diagram} signedIn={res.signedIn} />
  if (res.kind === 'sheet') return <PublicSheet sheet={res.sheet} signedIn={res.signedIn} />

  const { board, people } = res
  const card = cardId ? board.cards.find(c => c.id === cardId) : undefined
  return (
    <div className="flex h-dvh flex-col" style={{ background: boardBackground(board.color, board.background) }}>
      <header className="flex flex-wrap items-center gap-2 px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-1.5 rounded-xl bg-white/90 px-2 py-1" aria-label="Udacha">
          <Mascot size={26} />
          <span className="text-sm font-black text-brand">udacha</span>
        </Link>
        <h1 className="min-w-0 truncate px-2 text-xl font-black text-white">{board.title}</h1>
        <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-extrabold text-white"><EyeIcon size={14} /> Só ver</span>
        {!res.signedIn && (
          <Link href="/entrar" className="ml-auto rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-ink hover:bg-snow">Criar os teus quadros</Link>
        )}
      </header>
      {board.description && <p className="-mt-1 px-6 pb-2 text-sm font-semibold text-white/90">{board.description}</p>}
      <div className="min-h-0 flex-1">
        <BoardCanvas board={board} people={people} run={noop} readOnly onOpenCard={setCardId} />
      </div>
      {card && <CardDialog key={card.id} board={board} card={card} people={people} run={noop} readOnly onClose={() => setCardId(null)} />}
    </div>
  )
}
