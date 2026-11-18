'use client'

import { useEffect } from 'react'

/**
 * Falha no próprio layout (o resto da app não carregou): página mínima, sem depender
 * de nenhum componente da app, só com uma mensagem amigável.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error])
  return (
    <html lang="pt">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F6FC', color: '#2B2840', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Algo correu mal</h1>
          <p style={{ color: '#6E6A85', fontWeight: 600, margin: '8px 0 24px' }}>Não foi possível abrir a aplicação. Tenta outra vez dentro de momentos.</p>
          <button type="button" onClick={reset} style={{ background: '#7B61FF', color: '#fff', border: 0, borderRadius: 16, padding: '12px 24px', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
            Tentar outra vez
          </button>
        </div>
      </body>
    </html>
  )
}
