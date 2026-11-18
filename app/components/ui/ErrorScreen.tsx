'use client'

import Link from 'next/link'
import Mascot from './Mascot'

type Props = { title: string; text: string; onRetry?: () => void }

/** Ecrã de erro amigável (página não encontrada, falha inesperada). Nunca mostra detalhes técnicos. */
export default function ErrorScreen({ title, text, onRetry }: Props) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <Mascot size={100} mood="sad" />
      <h1 className="mt-4 text-2xl font-black text-ink">{title}</h1>
      <p className="mt-1 max-w-sm font-semibold text-muted">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Tentar outra vez</button>}
        <Link href="/" className={`btn ${onRetry ? 'btn-ghost' : 'btn-primary'}`}>Voltar ao início</Link>
      </div>
    </div>
  )
}
