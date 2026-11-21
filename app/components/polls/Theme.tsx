'use client'

import { Fragment, useRef, type CSSProperties, type ReactNode } from 'react'
import { LinkIcon, TextBIcon, TextItalicIcon, TextUnderlineIcon } from '@phosphor-icons/react'
import { THEME_BACKGROUNDS, THEME_FONTS, defaultTheme } from '../../lib/polls'
import type { PollTheme, PollView } from '../../types'
import { imageUrl } from './look'
import './polls.css'

/*
 * Texto formatado nas descrições, explicações e blocos de texto (sem HTML: nada corre no browser).
 * **negrito**  *itálico*  __sublinhado__  e endereços http(s) viram links.
 */
const TOKEN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g

function inline(text: string, key: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    const k = `${key}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={k} className="font-black">{inline(part.slice(2, -2), k)}</strong>
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) return <u key={k}>{inline(part.slice(2, -2), k)}</u>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={k}>{inline(part.slice(1, -1), k)}</em>
    if (/^https?:\/\//.test(part)) return <a key={k} href={part} target="_blank" rel="noopener noreferrer nofollow">{part.replace(/^https?:\/\/(www\.)?/, '')}</a>
    return <Fragment key={k}>{part}</Fragment>
  })
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <span className={`pf-rich ${className}`}>
      {lines.map((l, i) => <Fragment key={i}>{inline(l, String(i))}{i < lines.length - 1 && <br />}</Fragment>)}
    </span>
  )
}

/** Botões de formatação por cima de um campo de texto: envolvem o que estiver seleccionado */
function FormatBar({ target, value, onChange }: {
  target: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  value: string
  onChange: (v: string) => void
}) {
  const wrap = (mark: string, placeholder: string) => {
    const el = target.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const picked = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + mark + picked + mark + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + mark.length, start + mark.length + picked.length)
    })
  }
  const link = () => {
    const url = prompt('Endereço do link (https://…)', 'https://')
    if (!url || !/^https?:\/\/\S+$/.test(url.trim())) return
    const el = target.current
    const at = el?.selectionEnd ?? value.length
    onChange(`${value.slice(0, at)}${at && !/\s$/.test(value.slice(0, at)) ? ' ' : ''}${url.trim()} ${value.slice(at)}`)
  }
  const btn = 'rounded-lg p-1.5 text-muted hover:bg-snow hover:text-ink cursor-pointer'
  return (
    <span className="flex items-center gap-0.5" role="toolbar" aria-label="Formatação">
      <button type="button" className={btn} title="Negrito (**texto**)" aria-label="Negrito" onMouseDown={e => e.preventDefault()} onClick={() => wrap('**', 'negrito')}><TextBIcon size={16} weight="bold" /></button>
      <button type="button" className={btn} title="Itálico (*texto*)" aria-label="Itálico" onMouseDown={e => e.preventDefault()} onClick={() => wrap('*', 'itálico')}><TextItalicIcon size={16} weight="bold" /></button>
      <button type="button" className={btn} title="Sublinhado (__texto__)" aria-label="Sublinhado" onMouseDown={e => e.preventDefault()} onClick={() => wrap('__', 'sublinhado')}><TextUnderlineIcon size={16} weight="bold" /></button>
      <button type="button" className={btn} title="Link" aria-label="Juntar link" onMouseDown={e => e.preventDefault()} onClick={link}><LinkIcon size={16} weight="bold" /></button>
    </span>
  )
}

/** Caixa de texto com a barra de formatação por cima */
export function RichInput({ value, onChange, placeholder, rows = 2, max, label, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; max: number; label: string; className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <div className={`rounded-xl border-2 border-line focus-within:border-brand ${className}`}>
      <div className="flex items-center justify-end border-b-2 border-line px-1 py-0.5"><FormatBar target={ref} value={value} onChange={onChange} /></div>
      <textarea ref={ref} rows={rows} maxLength={max} value={value} placeholder={placeholder} aria-label={label}
        onChange={e => onChange(e.target.value)}
        className="block w-full resize-y rounded-b-xl bg-white px-3 py-2 text-sm font-semibold text-ink outline-none" />
    </div>
  )
}

export const themeOf = (poll: Pick<PollView, 'theme' | 'type'>): PollTheme => poll.theme ?? defaultTheme(poll.type)

export function backgroundCss(pollId: string, t: PollTheme): CSSProperties {
  if (t.background === 'image' && t.backgroundImage) {
    return { background: `center/cover no-repeat url("${imageUrl(pollId, t.backgroundImage.id)}"), ${t.color}` }
  }
  return { background: (THEME_BACKGROUNDS.find(b => b.id === t.background) ?? THEME_BACKGROUNDS[1]).css(t.color) }
}

/** Variáveis do tema (cor e letra) para os elementos de dentro */
const themeVars = (t: PollTheme): CSSProperties => ({
  ['--pc' as string]: t.color,
  fontFamily: THEME_FONTS[t.font].css,
})

/**
 * Moldura do formulário: fundo, imagem de cabeçalho e cartão com o título, como no Microsoft Forms.
 * full: ocupa a página toda (link público); senão é um bloco com cantos redondos (dentro da app).
 */
export function ThemedFrame({ poll, intro, children, full = false }: { poll: PollView; intro?: ReactNode; children: ReactNode; full?: boolean }) {
  const t = themeOf(poll)
  const center = t.align === 'center'
  return (
    <div className={`pf ${full ? 'min-h-dvh' : 'rounded-3xl'} ${t.size === 'large' ? 'text-[17px]' : ''}`} style={{ ...backgroundCss(poll.id, t), ...themeVars(t) }}>
      <div className={`mx-auto max-w-2xl ${full ? 'px-3 pb-12 pt-4 sm:px-4 sm:pt-8' : 'p-2 sm:p-5'}`}>
        <div className="pf-top overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_-18px_rgb(43_40_64/0.5)]">
          {t.header && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(poll.id, t.header.id)} alt={t.header.alt ?? ''} className="max-h-56 w-full object-cover" />
          )}
          <div className={`p-5 sm:p-6 ${center ? 'text-center' : ''}`}>
            <h1 className={`${t.size === 'large' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} font-black leading-tight text-ink`}>{poll.title}</h1>
            {intro}
          </div>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
