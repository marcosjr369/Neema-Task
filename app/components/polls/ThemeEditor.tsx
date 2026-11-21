'use client'

import { CheckIcon, TextAlignCenterIcon, TextAlignLeftIcon } from '@phosphor-icons/react'
import { THEME_BACKGROUNDS, THEME_COLORS, THEME_FONTS, isContent } from '../../lib/polls'
import type { PollFont, PollTheme, PollView } from '../../types'
import { ImagePicker, type Upload } from './Builder'
import Respond from './Respond'
import { RichText, ThemedFrame } from './Theme'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-line p-4">
      <p className="label">{title}</p>
      {children}
    </section>
  )
}

const seg = (on: boolean) => `inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-extrabold transition-colors cursor-pointer ${on ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-body hover:bg-snow'}`

/** "Aspeto": cor, fundo, imagem de cabeçalho, letra, tamanho e alinhamento, com pré-visualização ao vivo */
export default function ThemeEditor({ poll, theme, onChange, onUpload }: { poll: PollView; theme: PollTheme; onChange: (t: PollTheme) => void; onUpload: Upload }) {
  const set = (patch: Partial<PollTheme>) => onChange({ ...theme, ...patch })
  // a pré-visualização mostra as duas primeiras perguntas
  const sample = { ...poll, theme, fields: poll.fields.filter(f => !isContent(f)).slice(0, 2) }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <Section title="Cor">
          <div className="flex flex-wrap items-center gap-2">
            {THEME_COLORS.map(c => (
              <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={theme.color.toLowerCase() === c.toLowerCase()} onClick={() => set({ color: c })}
                className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110 cursor-pointer"
                style={{ background: c, boxShadow: theme.color.toLowerCase() === c.toLowerCase() ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }}>
                {theme.color.toLowerCase() === c.toLowerCase() && <CheckIcon size={16} weight="bold" className="text-white" />}
              </button>
            ))}
            <label className="relative flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-2 border-line pl-1 pr-3 text-xs font-extrabold text-body hover:bg-snow" title="Escolher outra cor">
              <span className="h-6 w-6 rounded-full" style={{ background: 'conic-gradient(#F2545B, #FFC53D, #12B5A6, #4C7DFF, #7B61FF, #EC5BA6, #F2545B)' }} />
              Outra
              <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={theme.color} onChange={e => set({ color: e.target.value.toUpperCase() })} aria-label="Escolher outra cor" />
            </label>
          </div>
        </Section>

        <Section title="Fundo">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {THEME_BACKGROUNDS.map(b => {
              const on = theme.background === b.id
              return (
                <button key={b.id} type="button" aria-pressed={on} onClick={() => set({ background: b.id })}
                  className={`group overflow-hidden rounded-2xl border-2 text-left transition-[transform,border-color] hover:-translate-y-0.5 cursor-pointer ${on ? 'border-brand' : 'border-line'}`}>
                  <span className="relative block h-12" style={{ background: b.css(theme.color) }}>
                    {on && <CheckIcon size={16} weight="bold" className="absolute right-1.5 top-1.5 rounded-full bg-brand p-0.5 text-white" />}
                  </span>
                  <span className="block px-2 py-1 text-[11px] font-extrabold text-body">{b.name}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs font-extrabold text-muted">Ou uma imagem tua</p>
            <ImagePicker pollId={poll.id} image={theme.backgroundImage} onUpload={onUpload} label="Imagem de fundo"
              onChange={img => set(img ? { backgroundImage: img, background: 'image' } : { backgroundImage: undefined, background: theme.background === 'image' ? 'tint' : theme.background })} />
          </div>
        </Section>

        <Section title="Imagem de cabeçalho">
          <ImagePicker pollId={poll.id} image={theme.header} onUpload={onUpload} big label="Escolher imagem (logótipo, banner…)" onChange={header => set({ header })} />
          <p className="mt-1 text-xs font-semibold text-muted">Aparece no topo, por cima do título. Fica melhor uma imagem larga (ex.: 1200×300).</p>
        </Section>

        <Section title="Tipo de letra">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(THEME_FONTS) as PollFont[]).map(f => (
              <button key={f} type="button" aria-pressed={theme.font === f} onClick={() => set({ font: f })}
                className={`rounded-2xl border-2 px-3 py-2 text-left transition-colors cursor-pointer ${theme.font === f ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}>
                <span className="block text-2xl leading-none text-ink" style={{ fontFamily: THEME_FONTS[f].css }}>Aa</span>
                <span className="mt-1 block text-xs font-extrabold text-body">{THEME_FONTS[f].name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs font-extrabold text-muted">Tamanho</p>
              <div className="flex gap-1.5">
                <button type="button" className={seg(theme.size === 'normal')} onClick={() => set({ size: 'normal' })}>Normal</button>
                <button type="button" className={seg(theme.size === 'large')} onClick={() => set({ size: 'large' })}><span className="text-base">Grande</span></button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-extrabold text-muted">Título</p>
              <div className="flex gap-1.5">
                <button type="button" className={seg(theme.align === 'left')} onClick={() => set({ align: 'left' })} aria-label="Título à esquerda"><TextAlignLeftIcon size={18} /></button>
                <button type="button" className={seg(theme.align === 'center')} onClick={() => set({ align: 'center' })} aria-label="Título ao centro"><TextAlignCenterIcon size={18} /></button>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="label">Pré-visualização</p>
        <div className="max-h-[75vh] overflow-y-auto rounded-3xl border-2 border-line">
          <ThemedFrame poll={sample} intro={poll.description ? <RichText text={poll.description} className={`mt-2 block font-semibold text-body ${theme.align === 'center' ? 'text-center' : ''}`} /> : undefined}>
            {sample.fields.length
              ? <Respond poll={sample} preview onSubmit={async () => undefined} />
              : <p className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-muted">Junta perguntas para as veres aqui.</p>}
          </ThemedFrame>
        </div>
      </div>
    </div>
  )
}
