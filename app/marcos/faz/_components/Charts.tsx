'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * Gráficos do painel em SVG simples (sem bibliotecas):
 * colunas (com séries empilhadas) e linha com área. Barras finas (≤ 24px) com topo arredondado,
 * 2px de intervalo entre segmentos, grelha discreta, tooltip ao passar e vista em tabela.
 */

export type Series = { key: string; name: string; color: string }
export type Point = { label: string; title: string; values: Record<string, number> }

const H = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 40 }
const GRID = '#E9E7F2'
const AXIS_TEXT = '#A3A0B8'

/** Largura do contentor (o SVG desenha-se nessa largura, sem esticar texto) */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  // começa pequeno: um SVG largo antes de medir esticaria o cartão (e a página no telemóvel)
  const [width, setWidth] = useState(280)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/** Máximo "redondo" para o eixo (1, 2, 5 × 10^n) */
function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

export const compact = (v: number) =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${+v.toFixed(1)}`

/** Rótulos do eixo X sem se atropelarem: no máximo ~7 e pelo menos ~52px entre eles */
const labelEvery = (n: number, width: number) => Math.max(1, Math.ceil(n / 7), Math.ceil(n / Math.max(1, (width - PAD.left - PAD.right) / 52)))

type TipState = { x: number; i: number } | null

function Tooltip({ tip, points, series, format, width }: { tip: TipState; points: Point[]; series: Series[]; format: (v: number) => string; width: number }) {
  const p = tip ? points[tip.i] : undefined
  if (!tip || !p) return null
  const left = Math.min(Math.max(tip.x - 80, 0), width - 160)
  return (
    <div className="pointer-events-none absolute top-0 z-10 w-40 rounded-xl border-2 border-line bg-white px-3 py-2 shadow-lg" style={{ left }}>
      <p className="text-xs font-bold text-muted">{p.title}</p>
      {series.map(s => (
        <p key={s.key} className="mt-1 flex items-center gap-2">
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="font-black text-ink tabular-nums">{format(p.values[s.key] ?? 0)}</span>
          <span className="truncate text-xs font-semibold text-muted">{s.name}</span>
        </p>
      ))}
    </div>
  )
}

function Axis({ width, max, format }: { width: number; max: number; format: (v: number) => string }) {
  const plotH = H - PAD.top - PAD.bottom
  return (
    <g>
      {[0, 0.5, 1].map(f => {
        const y = PAD.top + plotH * (1 - f)
        return (
          <g key={f}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fontWeight={700} fill={AXIS_TEXT}>
              {format(max * f)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function XLabels({ points, x, width }: { points: Point[]; x: (i: number) => number; width: number }) {
  const every = labelEvery(points.length, width)
  // perto das bordas o rótulo encosta para dentro, para não ser cortado
  const anchor = (px: number) => (px > width - 28 ? 'end' : px < PAD.left + 16 ? 'start' : 'middle')
  return (
    <g>
      {points.map((p, i) =>
        (points.length - 1 - i) % every === 0 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor={anchor(x(i))} fontSize={11} fontWeight={700} fill={AXIS_TEXT}>
            {p.label}
          </text>
        ) : null,
      )}
    </g>
  )
}

/** Retângulo com só os cantos de cima arredondados (base quadrada, presa ao eixo) */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2)
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`
}

/** Colunas, empilhadas quando há mais de uma série */
export function ColumnChart({ points, series, format = compact, axisFormat = compact }: { points: Point[]; series: Series[]; format?: (v: number) => string; axisFormat?: (v: number) => string }) {
  const { ref, width } = useWidth()
  const [rawTip, setTip] = useState<TipState>(null)
  // ao mudar o período, uma dica antiga pode apontar para um dia que já não existe
  const tip = rawTip && rawTip.i < points.length ? rawTip : null
  const plotW = width - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const band = plotW / Math.max(1, points.length)
  const barW = Math.max(2, Math.min(24, band * 0.6))
  const totals = points.map(p => series.reduce((a, s) => a + (p.values[s.key] ?? 0), 0))
  const max = niceMax(Math.max(0, ...totals))
  const cx = (i: number) => PAD.left + band * i + band / 2

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <svg width={width} height={H} role="img" aria-label="Gráfico de colunas" className="block">
        <Axis width={width} max={max} format={axisFormat} />
        {points.map((p, i) => {
          let base = PAD.top + plotH
          const segs = series.map(s => ({ s, v: p.values[s.key] ?? 0 })).filter(x => x.v > 0)
          return (
            <g key={i} opacity={tip && tip.i !== i ? 0.55 : 1}>
              {segs.map(({ s, v }, k) => {
                const h = (v / max) * plotH
                // 2px de intervalo entre segmentos empilhados
                const gap = k > 0 ? 2 : 0
                const y = base - h
                const d = k === segs.length - 1 ? topRounded(cx(i) - barW / 2, y, barW, Math.max(0, h - gap), 4) : undefined
                const el = d ? (
                  <path key={s.key} d={d} fill={s.color} />
                ) : (
                  <rect key={s.key} x={cx(i) - barW / 2} y={y} width={barW} height={Math.max(0, h - gap)} fill={s.color} />
                )
                base = y
                return el
              })}
              {/* zona de toque maior que a barra */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.title}: ${series.map(s => `${s.name} ${format(p.values[s.key] ?? 0)}`).join(', ')}`}
                onPointerEnter={() => setTip({ x: cx(i), i })}
                onPointerLeave={() => setTip(null)}
                onFocus={() => setTip({ x: cx(i), i })}
                onBlur={() => setTip(null)}
              />
            </g>
          )
        })}
        <XLabels points={points} x={cx} width={width} />
      </svg>
      <Tooltip tip={tip} points={points} series={series} format={format} width={width} />
    </div>
  )
}

/** Linha com área suave (uma série); a mira acompanha o ponteiro e prende-se ao dia mais próximo */
export function LineChart({ points, series, format = compact, axisFormat = compact }: { points: Point[]; series: Series; format?: (v: number) => string; axisFormat?: (v: number) => string }) {
  const { ref, width } = useWidth()
  const [rawTip, setTip] = useState<TipState>(null)
  // ao mudar o período, uma dica antiga pode apontar para um dia que já não existe
  const tip = rawTip && rawTip.i < points.length ? rawTip : null
  const plotW = width - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const vals = points.map(p => p.values[series.key] ?? 0)
  const max = niceMax(Math.max(0, ...vals))
  const x = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (plotW * i) / (points.length - 1))
  const y = (v: number) => PAD.top + plotH * (1 - v / max)
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')
  const area = `${line} L${x(vals.length - 1)} ${PAD.top + plotH} L${x(0)} ${PAD.top + plotH} Z`
  const last = vals.length - 1

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    const i = Math.round(rel * (points.length - 1))
    setTip({ x: x(i), i: Math.max(0, Math.min(points.length - 1, i)) })
  }

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <svg width={width} height={H} role="img" aria-label={`Gráfico de linha: ${series.name}`} className="block">
        <Axis width={width} max={max} format={axisFormat} />
        <path d={area} fill={series.color} opacity={0.1} />
        <path d={line} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {tip && <line x1={tip.x} x2={tip.x} y1={PAD.top} y2={PAD.top + plotH} stroke={AXIS_TEXT} strokeWidth={1} />}
        {/* ponto do dia em foco (ou o último), com anel da cor do fundo */}
        {vals.length > 0 && (
          <circle cx={x(tip ? tip.i : last)} cy={y(vals[tip ? tip.i : last])} r={4.5} fill={series.color} stroke="#fff" strokeWidth={2} />
        )}
        {!tip && vals.length > 0 && (
          <text x={x(last) - 10} y={Math.max(y(vals[last]) - 10, PAD.top + 12)} textAnchor="end" fontSize={12} fontWeight={900} fill="#2B2840">
            {format(vals[last])}
          </text>
        )}
        <XLabels points={points} x={x} width={width} />
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setTip(null)}
        />
      </svg>
      <Tooltip tip={tip} points={points} series={[series]} format={format} width={width} />
    </div>
  )
}

/** Cartão de gráfico: título, legenda (2+ séries) e alternância para tabela */
export function ChartCard({
  title, subtitle, series, points, format = compact, children,
}: { title: string; subtitle?: string; series: Series[]; points: Point[]; format?: (v: number) => string; children: ReactNode }) {
  const [table, setTable] = useState(false)
  return (
    <section className="card min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-ink">{title}</h3>
          {subtitle && <p className="text-xs font-semibold text-muted">{subtitle}</p>}
        </div>
        <button onClick={() => setTable(t => !t)} className="chip text-xs" aria-pressed={table}>
          {table ? 'Gráfico' : 'Tabela'}
        </button>
      </div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4">
          {series.map(s => (
            <span key={s.key} className="flex items-center gap-2 text-xs font-bold text-body">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
      {table ? (
        <div className="max-h-[200px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs font-extrabold uppercase text-muted">
              <tr>
                <th className="py-1.5">Dia</th>
                {series.map(s => <th key={s.key} className="py-1.5 text-right">{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-semibold text-body">
              {[...points].reverse().map(p => (
                <tr key={p.title}>
                  <td className="py-1.5">{p.title}</td>
                  {series.map(s => <td key={s.key} className="py-1.5 text-right tabular-nums">{format(p.values[s.key] ?? 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
