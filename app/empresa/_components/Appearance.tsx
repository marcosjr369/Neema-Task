'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwiseIcon, CheckIcon, EyeIcon, FloppyDiskIcon, ImageIcon, PaletteIcon, TextAaIcon, UploadSimpleIcon, WarningIcon, XIcon,
} from '@phosphor-icons/react'
import { useOrg } from '../../context/OrgContext'
import { useApp } from '../../context/AppContext'
import { api, errorText } from '../../lib/api'
import {
  BRAND_FONTS, BRAND_PAGES, BRAND_SWATCHES, DEFAULT_COLORS, TEXT_SIZES, backgroundCss, backgroundFor, contrast, deptChain, editableDepartments, mergeBrand, mix, palette, readableOnWhiteText,
} from '../../lib/brand'
import { THEME_BACKGROUNDS } from '../../lib/polls'
import { brandImageUrl, setBrandPreview } from '../../components/layout/BrandTheme'
import { Busy } from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import type { BrandBackground, BrandTheme, Department } from '../../types'

type Scope = 'org' | string

const card = 'rounded-3xl border-2 border-line bg-white p-4 sm:p-5'
const seg = (on: boolean) => `inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-extrabold transition-colors cursor-pointer ${on ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-body hover:bg-snow'}`

/** Envia uma imagem (logótipo ou fundo) e devolve o id */
function useUpload() {
  const org = useOrg()!
  return async (file: File) => {
    const form = new FormData()
    form.set('file', file)
    return (await api<{ id: string }>(`${org.base}/marca/imagem`, { form })).id
  }
}

/** trim: corta a margem vazia à volta (logótipos que vêm com muito espaço transparente ou branco) */
function UploadButton({ label, onDone, className = '', trim = false }: { label: string; onDone: (id: string) => void; className?: string; trim?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUpload()
  const { showToast } = useApp()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`btn btn-ghost px-3 py-2 text-xs ${className}`}>
        <Busy busy={busy} text="A enviar…"><UploadSimpleIcon size={16} /> {label}</Busy>
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try { onDone(await upload(trim ? await trimMargins(f) : f)) } catch (err) { showToast(errorText(err, 'Não foi possível enviar a imagem.'), 'danger') }
          setBusy(false)
        }} />
    </>
  )
}

/**
 * Uma cor. A da Udacha é sempre a predefinida e fica à parte, em primeiro lugar.
 * Na empresa, escolher a da Udacha é o mesmo que não personalizar; num departamento há também "Herdar".
 */
function ColorPicker({ label, hint, value, inherited, udacha, onChange, canInherit, swatches = BRAND_SWATCHES, forText = false }: {
  label: string; hint: string; value?: string; inherited: string; udacha: string; onChange: (v: string | undefined) => void
  canInherit: boolean; swatches?: string[]; forText?: boolean
}) {
  const shown = value ?? inherited
  const weak = forText ? contrast(shown, '#FFFFFF') < 4.5 : !readableOnWhiteText(shown)
  const isUdacha = shown.toUpperCase() === udacha.toUpperCase()
  const status = !value
    ? canInherit ? 'Herdada da empresa' : 'Predefinida da Udacha'
    : isUdacha ? 'Cor da Udacha' : 'Personalizada'
  const pill = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border-2 pl-1 pr-3 text-xs font-extrabold transition-colors cursor-pointer ${on ? 'border-brand bg-brand-light text-brand-dark' : 'border-line text-body hover:bg-snow'}`
  return (
    <div>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 h-6 w-6 shrink-0 rounded-lg border-2 border-white shadow ring-1 ring-line" style={{ background: shown }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 text-sm font-black text-ink">
            {label}
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-extrabold ${value && !isUdacha ? 'bg-brand-light text-brand-dark' : 'bg-snow text-muted'}`}>{status} · {shown}</span>
          </span>
          <span className="block text-xs font-semibold text-muted">{hint}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {canInherit && (
          <button type="button" aria-pressed={!value} onClick={() => onChange(undefined)} className={pill(!value)}>
            <span className="h-5 w-5 rounded-full ring-1 ring-line" style={{ background: inherited }} /> Herdar
          </button>
        )}
        <button type="button" aria-pressed={canInherit ? !!value && isUdacha : !value || isUdacha}
          onClick={() => onChange(canInherit ? udacha : undefined)} className={pill(canInherit ? !!value && isUdacha : !value || isUdacha)}
          title="A cor original da Udacha">
          <span className="h-5 w-5 rounded-full" style={{ background: udacha }} /> Udacha <span className="font-semibold opacity-70">(predefinida)</span>
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        {swatches.filter(c => c.toUpperCase() !== udacha.toUpperCase()).map(c => {
          const on = !!value && shown.toUpperCase() === c.toUpperCase()
          return (
            <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={on} onClick={() => onChange(c)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 cursor-pointer"
              style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }}>
              {on && <CheckIcon size={14} weight="bold" style={{ color: palette(c).on }} />}
            </button>
          )
        })}
        <label className="relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-2 border-line pl-1 pr-2.5 text-xs font-extrabold text-body hover:bg-snow">
          <span className="h-5 w-5 rounded-full" style={{ background: 'conic-gradient(#F2545B, #FFC53D, #12B5A6, #4C7DFF, #7B61FF, #EC5BA6, #F2545B)' }} />
          Outra
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={shown} onChange={e => onChange(e.target.value.toUpperCase())} aria-label={`${label}: outra cor`} />
        </label>
      </div>
      {weak && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-gold/15 p-2 text-xs font-bold text-gold-dark">
          <WarningIcon size={15} className="mt-px shrink-0" />
          {forText
            ? 'Esta cor é clara de mais para texto: fica difícil de ler em fundo branco. Escolhe um tom mais escuro.'
            : 'Cor clara: nos botões as letras passam a escuras para se lerem, e os textos e ícones nesta cor ficam num tom mais escuro. Vê na pré-visualização.'}
        </p>
      )}
    </div>
  )
}

/** Fundo de uma página (ou de todas): herdar, nenhum, cor, fundo pronto ou imagem, e quanto clarear */
function BackgroundPicker({ value, onChange, primary, orgId, inheritLabel }: {
  /** undefined: herda · null: nenhum */
  value: BrandBackground | null | undefined
  onChange: (v: BrandBackground | null | undefined) => void
  primary: string
  orgId: string
  inheritLabel: string
}) {
  const mode = value === undefined ? 'inherit' : value === null ? 'none' : value.kind
  const soften = value?.soften ?? 0
  const set = (patch: Partial<BrandBackground>) => onChange({ ...(value ?? { kind: 'color' }), ...patch } as BrandBackground)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={seg(mode === 'inherit')} onClick={() => onChange(undefined)}>{inheritLabel}</button>
        <button type="button" className={seg(mode === 'none')} onClick={() => onChange(null)}>Branco</button>
        <button type="button" className={seg(mode === 'color')} onClick={() => onChange({ kind: 'color', value: value?.kind === 'color' ? value.value : '#F3F0FF', soften: 0 })}>Cor</button>
        <button type="button" className={seg(mode === 'preset')} onClick={() => onChange({ kind: 'preset', value: value?.kind === 'preset' ? value.value : 'waves', soften: 0 })}>Padrão</button>
        <button type="button" className={seg(mode === 'image')} onClick={() => { if (value?.kind !== 'image') onChange({ kind: 'image', soften: 70 }) }}>Imagem</button>
      </div>

      {value?.kind === 'color' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {['#F3F0FF', '#EAF2FF', '#E6F7F4', '#FFF6E5', '#FDEDF4', '#F1F5F9', '#1E1B33', '#0F172A'].map(c => (
            <button key={c} type="button" onClick={() => set({ value: c })} aria-label={`Cor ${c}`}
              className="h-8 w-8 rounded-full ring-1 ring-line transition-transform hover:scale-110 cursor-pointer" style={{ background: c, boxShadow: value.value === c ? `0 0 0 2px #fff, 0 0 0 4px ${primary}` : undefined }} />
          ))}
          <label className="relative flex h-8 cursor-pointer items-center rounded-full border-2 border-line px-2.5 text-xs font-extrabold text-body hover:bg-snow">
            Outra<input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value.value ?? '#FFFFFF'} onChange={e => set({ value: e.target.value.toUpperCase() })} />
          </label>
        </div>
      )}
      {value?.kind === 'preset' && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {THEME_BACKGROUNDS.filter(b => b.id !== 'none').map(b => (
            <button key={b.id} type="button" aria-pressed={value.value === b.id} onClick={() => set({ value: b.id })}
              className={`overflow-hidden rounded-xl border-2 text-left cursor-pointer ${value.value === b.id ? 'border-brand' : 'border-line'}`}>
              <span className="block h-10" style={{ background: b.css(primary) }} />
              <span className="block px-1.5 py-0.5 text-[11px] font-extrabold text-body">{b.name}</span>
            </button>
          ))}
        </div>
      )}
      {value?.kind === 'image' && (
        <div className="flex flex-wrap items-center gap-2">
          {value.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandImageUrl(orgId, value.image)} alt="" className="h-14 w-24 rounded-xl object-cover ring-1 ring-line" />
          )}
          <UploadButton label={value.image ? 'Trocar imagem' : 'Escolher imagem'} onDone={id => set({ image: id })} />
          {!value.image && <span className="text-xs font-bold text-muted">Fica melhor uma foto larga, sem muito detalhe.</span>}
        </div>
      )}
      {value && (
        <label className="flex items-center gap-3 text-xs font-extrabold text-muted">
          Clarear
          <input type="range" min={0} max={90} step={5} value={soften} onChange={e => set({ soften: Number(e.target.value) })} className="flex-1 accent-brand" aria-label="Clarear o fundo" />
          <span className="w-9 text-right tabular-nums text-body">{soften}%</span>
        </label>
      )}
      {value && <div className="h-16 rounded-2xl ring-1 ring-line" style={{ background: backgroundCss(value, primary, id => brandImageUrl(orgId, id)) }} aria-hidden />}
    </div>
  )
}

function scopeLabel(d: Department, departments: Department[]) {
  return deptChain(departments, d.id).map(x => x.name).join(' › ')
}

export default function Appearance() {
  const org = useOrg()!
  const { showToast } = useApp()
  const depts = useMemo(() => editableDepartments(org.departments, org.scope), [org.departments, org.scope])
  const [scope, setScope] = useState<Scope>(org.isAdmin ? 'org' : depts[0]?.id ?? 'org')
  const stored = (s: Scope): BrandTheme => (s === 'org' ? org.org.brand : org.departments.find(d => d.id === s)?.brand) ?? {}
  const [draft, setDraft] = useState<BrandTheme>(() => stored(scope))
  const [busy, setBusy] = useState(false)
  const [openPage, setOpenPage] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const dept = scope === 'org' ? undefined : org.departments.find(d => d.id === scope)
  // o que vem de cima: a empresa e os departamentos acima deste
  const inherited = useMemo(() => {
    if (!dept) return {}
    let out: BrandTheme = { ...(org.org.brand ?? {}) }
    for (const d of deptChain(org.departments, dept.parentId)) out = mergeBrand(out, d.brand)
    return out
  }, [dept, org.org.brand, org.departments])
  const effective = useMemo(() => mergeBrand(inherited, draft), [inherited, draft])
  const primary = effective.primary ?? DEFAULT_COLORS.primary
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored(scope))
  const canInherit = !!dept

  // pré-visualização em toda a app enquanto se edita
  useEffect(() => {
    setBrandPreview({ ...effective, logo: scope === 'org' ? draft.logo : org.org.brand?.logo })
  }, [effective, draft.logo, scope, org.org.brand?.logo])
  useEffect(() => () => setBrandPreview(null), [])

  const change = (patch: Partial<BrandTheme>) => setDraft(d => {
    const next = { ...d, ...patch }
    for (const k of Object.keys(patch) as (keyof BrandTheme)[]) if (patch[k] === undefined) delete next[k]
    return next
  })
  const setPage = (key: string, v: BrandBackground | null | undefined) => setDraft(d => {
    const pages = { ...(d.pages ?? {}) }
    if (v === undefined) delete pages[key]
    else pages[key] = v
    const next: BrandTheme = { ...d, pages }
    if (!Object.keys(pages).length) delete next.pages
    return next
  })

  const pick = (s: Scope) => {
    if (dirty && !confirm('Tens alterações por guardar. Mudar e perdê-las?')) return
    setScope(s)
    setDraft(stored(s))
  }

  const save = async (brand: BrandTheme | null) => {
    if (brand?.background?.kind === 'image' && !brand.background.image) return showToast('Escolhe a imagem de fundo', 'danger')
    if (Object.values(brand?.pages ?? {}).some(b => b?.kind === 'image' && !b.image)) return showToast('Há uma página com fundo de imagem sem imagem', 'danger')
    setBusy(true)
    try {
      await api(`${org.base}/marca`, { method: 'PATCH', body: { departmentId: dept?.id, brand } })
      await org.refresh()
      setDraft(brand ? { ...brand } : {})
      showToast(brand ? 'Aparência guardada' : 'Aparência reposta', 'success')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível guardar a aparência.'), 'danger')
    }
    setBusy(false)
  }

  if (!org.isAdmin && !depts.length) {
    return <p className="rounded-3xl bg-snow p-6 text-center font-bold text-muted">Só os administradores e as chefias de departamento mudam a aparência.</p>
  }

  const savedEffective = mergeBrand(inherited, stored(scope))
  return (
    <div className="grid gap-5 pb-24 xl:grid-cols-[minmax(0,1fr)_380px]">
    <div className="min-w-0 space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-brand"><PaletteIcon size={24} weight="duotone" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-ink">Aparência de</p>
          <p className="text-xs font-semibold text-muted">
            {dept ? 'As pessoas deste departamento (e dos que estão abaixo) vêem isto. O que deixares em "herdar" vem da empresa.' : 'Toda a empresa vê isto. Cada departamento pode mudar uma parte.'}
          </p>
        </div>
        <select className="input w-full py-2 text-sm font-bold sm:w-72" value={scope} onChange={e => pick(e.target.value)} aria-label="Aparência de">
          {org.isAdmin && <option value="org">Toda a empresa ({org.org.name})</option>}
          {depts.map(d => <option key={d.id} value={d.id}>{scopeLabel(d, org.departments)}{d.brand ? ' · personalizado' : ''}</option>)}
        </select>
      </div>

      <ResetCard dept={dept?.name} customized={Object.keys(stored(scope)).some(k => k !== 'updatedAt' && k !== 'updatedBy')} busy={busy} onReset={() => setResetting(true)} />

      {scope === 'org' && (
        <section className={card}>
          <h2 className="mb-1 flex items-center gap-2 font-black text-ink"><ImageIcon size={20} /> Logótipo</h2>
          <p className="mb-3 text-sm font-semibold text-muted">Aparece no topo do menu e, no telemóvel, no topo das páginas. Usa PNG ou SVG com fundo transparente.</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-20 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-snow p-2">
              {draft.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={brandImageUrl(org.org.id, draft.logo)} alt="Logótipo" className="max-h-full max-w-full object-contain" />
                : <span className="text-xs font-bold text-muted">Sem logótipo</span>}
            </div>
            <UploadButton trim label={draft.logo ? 'Trocar' : 'Enviar logótipo'} onDone={id => change({ logo: id })} />
            {draft.logo && <button type="button" onClick={() => change({ logo: undefined })} className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold text-danger hover:bg-danger-light cursor-pointer"><XIcon size={14} /> Tirar</button>}
          </div>
        </section>
      )}

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-black text-ink"><PaletteIcon size={20} /> Cores
          {!!(draft.primary || draft.secondary || draft.text) && (
            <button type="button" onClick={() => change({ primary: undefined, secondary: undefined, text: undefined })} title="Voltar às cores iniciais"
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-muted hover:bg-snow hover:text-ink cursor-pointer">
              <ArrowCounterClockwiseIcon size={14} weight="bold" /> Redefinir
            </button>
          )}
        </h2>
        <div className="space-y-5">
          <ColorPicker udacha={DEFAULT_COLORS.primary} label="Cor principal" hint="Botões principais, menu seleccionado, ligações e destaques." canInherit={canInherit} value={draft.primary} inherited={inherited.primary ?? DEFAULT_COLORS.primary} onChange={v => change({ primary: v })} />
          <ColorPicker udacha={DEFAULT_COLORS.secondary} label="Cor secundária" hint="Botões de concluir e confirmar, etiquetas de “feito”, sucesso." canInherit={canInherit} value={draft.secondary} inherited={inherited.secondary ?? DEFAULT_COLORS.secondary} onChange={v => change({ secondary: v })} />
          <ColorPicker udacha={DEFAULT_COLORS.text} label="Cor do texto" hint="Títulos e texto das páginas." forText canInherit={canInherit} value={draft.text} inherited={inherited.text ?? DEFAULT_COLORS.text} onChange={v => change({ text: v })}
            swatches={['#2B2840', '#111827', '#1F2937', '#334155', '#0F3D3E', '#1E3A8A', '#3B0764', '#4A2511', '#000000']} />
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 flex items-center gap-2 font-black text-ink"><TextAaIcon size={20} /> Letra
          {!!(draft.font || draft.textSize) && (
            <button type="button" onClick={() => change({ font: undefined, textSize: undefined })} title="Voltar à letra e ao tamanho iniciais"
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-muted hover:bg-snow hover:text-ink cursor-pointer">
              <ArrowCounterClockwiseIcon size={14} weight="bold" /> Redefinir
            </button>
          )}
        </h2>
        <FontPreviewLoader />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {canInherit && (
            <button type="button" onClick={() => change({ font: undefined })} className={`rounded-2xl border-2 p-3 text-left cursor-pointer ${!draft.font ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}>
              <span className="block text-2xl leading-none text-muted">Aa</span>
              <span className="mt-1 block text-xs font-extrabold text-body">Herdar</span>
            </button>
          )}
          {Object.entries(BRAND_FONTS).map(([id, f]) => {
            const on = (draft.font ?? (canInherit ? undefined : 'nunito')) === id
            return (
              <button key={id} type="button" aria-pressed={on} onClick={() => change({ font: id === 'nunito' && !canInherit ? undefined : id })}
                className={`rounded-2xl border-2 p-3 text-left transition-colors cursor-pointer ${on ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}>
                <span className="block text-2xl leading-none text-ink" style={{ fontFamily: f.css }}>Aa Bb</span>
                <span className="mt-1 block truncate text-xs font-extrabold text-body" style={{ fontFamily: f.css }}>{f.name}</span>
              </button>
            )
          })}
        </div>
        <p className="mb-2 mt-4 text-sm font-black text-ink">Tamanho do texto</p>
        <div className="flex flex-wrap gap-1.5">
          {canInherit && <button type="button" className={seg(!draft.textSize)} onClick={() => change({ textSize: undefined })}>Herdar</button>}
          {(Object.keys(TEXT_SIZES) as (keyof typeof TEXT_SIZES)[]).map(k => (
            <button key={k} type="button" className={seg((draft.textSize ?? (canInherit ? undefined : 'normal')) === k)}
              onClick={() => change({ textSize: k === 'normal' && !canInherit ? undefined : k })}
              style={{ fontSize: `calc(0.875rem * ${parseFloat(TEXT_SIZES[k].scale) / 100})` }}>
              {TEXT_SIZES[k].name}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 flex items-center gap-2 font-black text-ink"><ImageIcon size={20} /> Fundos
          {(draft.background !== undefined || !!draft.pages) && (
            <button type="button" onClick={() => change({ background: undefined, pages: undefined })} title="Tirar todos os fundos"
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-muted hover:bg-snow hover:text-ink cursor-pointer">
              <ArrowCounterClockwiseIcon size={14} weight="bold" /> Redefinir
            </button>
          )}
        </h2>
        <p className="mb-3 text-sm font-semibold text-muted">Um fundo para todas as páginas e, se quiseres, um diferente em cada página. Usa &ldquo;Clarear&rdquo; para o texto continuar fácil de ler.</p>
        <p className="mb-2 text-sm font-black text-ink">Todas as páginas</p>
        <BackgroundPicker value={draft.background} primary={primary} orgId={org.org.id} inheritLabel={canInherit ? 'Herdar' : 'Sem fundo'}
          onChange={v => change({ background: v })} />

        <p className="mb-2 mt-5 text-sm font-black text-ink">Página a página</p>
        <ul className="divide-y-2 divide-line rounded-2xl border-2 border-line">
          {BRAND_PAGES.map(p => {
            const own = draft.pages && p.key in draft.pages ? draft.pages[p.key] : undefined
            const has = !!draft.pages && p.key in draft.pages
            const open = openPage === p.key
            return (
              <li key={p.key}>
                <button type="button" onClick={() => setOpenPage(open ? null : p.key)} aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-snow cursor-pointer">
                  <span className="h-7 w-10 shrink-0 rounded-lg ring-1 ring-line"
                    style={{ background: has && own ? backgroundCss(own, primary, id => brandImageUrl(org.org.id, id)) : has ? '#fff' : 'repeating-linear-gradient(45deg,#F7F6FC 0 6px,#fff 6px 12px)' }} />
                  <span className="min-w-0 flex-1 text-sm font-extrabold text-ink">{p.name}</span>
                  <span className="text-xs font-bold text-muted">{!has ? 'Como as outras' : own === null ? 'Branco' : own?.kind === 'image' ? 'Imagem' : own?.kind === 'preset' ? 'Padrão' : 'Cor'}</span>
                </button>
                {open && (
                  <div className="border-t-2 border-line bg-snow/50 p-3 animate-dg-rise">
                    <BackgroundPicker value={has ? own : undefined} primary={primary} orgId={org.org.id} inheritLabel="Como as outras" onChange={v => setPage(p.key, v)} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

    </div>

    <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
      <Preview theme={{ ...effective, logo: scope === 'org' ? draft.logo : org.org.brand?.logo }} orgId={org.org.id} orgName={org.org.name} />
      <Changes before={{ ...savedEffective, logo: scope === 'org' ? stored(scope).logo : org.org.brand?.logo }} after={{ ...effective, logo: scope === 'org' ? draft.logo : org.org.brand?.logo }} />
    </aside>

      <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-3xl xl:col-span-2 border-2 border-line bg-white/95 p-3 shadow-[0_10px_30px_-18px_rgb(43_40_64/0.5)] backdrop-blur lg:bottom-4">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-bold text-muted">
          <EyeIcon size={16} className="shrink-0 text-brand" />
          {dirty ? 'Estás a ver a pré-visualização em toda a app. Guarda para todos verem.' : 'Tudo guardado.'}
        </span>
        {dirty && <button type="button" className="btn btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => setDraft(stored(scope))}>Descartar</button>}
        <button type="button" className="btn btn-primary px-4 py-2 text-xs" disabled={busy || !dirty} onClick={() => save(draft)}>
          <Busy busy={busy} text="A guardar…"><FloppyDiskIcon size={16} /> Guardar</Busy>
        </button>
      </div>

      {resetting && (
        <ResetDialog dept={dept?.name} hasLogo={!dept && !!stored(scope).logo} busy={busy} onClose={() => setResetting(false)}
          onConfirm={async keepLogo => {
            await save(keepLogo && stored(scope).logo ? { logo: stored(scope).logo } : null)
            setResetting(false)
          }} />
      )}
    </div>
  )
}

/** Descarrega só as letras "Aa Bb" e os nomes de cada tipo de letra, para os mostrar (leve) */
function FontPreviewLoader() {
  useEffect(() => {
    if (document.getElementById('brand-font-preview')) return
    const families = Object.values(BRAND_FONTS).filter(f => f.google).map(f => `family=${f.google!.split(':')[0]}:wght@700`).join('&')
    const text = encodeURIComponent('AaBb ' + Object.values(BRAND_FONTS).map(f => f.name).join(''))
    const link = document.createElement('link')
    link.id = 'brand-font-preview'
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${families}&text=${text}&display=swap`
    document.head.appendChild(link)
  }, [])
  return null
}

/**
 * Pré-visualização: uma "mini app" desenhada com as cores calculadas aqui (não depende do resto da
 * página), para ver exactamente botões, texto, menu e fundo antes de guardar.
 */
function Preview({ theme, orgId, orgName }: { theme: BrandTheme; orgId: string; orgName: string }) {
  const primary = theme.primary ?? DEFAULT_COLORS.primary
  const secondary = theme.secondary ?? DEFAULT_COLORS.secondary
  const ink = theme.text ?? DEFAULT_COLORS.text
  const body = mix(ink, '#FFFFFF', 0.18)
  const p = palette(primary)
  const a = palette(secondary)
  const font = BRAND_FONTS[theme.font ?? 'nunito']?.css
  const scale = parseFloat(TEXT_SIZES[theme.textSize ?? 'normal'].scale) / 100
  const bg = backgroundFor(theme, '/')
  const pageBg = bg ? backgroundCss(bg, primary, id => brandImageUrl(orgId, id)) : '#FFFFFF'
  const btn = (c: string, on: string, dark: string) => ({ background: c, color: on, borderBottom: `3px solid ${dark}` })
  return (
    <section className="overflow-hidden rounded-3xl border-2 border-line bg-white">
      <p className="flex items-center gap-1.5 border-b-2 border-line px-4 py-2.5 text-xs font-extrabold text-muted"><EyeIcon size={15} className="text-brand" /> Pré-visualização (página Início)</p>
      <div className="flex h-[300px] text-[13px]" style={{ fontFamily: font, fontSize: `${13 * scale}px` }}>
        <div className="flex w-[118px] shrink-0 flex-col gap-1 border-r border-line bg-white p-2">
          <div className="mb-1 flex h-8 items-center">
            {theme.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brandImageUrl(orgId, theme.logo)} alt="" className="max-h-8 max-w-full object-contain" />
              : <span className="truncate text-[11px] font-black" style={{ color: p.dark }}>{orgName}</span>}
          </div>
          <span className="rounded-lg px-2 py-1 text-center text-[10px] font-extrabold uppercase" style={btn(primary, p.on, p.dark)}>+ Nova tarefa</span>
          {['Início', 'Tarefas', 'Calendário', 'Quadros'].map((m, i) => (
            <span key={m} className="rounded-lg px-2 py-1 text-[11px] font-extrabold" style={i === 0 ? { background: p.light, color: p.dark } : { color: body }}>{m}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden p-3" style={{ background: pageBg }}>
          <p className="text-[15px] font-black leading-tight" style={{ color: ink, fontSize: `${15 * scale}px` }}>Bom dia, Ana!</p>
          <p className="text-[11px] font-semibold" style={{ color: body }}>Tens 3 tarefas para hoje.</p>
          <div className="mt-2 space-y-1.5">
            {[{ t: 'Relatório mensal', done: true }, { t: 'Ligar ao cliente', done: false }].map(x => (
              <div key={x.t} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5">
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2" style={x.done ? { background: secondary, borderColor: secondary } : { borderColor: primary }} />
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold" style={{ color: ink }}>{x.t}</span>
                {x.done && <span className="rounded-md px-1.5 text-[9px] font-extrabold" style={{ background: a.light, color: a.dark }}>Feito</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-bold" style={{ color: body }}>Ver o <span className="underline" style={{ color: p.dark }}>relatório da semana</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-xl px-2.5 py-1 text-[10px] font-extrabold uppercase" style={btn(primary, p.on, p.dark)}>Guardar</span>
            <span className="rounded-xl px-2.5 py-1 text-[10px] font-extrabold uppercase" style={btn(secondary, a.on, a.dark)}>Concluir</span>
            <span className="rounded-lg px-2 py-1 text-[10px] font-extrabold" style={{ background: p.light, color: p.dark }}>Etiqueta</span>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t-2 border-line px-4 py-3 text-[11px] font-bold text-muted">
        <dt>Letra dos botões</dt><dd className="flex items-center gap-1 text-body"><Dot c={p.on} /> {p.on === '#FFFFFF' ? 'branca' : 'escura (cor clara)'}</dd>
        <dt>Textos na cor principal</dt><dd className="flex items-center gap-1 text-body"><Dot c={p.dark} /> {p.dark}</dd>
        <dt>Fundos suaves</dt><dd className="flex items-center gap-1 text-body"><Dot c={p.light} /> {p.light}</dd>
      </dl>
    </section>
  )
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-3 w-3 rounded-full ring-1 ring-line" style={{ background: c }} />
}

/** O que muda em relação ao que está gravado (antes → depois) */
function Changes({ before, after }: { before: BrandTheme; after: BrandTheme }) {
  const rows: { label: string; where: string; from: React.ReactNode; to: React.ReactNode }[] = []
  const color = (k: 'primary' | 'secondary' | 'text', label: string, where: string) => {
    const x = before[k] ?? DEFAULT_COLORS[k]
    const y = after[k] ?? DEFAULT_COLORS[k]
    if (x.toUpperCase() !== y.toUpperCase()) rows.push({ label, where, from: <><Dot c={x} /> {x}</>, to: <><Dot c={y} /> {y}</> })
  }
  color('primary', 'Cor principal', 'botões, menu, ligações')
  color('secondary', 'Cor secundária', 'concluir, confirmações')
  color('text', 'Cor do texto', 'títulos e texto')
  const font = (t: BrandTheme) => BRAND_FONTS[t.font ?? 'nunito']?.name ?? 'Nunito'
  if (font(before) !== font(after)) rows.push({ label: 'Letra', where: 'toda a app', from: font(before), to: <span style={{ fontFamily: BRAND_FONTS[after.font ?? 'nunito']?.css }}>{font(after)}</span> })
  const size = (t: BrandTheme) => TEXT_SIZES[t.textSize ?? 'normal'].name
  if (size(before) !== size(after)) rows.push({ label: 'Tamanho do texto', where: 'toda a app', from: size(before), to: size(after) })
  if ((before.logo ?? '') !== (after.logo ?? '')) rows.push({ label: 'Logótipo', where: 'topo do menu', from: before.logo ? 'com logótipo' : 'sem', to: after.logo ? (before.logo ? 'novo logótipo' : 'com logótipo') : 'sem' })
  const bgName = (b: BrandBackground | null | undefined) => (!b ? 'branco' : b.kind === 'image' ? 'imagem' : b.kind === 'preset' ? 'padrão' : `cor ${b.value}`)
  if (JSON.stringify(before.background ?? null) !== JSON.stringify(after.background ?? null)) rows.push({ label: 'Fundo geral', where: 'todas as páginas', from: bgName(before.background), to: bgName(after.background) })
  const pages = BRAND_PAGES.filter(p => JSON.stringify(before.pages?.[p.key]) !== JSON.stringify(after.pages?.[p.key]))
  if (pages.length) rows.push({ label: 'Fundos por página', where: pages.map(p => p.name).join(', '), from: '', to: `${pages.length} alterada${pages.length === 1 ? '' : 's'}` })

  return (
    <section className="rounded-3xl border-2 border-line bg-white p-4">
      <h3 className="mb-2 text-sm font-black text-ink">O que muda</h3>
      {rows.length === 0 ? (
        <p className="text-xs font-semibold text-muted">Nada por guardar. Escolhe cores, letra ou fundos e vês aqui a diferença.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.label} className="rounded-xl bg-snow px-3 py-2 animate-dg-rise">
              <p className="text-xs font-black text-ink">{r.label} <span className="font-semibold text-muted">· {r.where}</span></p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-body">
                {r.from && <span className="inline-flex items-center gap-1 text-muted line-through decoration-1">{r.from}</span>}
                {r.from && <span className="text-muted">→</span>}
                <span className="inline-flex items-center gap-1">{r.to}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Destaque no topo: voltar ao design inicial (da Udacha, ou da empresa num departamento) */
function ResetCard({ dept, customized, busy, onReset }: { dept?: string; customized: boolean; busy: boolean; onReset: () => void }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-3xl border-2 p-4 ${customized ? 'border-line bg-white' : 'border-accent/30 bg-accent-light/50'}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${customized ? 'bg-snow text-body' : 'bg-white text-accent-dark'}`}>
        {customized ? <ArrowCounterClockwiseIcon size={22} weight="bold" /> : <CheckIcon size={22} weight="bold" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-ink">{dept ? 'Aparência da empresa' : 'Design inicial da Udacha'}</p>
        <p className="text-xs font-semibold text-muted">
          {customized
            ? dept ? `"${dept}" tem uma aparência própria. Podes voltar a usar só a da empresa.` : 'A empresa tem cores, letra ou fundos próprios. Podes voltar ao design original da Udacha a qualquer momento.'
            : dept ? `"${dept}" usa a aparência da empresa.` : 'Estás a usar o design original da Udacha (cores, letra e fundos predefinidos).'}
        </p>
      </div>
      {customized && (
        <button type="button" disabled={busy} onClick={onReset} className="btn btn-ghost shrink-0 px-4 py-2 text-xs">
          <ArrowCounterClockwiseIcon size={16} weight="bold" /> {dept ? 'Usar a da empresa' : 'Redefinir'}
        </button>
      )}
    </div>
  )
}

function ResetDialog({ dept, hasLogo, busy, onClose, onConfirm }: { dept?: string; hasLogo: boolean; busy: boolean; onClose: () => void; onConfirm: (keepLogo: boolean) => Promise<void> }) {
  const [keepLogo, setKeepLogo] = useState(true)
  return (
    <Modal title={dept ? 'Usar a aparência da empresa' : 'Voltar ao design inicial'} onClose={onClose}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button className="btn btn-primary flex-1" disabled={busy} onClick={() => onConfirm(hasLogo && keepLogo)}>
            <Busy busy={busy} text="A redefinir…"><ArrowCounterClockwiseIcon size={18} weight="bold" /> Redefinir</Busy>
          </button>
          <button className="btn btn-ghost flex-1" disabled={busy} onClick={onClose}>Cancelar</button>
        </div>
      )}>
      <p className="font-semibold text-body">
        {dept
          ? `As cores, a letra e os fundos próprios de "${dept}" deixam de existir. As pessoas deste departamento passam a ver a aparência da empresa.`
          : 'As cores, a letra, o tamanho do texto e os fundos voltam aos da Udacha para toda a empresa. Podes personalizar outra vez quando quiseres.'}
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-snow p-3">
        {[['#7B61FF', 'Principal'], ['#12B5A6', 'Secundária'], ['#2B2840', 'Texto']].map(([c, n]) => (
          <span key={c} className="flex items-center gap-1.5 text-xs font-extrabold text-body"><span className="h-5 w-5 rounded-full" style={{ background: c }} /> {n}</span>
        ))}
        <span className="ml-auto text-xs font-bold text-muted">Udacha</span>
      </div>
      {hasLogo && (
        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-line p-3 hover:bg-snow">
          <input type="checkbox" className="h-5 w-5 accent-brand" checked={keepLogo} onChange={e => setKeepLogo(e.target.checked)} />
          <span className="text-sm font-bold text-ink">Manter o logótipo da empresa</span>
        </label>
      )}
    </Modal>
  )
}

/**
 * Corta a margem vazia (transparente ou quase branca) à volta de uma imagem, para o logótipo
 * ocupar o espaço todo. SVG e GIF ficam como estão; se algo falhar, envia o original.
 */
async function trimMargins(file: File): Promise<File> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width: w, height: h } = bitmap
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0)
    const data = ctx.getImageData(0, 0, w, h).data
    const empty = (i: number) => data[i + 3] < 16 || (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245)
    let top = h, left = w, right = -1, bottom = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (empty((y * w + x) * 4)) continue
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
    if (right < 0) return file
    // uma pequena folga para o desenho não ficar colado à borda
    const pad = Math.round(Math.max(right - left, bottom - top) * 0.02)
    left = Math.max(0, left - pad); top = Math.max(0, top - pad)
    right = Math.min(w - 1, right + pad); bottom = Math.min(h - 1, bottom + pad)
    const cw = right - left + 1, ch = bottom - top + 1
    if (cw >= w * 0.97 && ch >= h * 0.97) return file
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    out.getContext('2d')!.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch)
    const blob = await new Promise<Blob | null>(r => out.toBlob(r, 'image/png'))
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' }) : file
  } catch {
    return file
  }
}
