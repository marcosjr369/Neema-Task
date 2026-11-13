'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * Peças das cenas animadas do tutorial ("vídeos" feitos com HTML e CSS, sem ficheiros de vídeo):
 * um palco de 400×250 que escala para o espaço disponível, um cursor que se mexe e clica,
 * texto a ser escrito e elementos que aparecem em cada passo.
 */

export const W = 400
export const H = 250

export type SceneProps = { step: number }

/**
 * Traço mais leve dentro das cenas: as bordas de 2 px passam a 1 px e as sombras ficam suaves
 * (as cenas continuam a usar as classes normais; o palco é que as aligeira).
 */
const LIGHT = '[&_.border-2]:border [&_.border-b-2]:border-b [&_.border-r-2]:border-r [&_.border-t-2]:border-t [&_.shadow-2xl]:shadow-[0_10px_28px_-14px_rgb(43_40_64/0.3)] [&_.shadow-xl]:shadow-[0_8px_22px_-14px_rgb(43_40_64/0.3)] [&_.shadow-lg]:shadow-[0_6px_18px_-12px_rgb(43_40_64/0.3)] [&_.shadow-md]:shadow-[0_3px_10px_-6px_rgb(43_40_64/0.25)] [&_.font-black]:font-extrabold'

/** Palco com tamanho fixo (400×250), escalado para a largura do contentor */
export function Stage({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className={`relative w-full overflow-hidden rounded-2xl bg-[#F4F3F9] ${className}`} style={{ aspectRatio: `${W} / ${H}` }}>
      <div className={`absolute left-0 top-0 origin-top-left select-none font-sans text-[10px] font-bold text-body ${LIGHT}`} style={{ width: W, height: H, transform: `scale(${scale})` }} aria-hidden>
        {children}
      </div>
    </div>
  )
}

/** Janela da app (cabeçalho com o nome da secção) */
export function Win({ title, children, tint = '#ffffff', head }: { title: string; children: ReactNode; tint?: string; head?: ReactNode }) {
  return (
    <div className="absolute inset-2 overflow-hidden rounded-xl border border-[#E6E4EF] shadow-[0_8px_24px_-16px_rgb(43_40_64/0.35)]" style={{ background: tint }}>
      <div className="absolute inset-x-0 top-0 z-10 flex h-[22px] items-center gap-1 border-b border-[#EFEDF5] bg-white px-2.5">
        <span className="h-[5px] w-[5px] rounded-full bg-[#E3E1EC]" />
        <span className="h-[5px] w-[5px] rounded-full bg-[#E3E1EC]" />
        <span className="h-[5px] w-[5px] rounded-full bg-[#E3E1EC]" />
        <span className="ml-2 text-[10px] font-extrabold text-ink">{title}</span>
        <span className="ml-auto flex items-center gap-1">{head}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[22px]">{children}</div>
    </div>
  )
}

/**
 * Elemento que aparece a partir do passo `at`. No passo em que aparece entra com animação;
 * nos seguintes fica parado (não volta a animar).
 */
export function At({ step, at, until, anim = 'tut-in', d = 0, className = '', style, children }: {
  step: number; at: number; until?: number; anim?: string; d?: number; className?: string; style?: CSSProperties; children?: ReactNode
}) {
  if (step < at || (until !== undefined && step > until)) return null
  return (
    <div className={`absolute ${step === at ? anim : ''} ${className}`} style={{ ...style, ['--d' as string]: `${d}s` }}>
      {children}
    </div>
  )
}

/** Texto a ser escrito, letra a letra, com cursor de escrita a piscar */
export function Typed({ text, d = 0, t, play = true }: { text: string; d?: number; t?: number; play?: boolean }) {
  if (!play) return <span>{text}</span>
  const dur = t ?? Math.min(1.6, 0.06 * text.length + 0.2)
  return (
    <span className="relative inline-flex items-center whitespace-nowrap">
      <span className="tut-type" style={{ ['--d' as string]: `${d}s`, ['--t' as string]: `${dur}s`, ['--n' as string]: text.length }}>{text}</span>
      <span className="tut-caret ml-px inline-block h-[1.1em] w-px bg-ink" />
    </span>
  )
}

/** Ponto do caminho do cursor: posição, quando lá chega (ms desde o início do passo) e se clica */
export type CursorPoint = { x: number; y: number; at: number; click?: boolean; press?: boolean }

/** Cursor da cena: segue os pontos de cada passo e mostra um "toque" ao clicar */
export function Cursor({ step, paths }: { step: number; paths: (CursorPoint[] | undefined)[] }) {
  const path = paths[step] ?? []
  const first = path[0] ?? { x: W - 40, y: H - 30, at: 0 }
  const [pos, setPos] = useState({ x: first.x, y: first.y, press: false })
  const [clicks, setClicks] = useState<{ id: number; x: number; y: number }[]>([])
  const seq = useRef(0)

  useEffect(() => {
    const timers: number[] = []
    path.forEach(p => {
      timers.push(window.setTimeout(() => setPos({ x: p.x, y: p.y, press: !!p.press }), p.at))
      if (p.click) {
        timers.push(window.setTimeout(() => {
          const id = ++seq.current
          setClicks(c => [...c.slice(-3), { id, x: p.x, y: p.y }])
          setPos(v => ({ ...v, press: true }))
          timers.push(window.setTimeout(() => setPos(v => ({ ...v, press: false })), 180))
        }, p.at + 750))
      }
    })
    return () => timers.forEach(clearTimeout)
    // o caminho muda com o passo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  return (
    <>
      {clicks.map(c => (
        <span key={c.id} className="tut-ripple pointer-events-none absolute z-40 h-6 w-6 rounded-full bg-brand/40" style={{ left: c.x, top: c.y }} />
      ))}
      <svg width="16" height="20" viewBox="0 0 16 20" className="pointer-events-none absolute z-50 drop-shadow-[0_2px_2px_rgb(0_0_0/0.25)]"
        style={{ left: pos.x - 2, top: pos.y - 1, transition: 'left .75s cubic-bezier(.4,0,.2,1), top .75s cubic-bezier(.4,0,.2,1), transform .12s', transform: pos.press ? 'scale(.85)' : 'none' }}>
        <path d="M1 1 L1 16 L5 12.5 L8 19 L10.5 18 L7.6 11.6 L13 11.6 Z" fill="#2B2840" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  )
}

/** Número que conta (para cronómetros e totais) */
export function Ticker({ from, to, ms, format }: { from: number; to: number; ms: number; format: (n: number) => string }) {
  const [n, setN] = useState(from)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      setN(Math.round(from + (to - from) * k))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, ms])
  return <>{format(n)}</>
}

/** Bolinha com iniciais (pessoa) */
export function Face({ name, color, size = 16 }: { name: string; color: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-black text-white ring-2 ring-white" style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}>
      {name.split(' ').map(p => p[0]).join('').slice(0, 2)}
    </span>
  )
}

/** Botão / etiqueta pequena */
export function Chip({ children, color = '#4A4763', bg = '#F7F6FC', className = '', style }: { children: ReactNode; color?: string; bg?: string; className?: string; style?: CSSProperties }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[8.5px] font-extrabold ${className}`} style={{ color, background: bg, ...style }}>{children}</span>
}

/** "+15 pts" a subir */
export function Float({ children, d = 0, className = '', style }: { children: ReactNode; d?: number; className?: string; style?: CSSProperties }) {
  return <span className={`tut-float absolute z-30 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black text-ink shadow ${className}`} style={{ ...style, ['--d' as string]: `${d}s` }}>{children}</span>
}
