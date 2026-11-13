import type { ReactNode } from 'react'

/** Roda de carregamento para botões e acções; herda a cor do texto */
export default function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Conteúdo de um botão com estado de espera: com "busy" mostra o spinner (e "text", se houver).
 * Ex.: <button disabled={busy}><Busy busy={busy} text="A guardar…">Guardar</Busy></button>
 */
export function Busy({ busy, text, children }: { busy: boolean; text?: ReactNode; children: ReactNode }) {
  if (!busy) return <>{children}</>
  return (
    <>
      <Spinner />
      <span aria-live="polite">{text ?? children}</span>
    </>
  )
}
