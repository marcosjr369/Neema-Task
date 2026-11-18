'use client'

import { useEffect } from 'react'
import ErrorScreen from './components/ui/ErrorScreen'

/** Falha inesperada numa página: mostra uma mensagem amigável em vez do erro técnico. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error])
  return <ErrorScreen title="Algo correu mal" text="Não foi possível mostrar esta página. Tenta outra vez dentro de momentos." onRetry={reset} />
}
