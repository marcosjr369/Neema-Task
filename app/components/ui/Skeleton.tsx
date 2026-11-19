import type { CSSProperties } from 'react'

/**
 * Esqueletos de carregamento: a forma do conteúdo que aí vem, em vez de uma página vazia ou de
 * um "A carregar…". Os blocos são decorativos (aria-hidden); cada esqueleto completo anuncia
 * "A carregar" a leitores de ecrã.
 */

export function Sk({ className = '', style, light }: { className?: string; style?: CSSProperties; light?: boolean }) {
  return <span aria-hidden className={`block rounded-lg ${light ? 'skeleton-light' : 'skeleton'} ${className}`} style={style} />
}

function Loading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy aria-label="A carregar" className={className}>
      {children}
    </div>
  )
}

/** Título e subtítulo de página */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <Sk className="h-7 w-44" />
        <Sk className="h-4 w-72 max-w-full" />
      </div>
      {action && <Sk className="h-11 w-36 rounded-2xl" />}
    </div>
  )
}

/** Linhas com ícone/avatar, título e detalhe (listas de tarefas, pessoas, planilhas…) */
export function ListSkeleton({ rows = 5, avatar = true, className = '' }: { rows?: number; avatar?: boolean; className?: string }) {
  return (
    <Loading className={`divide-y-2 divide-line rounded-2xl border-2 border-line ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {avatar && <Sk className="h-10 w-10 shrink-0 rounded-xl" />}
          <div className="flex-1 space-y-2">
            <Sk className="h-4" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <Sk className="h-3 w-1/3" />
          </div>
          <Sk className="h-6 w-14 rounded-lg" />
        </div>
      ))}
    </Loading>
  )
}

/** Grelha de cartões (quadros, empresas…) */
export function CardGridSkeleton({ count = 6, height = 112, className = '' }: { count?: number; height?: number; className?: string }) {
  return (
    <Loading className={`grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] ${className}`}>
      {Array.from({ length: count }, (_, i) => <Sk key={i} className="rounded-2xl" style={{ height }} />)}
    </Loading>
  )
}

/** Fila de indicadores + um gráfico (estatísticas, relatórios) */
export function StatsSkeleton({ tiles = 4, chart = true }: { tiles?: number; chart?: boolean }) {
  return (
    <Loading className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <Sk className="h-3 w-20" />
            <Sk className="h-7 w-24" />
          </div>
        ))}
      </div>
      {chart && (
        <div className="card p-4">
          <Sk className="mb-4 h-4 w-40" />
          <div className="flex h-40 items-end gap-2">
            {[45, 70, 30, 85, 60, 95, 50, 75, 40, 65, 80, 55].map((h, i) => <Sk key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />)}
          </div>
        </div>
      )}
    </Loading>
  )
}

/** Página genérica: cabeçalho, indicadores e lista */
export function PageSkeleton({ stats = false, rows = 5 }: { stats?: boolean; rows?: number }) {
  return (
    <div className="px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <HeaderSkeleton action />
      {stats && <div className="mb-6"><StatsSkeleton chart={false} /></div>}
      <ListSkeleton rows={rows} />
    </div>
  )
}

/** Colunas de um quadro, sobre o fundo do quadro */
export function BoardSkeleton() {
  const cards = [3, 2, 4, 1]
  return (
    <Loading className="flex h-full items-start gap-3 overflow-hidden px-4 pt-1 lg:px-6">
      {cards.map((n, i) => (
        <div key={i} className="w-[272px] shrink-0 space-y-2 rounded-2xl bg-white/20 p-2">
          <Sk light className="m-1 h-5 w-28" />
          {Array.from({ length: n }, (_, j) => <Sk key={j} light className="rounded-xl" style={{ height: 52 + ((i + j) % 3) * 16 }} />)}
        </div>
      ))}
    </Loading>
  )
}

/** Grelha de uma planilha */
export function SheetSkeleton() {
  return (
    <Loading className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b-2 border-line px-4 py-3">
        <Sk className="h-7 w-48" />
        <Sk className="h-6 w-24" />
        <Sk className="ml-auto h-9 w-28 rounded-xl" />
      </div>
      <div className="flex gap-1 border-b-2 border-line px-4 py-2">
        {Array.from({ length: 9 }, (_, i) => <Sk key={i} className="h-7 w-8" />)}
      </div>
      <div className="flex-1 overflow-hidden p-2">
        {Array.from({ length: 14 }, (_, r) => (
          <div key={r} className="flex gap-1 py-[3px]">
            <Sk className="h-5 w-10" />
            {Array.from({ length: 8 }, (_, c) => <Sk key={c} className="h-5 flex-1" style={{ opacity: (r * 7 + c * 3) % 5 === 0 ? 0.35 : 1 }} />)}
          </div>
        ))}
      </div>
    </Loading>
  )
}

/** Painel de detalhe (tarefa, membro): cabeçalho grande e blocos */
export function DetailSkeleton() {
  return (
    <Loading className="space-y-4 px-4 pb-6 pt-5 lg:px-0 lg:pt-6">
      <div className="flex items-center gap-3">
        <Sk className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Sk className="h-6 w-2/3" />
          <Sk className="h-4 w-1/3" />
        </div>
      </div>
      <Sk className="h-32 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Sk className="h-20 rounded-2xl" />
        <Sk className="h-20 rounded-2xl" />
      </div>
      <Sk className="h-48 rounded-2xl" />
    </Loading>
  )
}
