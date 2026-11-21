import type {
  AnswerValue, FieldKind, FieldResult, Poll, PollField, PollFile, PollFont, PollImage, PollOption, PollResponse, PollResults, PollSettings, PollTheme, PollType,
  ResultsWhen, ScaleStyle, SlotAnswer,
} from '../types'

/**
 * Inquéritos: regras partilhadas pelo browser e pelo servidor (sem dependências).
 * Validar o que o dono desenha (cleanFields/cleanSettings), validar respostas (cleanAnswers)
 * e calcular resultados (summarize). Tudo o que é para guardar passa por aqui no servidor.
 */

export class PollError extends Error {}
const bad = (m: string): never => { throw new PollError(m) }

export const POLL_LIMITS = {
  title: 120,
  description: 2000,
  fields: 60,
  fieldTitle: 300,
  help: 500,
  options: 50,
  option: 200,
  short: 500,
  long: 5000,
  other: 200,
  thanks: 500,
  /** eleição: cargos */
  positions: 20,
  /** agendar: datas propostas */
  slots: 40,
  /** ideias/candidaturas por pessoa */
  entriesPerPerson: 20,
  entryText: 200,
  entryDetails: 2000,
  file: 10 * 1024 * 1024,
}

export const POLL_TYPES: PollType[] = ['vote', 'election', 'form', 'contest', 'ideas', 'schedule']

export const TYPE_INFO: Record<PollType, { name: string; text: string; example: string }> = {
  vote: { name: 'Votação', text: 'Uma pergunta com opções e resultado imediato. Ideal para decisões rápidas e escolhas de equipa.', example: 'Onde fazemos o jantar de fim de ano?' },
  election: { name: 'Eleição', text: 'Cargos, candidatos e voto em branco. Voto secreto: ninguém sabe em quem cada pessoa votou.', example: 'Eleição do representante dos trabalhadores' },
  form: { name: 'Formulário', text: 'Várias perguntas (texto, escolhas, escalas, ficheiros…) com lógica condicional. Vê o resumo e cada resposta.', example: 'Inquérito de satisfação da equipa' },
  contest: { name: 'Concurso', text: 'As pessoas enviam candidaturas (com fotos ou ficheiros) e depois vota-se nas recebidas. Júri opcional.', example: 'Concurso de fotos do escritório' },
  ideas: { name: 'Ideias', text: 'Cada pessoa propõe ideias e vota nas que mais gosta. As melhores sobem para o topo.', example: 'Como podemos melhorar o escritório?' },
  schedule: { name: 'Agendar', text: 'Propõe várias datas e horas; cada pessoa diz se pode. A melhor data salta à vista.', example: 'Qual o melhor dia para a reunião?' },
}

/** choice: tem opções que se escolhem · content: não é pergunta (secção, texto, imagem) */
export const KIND_INFO: Record<FieldKind, { name: string; choice?: boolean; content?: boolean; text?: string }> = {
  short: { name: 'Texto curto' },
  long: { name: 'Texto longo' },
  email: { name: 'Email' },
  phone: { name: 'Telefone' },
  number: { name: 'Número' },
  date: { name: 'Data' },
  time: { name: 'Hora' },
  single: { name: 'Escolha única', choice: true },
  multi: { name: 'Várias escolhas', choice: true },
  dropdown: { name: 'Lista', choice: true },
  scale: { name: 'Classificação', text: 'Estrelas, corações, caras ou números' },
  yesno: { name: 'Sim / Não' },
  file: { name: 'Ficheiro' },
  slots: { name: 'Datas' },
  nps: { name: 'Recomendação (NPS)', text: 'De 0 a 10: recomendarias?' },
  ranking: { name: 'Ordenação', text: 'Pôr opções por ordem de preferência' },
  likert: { name: 'Grelha (Likert)', text: 'Várias afirmações, a mesma escala' },
  section: { name: 'Secção', content: true, text: 'Divide o formulário em páginas' },
  text: { name: 'Texto', content: true, text: 'Título ou parágrafo de explicação' },
  image: { name: 'Imagem', content: true, text: 'Uma imagem com legenda' },
}

/** Perguntas que o formulário (e as candidaturas) podem ter */
export const FORM_KINDS: FieldKind[] = ['single', 'multi', 'short', 'long', 'scale', 'dropdown', 'yesno', 'nps', 'ranking', 'likert', 'date', 'time', 'number', 'email', 'phone', 'file']
/** Conteúdo que se pode pôr no meio das perguntas */
export const CONTENT_KINDS: FieldKind[] = ['section', 'text', 'image']

export const isContent = (f: Pick<PollField, 'kind'>) => !!KIND_INFO[f.kind].content

/** As opções de uma pergunta de escolha ou ordenação/likert */
export const hasOptions = (k: FieldKind) => !!KIND_INFO[k].choice || k === 'ranking' || k === 'likert' || k === 'slots'

export const SCALE_STYLES: Record<ScaleStyle, string> = { stars: 'Estrelas', hearts: 'Corações', faces: 'Caras', numbers: 'Números' }

/* ─── Aspeto ──────────────────────────────────────────────────────────── */

export const THEME_COLORS = ['#7B61FF', '#4C7DFF', '#22A6CF', '#12B5A6', '#2E9E5B', '#E0A419', '#FF8A3D', '#F2545B', '#EC5BA6', '#8E44AD', '#2B2840', '#5D6D7E']

/** Fundos prontos (desenhados em CSS: não pesam nada) */
export const THEME_BACKGROUNDS: { id: string; name: string; css: (c: string) => string }[] = [
  { id: 'none', name: 'Branco', css: () => '#ffffff' },
  { id: 'tint', name: 'Suave', css: c => `color-mix(in srgb, ${c} 10%, #ffffff)` },
  { id: 'dots', name: 'Pontos', css: c => `radial-gradient(color-mix(in srgb, ${c} 28%, transparent) 1.5px, transparent 1.6px) 0 0/18px 18px, color-mix(in srgb, ${c} 6%, #ffffff)` },
  { id: 'grid', name: 'Quadrícula', css: c => `linear-gradient(color-mix(in srgb, ${c} 14%, transparent) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, color-mix(in srgb, ${c} 14%, transparent) 1px, transparent 1px) 0 0/24px 24px, #ffffff` },
  { id: 'waves', name: 'Ondas', css: c => `radial-gradient(120% 60% at 0% 0%, color-mix(in srgb, ${c} 30%, transparent), transparent 60%), radial-gradient(100% 60% at 100% 100%, color-mix(in srgb, ${c} 22%, transparent), transparent 60%), #ffffff` },
  { id: 'sunset', name: 'Pôr do sol', css: () => 'linear-gradient(160deg, #FFE3C7 0%, #FFD1DC 45%, #E3D7FF 100%)' },
  { id: 'ocean', name: 'Oceano', css: () => 'linear-gradient(160deg, #D7F4FF 0%, #CDE3FF 50%, #E2E0FF 100%)' },
  { id: 'forest', name: 'Floresta', css: () => 'linear-gradient(160deg, #E4F7E7 0%, #CFEFE8 50%, #F3F7D9 100%)' },
  { id: 'night', name: 'Noite', css: c => `radial-gradient(80% 50% at 80% 0%, color-mix(in srgb, ${c} 55%, transparent), transparent 70%), linear-gradient(160deg, #1E1B33, #2B2840)` },
  { id: 'confetti', name: 'Festa', css: c => `radial-gradient(circle at 12% 18%, ${c}55 0 6px, transparent 7px), radial-gradient(circle at 78% 12%, #FFC53D88 0 5px, transparent 6px), radial-gradient(circle at 88% 70%, #12B5A655 0 7px, transparent 8px), radial-gradient(circle at 22% 82%, #EC5BA655 0 5px, transparent 6px), radial-gradient(circle at 50% 45%, #4C7DFF33 0 4px, transparent 5px) 0 0/240px 240px, #FFFDF8` },
]

export const THEME_FONTS: Record<PollFont, { name: string; css: string }> = {
  sans: { name: 'Moderna', css: 'var(--app-font, var(--font-nunito)), system-ui, sans-serif' },
  round: { name: 'Arredondada', css: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Varela Round", var(--font-nunito), sans-serif' },
  serif: { name: 'Clássica', css: 'Georgia, Cambria, "Times New Roman", serif' },
  mono: { name: 'Técnica', css: 'ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace' },
  hand: { name: 'Manuscrita', css: '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive' },
}

export const defaultTheme = (type: PollType): PollTheme => ({
  color: { vote: '#4C7DFF', election: '#12B5A6', form: '#7B61FF', contest: '#EC5BA6', ideas: '#FF8A3D', schedule: '#22A6CF' }[type],
  background: 'tint',
  font: 'sans',
  size: 'normal',
  align: 'left',
})

/** Fundos escuros: o texto por cima do cartão continua no cartão branco, mas o título da página fica claro */
export const darkBackground = (t: PollTheme) => t.background === 'night' || t.background === 'image'

const HEX = /^#[0-9a-fA-F]{6}$/

export function cleanTheme(type: PollType, v: unknown): PollTheme {
  const i = (v && typeof v === 'object' ? v : {}) as Partial<PollTheme>
  const base = defaultTheme(type)
  const img = (x: unknown): PollImage | undefined => {
    const o = x as PollImage | undefined
    if (!o || typeof o.id !== 'string' || !/^pollimg-[A-Za-z0-9-]{8,100}$/.test(o.id)) return undefined
    return { id: o.id, alt: typeof o.alt === 'string' ? o.alt.slice(0, 200) : undefined }
  }
  const t: PollTheme = {
    color: typeof i.color === 'string' && HEX.test(i.color) ? i.color : base.color,
    background: typeof i.background === 'string' && (i.background === 'image' || THEME_BACKGROUNDS.some(b => b.id === i.background)) ? i.background : base.background,
    font: i.font && Object.hasOwn(THEME_FONTS, i.font) ? i.font : base.font,
    size: i.size === 'large' ? 'large' : 'normal',
    align: i.align === 'center' ? 'center' : 'left',
  }
  const header = img(i.header)
  if (header) t.header = header
  const bg = img(i.backgroundImage)
  if (bg) t.backgroundImage = bg
  if (t.background === 'image' && !t.backgroundImage) t.background = base.background
  return t
}

/** Ids de imagens que o inquérito usa (para apagar as que deixaram de ser usadas) */
export const pollImages = (p: Pick<Poll, 'fields' | 'theme'>) =>
  [p.theme?.header?.id, p.theme?.backgroundImage?.id, ...p.fields.map(f => f.image?.id)].filter((x): x is string => !!x)

export const RESULTS_TEXT: Record<ResultsWhen, string> = {
  always: 'Sempre (mesmo antes de responder)',
  answered: 'Depois de responder',
  closed: 'Só quando fechar',
  managers: 'Nunca (só quem gere)',
}

export const IDEA_STATUS = {
  new: { name: 'Nova', color: '#86829B' },
  review: { name: 'Em análise', color: '#4C7DFF' },
  approved: { name: 'Aprovada', color: '#12B5A6' },
  done: { name: 'Feita', color: '#7B61FF' },
  rejected: { name: 'Rejeitada', color: '#F2545B' },
} as const

export const pid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

const opt = (label: string, extra: Partial<PollOption> = {}): PollOption => ({ id: pid(), label, ...extra })

/* ─── Definições por tipo ─────────────────────────────────────────────── */

export function defaultSettings(type: PollType): PollSettings {
  const base: PollSettings = { anonymous: false, results: 'answered', publicLink: false, onePerPerson: true, canChange: true, notify: false }
  switch (type) {
    case 'election': return { ...base, anonymous: true, results: 'closed', canChange: false }
    // como nos formulários do Bitrix: qualquer pessoa com o link preenche, mesmo sem conta
    case 'form': return { ...base, results: 'managers', canChange: false, notify: true, publicLink: true }
    case 'contest': return { ...base, results: 'closed', canChange: false, phase: 'submit', votesPerPerson: 1 }
    case 'ideas': return { ...base, results: 'always', votesPerPerson: 0 }
    case 'schedule': return { ...base, results: 'always' }
    default: return base
  }
}

/** Próximos dias úteis às horas dadas, para o exemplo de "Agendar" */
function nextSlots(hours: string[], days = 3) {
  const out: PollOption[] = []
  const d = new Date()
  while (out.length < days * hours.length) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    for (const h of hours) out.push(opt('', { at: `${day}T${h}` }))
  }
  return out
}

/** Campos com que um inquérito novo começa (sample: o exemplo preenchido) */
export function starter(type: PollType, sample: boolean): { title: string; description?: string; fields: PollField[] } {
  const f = (kind: FieldKind, title: string, extra: Partial<PollField> = {}): PollField => ({ id: pid(), kind, title, ...extra })
  const title = sample ? TYPE_INFO[type].example : ''
  switch (type) {
    case 'vote':
      return {
        title,
        fields: [f('single', sample ? TYPE_INFO.vote.example : '', {
          required: true,
          options: sample ? ['Restaurante na baixa', 'Jantar no escritório', 'Churrasco ao ar livre'].map(l => opt(l)) : [opt('Opção 1'), opt('Opção 2')],
        })],
      }
    case 'election':
      return {
        title,
        description: sample ? 'Vota num candidato para cada cargo. O voto é secreto e não pode ser alterado.' : undefined,
        fields: sample
          ? [
              f('single', 'Representante', { required: true, blank: true, options: [opt('Candidato A'), opt('Candidato B')] }),
              f('single', 'Suplente', { required: true, blank: true, options: [opt('Candidato C'), opt('Candidato D')] }),
            ]
          : [f('single', 'Cargo', { required: true, blank: true, options: [] })],
      }
    case 'form':
      if (!sample) return { title, fields: [f('short', 'Pergunta sem título')] }
      {
        const yes = opt('Sim'); const no = opt('Não')
        const recommend = f('single', 'Recomendarias a empresa a um amigo?', { required: true, options: [yes, opt('Talvez'), no] })
        return {
          title,
          description: 'Leva **2 minutos**. As respostas ajudam-nos a melhorar o dia-a-dia de todos.',
          fields: [
            f('scale', 'Quão satisfeito estás com o teu trabalho?', { required: true, max: 5, style: 'stars' }),
            recommend,
            f('long', 'Porque não?', { help: 'Conta-nos o que te faria mudar de ideias.', showIf: { fieldId: recommend.id, optionId: no.id } }),
            f('section', 'A equipa', { help: 'Agora sobre o dia-a-dia com os colegas.' }),
            f('likert', 'Quanto concordas?', {
              options: ['Discordo', 'Neutro', 'Concordo'].map(l => opt(l)),
              rows: ['Sinto-me ouvido', 'A comunicação é clara', 'Tenho as ferramentas de que preciso'].map(l => opt(l)),
            }),
            f('ranking', 'Ordena o que mais valorizas', { options: ['Entreajuda', 'Flexibilidade', 'Formação', 'Ambiente'].map(l => opt(l)), shuffle: true }),
            f('long', 'O que podemos melhorar?'),
          ],
        }
      }
    case 'contest':
      return {
        title,
        description: sample ? 'Envia a tua melhor foto do escritório. Depois todos votam na preferida!' : undefined,
        fields: [f('file', sample ? 'Fotografia' : 'Ficheiro', { required: true }), f('long', 'Descrição')],
      }
    case 'ideas':
      return { title, description: sample ? 'Propõe ideias e vota nas que mais gostas. As melhores passam para a próxima reunião.' : undefined, fields: [] }
    case 'schedule':
      return {
        title,
        description: sample ? 'Marca todas as horas em que podes. "Talvez" também ajuda.' : undefined,
        fields: [f('slots', 'Datas propostas', { required: true, options: sample ? nextSlots(['10:00', '15:00']) : [] })],
      }
  }
}

/* ─── Validar o que o dono desenha ────────────────────────────────────── */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function cleanOptions(v: unknown, kind: FieldKind): PollOption[] {
  // likert: as linhas (afirmações) usam a mesma limpeza das opções
  const list = Array.isArray(v) ? v : []
  if (list.length > (kind === 'slots' ? POLL_LIMITS.slots : POLL_LIMITS.options)) bad(kind === 'slots' ? `No máximo ${POLL_LIMITS.slots} datas` : `No máximo ${POLL_LIMITS.options} opções por pergunta`)
  const ids = new Set<string>()
  const out: PollOption[] = []
  for (const raw of list as Partial<PollOption>[]) {
    const id = str(raw?.id, 40) || pid()
    if (ids.has(id) || id === 'other' || id === 'blank') continue
    ids.add(id)
    const o: PollOption = { id, label: str(raw?.label, POLL_LIMITS.option) }
    if (kind === 'slots') {
      const at = str(raw?.at, 16)
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) bad('Há uma data proposta incompleta')
      o.at = at
    } else if (!o.label) bad('Há opções sem texto')
    if (raw?.userId) o.userId = str(raw.userId, 80)
    out.push(o)
  }
  return out
}

const KINDS = Object.keys(KIND_INFO) as FieldKind[]

/** Os campos que cada tipo aceita */
function allowedKinds(type: PollType): FieldKind[] {
  if (type === 'vote') return ['single', 'multi']
  if (type === 'election') return ['single']
  if (type === 'schedule') return ['slots']
  if (type === 'ideas') return []
  return [...FORM_KINDS, ...CONTENT_KINDS]
}

export function cleanFields(type: PollType, input: unknown): PollField[] {
  const list = Array.isArray(input) ? input : []
  const max = type === 'election' ? POLL_LIMITS.positions : POLL_LIMITS.fields
  if (list.length > max) bad(type === 'election' ? `No máximo ${max} cargos` : `No máximo ${max} perguntas`)
  const allowed = allowedKinds(type)
  const out: PollField[] = []
  const ids = new Set<string>()
  for (const raw of list as Partial<PollField>[]) {
    const kind = KINDS.includes(raw?.kind as FieldKind) ? (raw!.kind as FieldKind) : bad('Tipo de pergunta inválido')
    if (!allowed.includes(kind)) bad(`"${KIND_INFO[kind].name}" não serve para ${TYPE_INFO[type].name.toLowerCase()}`)
    let id = str(raw?.id, 40) || pid()
    if (ids.has(id)) id = pid()
    ids.add(id)
    const field: PollField = { id, kind, title: str(raw?.title, POLL_LIMITS.fieldTitle) }
    const help = str(raw?.help, POLL_LIMITS.help)
    if (help) field.help = help
    if (raw?.required) field.required = true
    if (hasOptions(kind)) field.options = cleanOptions(raw?.options, kind)
    if (kind === 'likert') field.rows = cleanOptions(raw?.rows, kind)
    if (kind === 'multi') field.max = Math.max(0, Math.min(field.options!.length, Math.round(Number(raw?.max) || 0)))
    if (kind === 'scale') {
      field.max = Number(raw?.max) === 10 ? 10 : 5
      field.style = raw?.style && Object.hasOwn(SCALE_STYLES, raw.style) ? raw.style : 'stars'
      if (field.style === 'faces') field.max = 5
    }
    if ((KIND_INFO[kind].choice || kind === 'ranking') && raw?.shuffle && type !== 'election') field.shuffle = true
    if (raw?.image && typeof raw.image.id === 'string' && /^pollimg-[A-Za-z0-9-]{8,100}$/.test(raw.image.id)) {
      field.image = { id: raw.image.id, alt: typeof raw.image.alt === 'string' ? raw.image.alt.slice(0, 200) : undefined }
    }
    if (KIND_INFO[kind].content) delete field.required
    if (kind === 'image' && !field.image) bad('Há um bloco de imagem sem imagem')
    if ((kind === 'single' || kind === 'multi') && raw?.other && type !== 'election') field.other = true
    if (type === 'election') {
      field.required = true
      if (raw?.blank !== false) field.blank = true
    }
    if (raw?.showIf && type === 'form') {
      const src = out.find(f => f.id === raw.showIf!.fieldId)
      if (src?.options?.some(o => o.id === raw.showIf!.optionId)) field.showIf = { fieldId: src.id, optionId: raw.showIf.optionId }
    }
    out.push(field)
  }
  return out
}

/** Antes de abrir: o que falta para o inquérito fazer sentido */
export function readyProblem(type: PollType, fields: PollField[]): string | null {
  if (type === 'ideas') return null
  if (!fields.length) return type === 'election' ? 'Junta pelo menos um cargo' : 'Junta pelo menos uma pergunta'
  if (!fields.some(f => !isContent(f))) return 'Junta pelo menos uma pergunta'
  for (const [i, f] of fields.entries()) {
    if (isContent(f)) continue
    const name = f.title || `a pergunta ${i + 1}`
    if (f.kind === 'likert' && (f.rows?.length ?? 0) < 1) return `"${name}" precisa de pelo menos uma afirmação`
    if ((f.kind === 'ranking' || f.kind === 'likert') && (f.options?.length ?? 0) < 2) return `"${name}" precisa de pelo menos 2 opções`
    if (!f.title && type !== 'schedule') return type === 'election' ? `Dá um nome ao cargo ${i + 1}` : `Escreve o texto da pergunta ${i + 1}`
    if (f.kind === 'slots' && (f.options?.length ?? 0) < 1) return 'Propõe pelo menos uma data'
    if (KIND_INFO[f.kind].choice && (f.options?.length ?? 0) < (type === 'election' ? 1 : 2)) {
      return type === 'election' ? `Junta pelo menos um candidato a "${name}"` : `"${name}" precisa de pelo menos 2 opções`
    }
  }
  return null
}

export function cleanSettings(type: PollType, input: Partial<PollSettings> | undefined, prev: PollSettings): PollSettings {
  const s: PollSettings = { ...prev }
  const i = input ?? {}
  if (i.anonymous !== undefined) s.anonymous = !!i.anonymous
  if (i.results !== undefined && Object.hasOwn(RESULTS_TEXT, i.results)) s.results = i.results
  if (i.publicLink !== undefined) s.publicLink = !!i.publicLink
  if (i.onePerPerson !== undefined) s.onePerPerson = !!i.onePerPerson
  if (i.canChange !== undefined) s.canChange = !!i.canChange
  if (i.notify !== undefined) s.notify = !!i.notify
  if (i.closesAt !== undefined) s.closesAt = i.closesAt && Number.isFinite(Number(i.closesAt)) ? Math.round(Number(i.closesAt)) : undefined
  if (i.maxResponses !== undefined) {
    const n = Math.round(Number(i.maxResponses) || 0)
    s.maxResponses = n > 0 ? Math.min(n, 100_000) : undefined
  }
  if (i.thanks !== undefined) s.thanks = str(i.thanks, POLL_LIMITS.thanks) || undefined
  if (i.votesPerPerson !== undefined) s.votesPerPerson = Math.max(0, Math.min(50, Math.round(Number(i.votesPerPerson) || 0)))
  if (i.phase !== undefined && type === 'contest') s.phase = i.phase === 'vote' ? 'vote' : 'submit'
  if (i.jury !== undefined && type === 'contest') s.jury = Array.isArray(i.jury) ? [...new Set(i.jury.map(x => str(x, 80)).filter(Boolean))].slice(0, 30) : undefined
  if (s.jury && !s.jury.length) s.jury = undefined
  // regras fixas de cada tipo
  if (type === 'election') Object.assign(s, { anonymous: true, publicLink: false, onePerPerson: true, canChange: false })
  if (type === 'contest' || type === 'ideas') Object.assign(s, { onePerPerson: true, canChange: false, publicLink: false })
  if (type === 'contest') s.phase ??= 'submit'
  if (s.publicLink && type === 'contest') s.publicLink = false
  return s
}

/* ─── Respostas ───────────────────────────────────────────────────────── */

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/** Os campos que aparecem, dadas as respostas (lógica condicional) */
export function visibleFields(fields: PollField[], answers: Record<string, AnswerValue | undefined>): PollField[] {
  const shown = new Set<string>()
  const out: PollField[] = []
  // uma secção escondida esconde tudo até à secção seguinte (é a ramificação do Microsoft Forms)
  let sectionHidden = false
  for (const f of fields) {
    if (f.kind === 'section') sectionHidden = false
    else if (sectionHidden) continue
    if (f.showIf) {
      const a = answers[f.showIf.fieldId]
      const chosen = shown.has(f.showIf.fieldId) && (Array.isArray(a) ? a.includes(f.showIf.optionId) : a === f.showIf.optionId)
      if (!chosen) {
        if (f.kind === 'section') sectionHidden = true
        continue
      }
    }
    shown.add(f.id)
    out.push(f)
  }
  return out
}

type FormPage = { section?: PollField; fields: PollField[] }

/** Divide os campos visíveis em páginas (uma por secção) */
export function pagesOf(visible: PollField[]): FormPage[] {
  const pages: FormPage[] = [{ fields: [] }]
  for (const f of visible) {
    if (f.kind === 'section') {
      if (pages.length === 1 && !pages[0].fields.length && !pages[0].section) pages[0].section = f
      else pages.push({ section: f, fields: [] })
    } else pages[pages.length - 1].fields.push(f)
  }
  return pages.filter(p => p.section || p.fields.length)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[+()\d\s.-]{6,25}$/

/**
 * Valida as respostas. Os ficheiros já enviados chegam em "files" (campo → ficheiro);
 * nunca se aceita um ficheiro escrito à mão nas respostas.
 */
export function cleanAnswers(
  poll: Pick<Poll, 'fields'>,
  input: { answers?: Record<string, unknown>; other?: Record<string, unknown> },
  files: Record<string, PollFile> = {},
): { answers: Record<string, AnswerValue>; other?: Record<string, string> } {
  const raw = (input.answers && typeof input.answers === 'object' ? input.answers : {}) as Record<string, unknown>
  const rawOther = (input.other && typeof input.other === 'object' ? input.other : {}) as Record<string, unknown>
  const merged = { ...raw, ...files } as Record<string, AnswerValue>
  const answers: Record<string, AnswerValue> = {}
  const other: Record<string, string> = {}
  for (const f of visibleFields(poll.fields, merged)) {
    if (isContent(f)) continue
    const v = f.kind === 'file' ? files[f.id] : raw[f.id]
    const name = f.title || 'uma pergunta'
    if (isEmpty(v) || (f.kind === 'yesno' && typeof v !== 'boolean')) {
      if (f.required) bad(f.kind === 'slots' ? 'Diz em que datas podes' : `Responde a "${name}"`)
      continue
    }
    const ids = new Set((f.options ?? []).map(o => o.id))
    const takeOther = () => {
      const t = str(rawOther[f.id], POLL_LIMITS.other)
      if (!t) bad(`Escreve a tua resposta em "Outra" (${name})`)
      other[f.id] = t
    }
    switch (f.kind) {
      case 'short': case 'long': {
        const t = typeof v === 'string' ? v.trim() : ''
        if (!t) { if (f.required) bad(`Responde a "${name}"`); continue }
        if (t.length > POLL_LIMITS[f.kind]) bad(`A resposta a "${name}" é demasiado longa`)
        answers[f.id] = t
        break
      }
      case 'email': {
        const t = typeof v === 'string' ? v.trim().toLowerCase() : ''
        if (!EMAIL.test(t) || t.length > 200) bad(`Email inválido em "${name}"`)
        answers[f.id] = t
        break
      }
      case 'phone': {
        const t = typeof v === 'string' ? v.trim() : ''
        if (!PHONE.test(t)) bad(`Telefone inválido em "${name}"`)
        answers[f.id] = t
        break
      }
      case 'number': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n) || Math.abs(n) > 1e12) bad(`Escreve um número em "${name}"`)
        answers[f.id] = n
        break
      }
      case 'date': {
        const t = String(v)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) bad(`Data inválida em "${name}"`)
        answers[f.id] = t
        break
      }
      case 'single': case 'dropdown': {
        const t = String(v)
        if (t === 'other' && f.other) takeOther()
        else if (t === 'blank' && f.blank) { /* voto em branco */ }
        else if (!ids.has(t)) bad(`Escolhe uma opção em "${name}"`)
        answers[f.id] = t
        break
      }
      case 'multi': {
        if (!Array.isArray(v)) bad(`Escolhe opções em "${name}"`)
        const list = [...new Set((v as unknown[]).map(String))]
        for (const t of list) if (!ids.has(t) && !(t === 'other' && f.other)) bad(`Opção inválida em "${name}"`)
        if (f.max && list.length > f.max) bad(`Em "${name}" escolhe no máximo ${f.max}`)
        if (list.includes('other')) takeOther()
        answers[f.id] = list
        break
      }
      case 'scale': {
        const n = Number(v)
        if (!Number.isInteger(n) || n < 1 || n > (f.max ?? 5)) bad(`Escolhe um valor em "${name}"`)
        answers[f.id] = n
        break
      }
      case 'yesno':
        answers[f.id] = !!v
        break
      case 'file':
        answers[f.id] = v as PollFile
        break
      case 'time': {
        const t = String(v)
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) bad(`Hora inválida em "${name}"`)
        answers[f.id] = t
        break
      }
      case 'nps': {
        const n = Number(v)
        if (!Number.isInteger(n) || n < 0 || n > 10) bad(`Escolhe de 0 a 10 em "${name}"`)
        answers[f.id] = n
        break
      }
      case 'ranking': {
        // a ordem inteira: cada opção uma vez
        const list = Array.isArray(v) ? (v as unknown[]).map(String) : []
        if (list.length !== ids.size || new Set(list).size !== list.length || list.some(x => !ids.has(x))) bad(`Ordena todas as opções em "${name}"`)
        answers[f.id] = list
        break
      }
      case 'likert': {
        if (typeof v !== 'object' || Array.isArray(v)) bad(`Resposta inválida em "${name}"`)
        const rows = new Set((f.rows ?? []).map(r => r.id))
        const out: Record<string, string> = {}
        for (const [k, a] of Object.entries(v as Record<string, unknown>)) if (rows.has(k) && ids.has(String(a))) out[k] = String(a)
        if (f.required && Object.keys(out).length < rows.size) bad(`Responde a todas as linhas de "${name}"`)
        if (!Object.keys(out).length) continue
        answers[f.id] = out
        break
      }
      case 'slots': {
        if (typeof v !== 'object' || Array.isArray(v)) bad('Resposta inválida às datas')
        const out: Record<string, SlotAnswer> = {}
        for (const [k, a] of Object.entries(v as Record<string, unknown>)) {
          if (ids.has(k) && (a === 'yes' || a === 'maybe' || a === 'no')) out[k] = a
        }
        if (!Object.keys(out).length) { if (f.required) bad('Diz em que datas podes'); continue }
        answers[f.id] = out
        break
      }
    }
  }
  return { answers, other: Object.keys(other).length ? other : undefined }
}

/* ─── Estado ──────────────────────────────────────────────────────────── */

/** Fechado à mão, pela data ou pelo número máximo de respostas */
export function isClosed(poll: Pick<Poll, 'status' | 'settings' | 'count'>, now = Date.now()) {
  if (poll.status === 'closed') return true
  if (poll.status !== 'open') return false
  if (poll.settings.closesAt && poll.settings.closesAt <= now) return true
  return !!poll.settings.maxResponses && poll.count >= poll.settings.maxResponses
}

type PollPhase = 'draft' | 'open' | 'closed'
export const phaseOf = (poll: Pick<Poll, 'status' | 'settings' | 'count'>, now = Date.now()): PollPhase =>
  poll.status === 'draft' ? 'draft' : isClosed(poll, now) ? 'closed' : 'open'

/**
 * Quem não tem conta tem de entrar para responder? Só nas votações e datas com "uma resposta por
 * pessoa" (sem conta não dá para impedir votos repetidos). Os formulários aceitam sempre visitantes:
 * a regra de uma resposta por pessoa vale para quem tem conta.
 */
export const guestsNeedLogin = (poll: Pick<Poll, 'type' | 'settings'>) => poll.settings.onePerPerson && poll.type !== 'form'

/** Os participantes vêem os resultados? (quem gere vê sempre) */
export function resultsVisible(poll: Pick<Poll, 'status' | 'settings' | 'count'>, answered: boolean, now = Date.now()) {
  const r = poll.settings.results
  if (r === 'managers') return false
  if (r === 'always') return true
  if (r === 'closed') return isClosed(poll, now)
  return answered || isClosed(poll, now)
}

/* ─── Resultados ──────────────────────────────────────────────────────── */

const MAX_TEXTS = 300

function winners(counts: Record<string, number>, exclude: string[] = []) {
  let best = 0
  for (const [k, n] of Object.entries(counts)) if (!exclude.includes(k) && n > best) best = n
  return best ? Object.keys(counts).filter(k => !exclude.includes(k) && counts[k] === best) : []
}

export function summarize(poll: Pick<Poll, 'fields'>, responses: Pick<PollResponse, 'id' | 'kind' | 'answers' | 'other' | 'createdAt'>[]): PollResults {
  const answers = responses.filter(r => r.kind === 'answer').sort((a, z) => z.createdAt - a.createdAt)
  const fields: FieldResult[] = poll.fields.filter(f => !isContent(f)).map(f => {
    const res: FieldResult = { fieldId: f.id, answered: 0 }
    const nums: number[] = []
    for (const r of answers) {
      const v = r.answers[f.id]
      if (v === undefined) continue
      res.answered++
      if (KIND_INFO[f.kind].choice) {
        res.counts ??= Object.fromEntries([...(f.options ?? []).map(o => o.id), ...(f.other ? ['other'] : []), ...(f.blank ? ['blank'] : [])].map(k => [k, 0]))
        for (const k of Array.isArray(v) ? v : [String(v)]) if (k in res.counts) res.counts[k]++
        const o = r.other?.[f.id]
        if (o && (res.others ??= []).length < MAX_TEXTS) res.others.push(o)
      } else if (f.kind === 'yesno') {
        res.counts ??= { yes: 0, no: 0 }
        res.counts[v ? 'yes' : 'no']++
      } else if (f.kind === 'scale' || f.kind === 'number') {
        nums.push(Number(v))
        if (f.kind === 'scale') {
          res.counts ??= Object.fromEntries(Array.from({ length: f.max ?? 5 }, (_, i) => [String(i + 1), 0]))
          res.counts[String(v)] = (res.counts[String(v)] ?? 0) + 1
        }
      } else if (f.kind === 'nps') {
        nums.push(Number(v))
        res.counts ??= Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i), 0]))
        res.counts[String(v)]++
      } else if (f.kind === 'ranking') {
        // soma das posições; no fim divide-se pelas respostas
        res.ranks ??= Object.fromEntries((f.options ?? []).map(o => [o.id, 0]))
        ;(v as string[]).forEach((k, i) => { if (k in res.ranks!) res.ranks![k] += i + 1 })
      } else if (f.kind === 'likert') {
        res.grid ??= Object.fromEntries((f.rows ?? []).map(row => [row.id, Object.fromEntries((f.options ?? []).map(o => [o.id, 0]))]))
        for (const [row, o] of Object.entries(v as Record<string, string>)) if (res.grid[row] && o in res.grid[row]) res.grid[row][o]++
      } else if (f.kind === 'slots') {
        res.slots ??= Object.fromEntries((f.options ?? []).map(o => [o.id, { yes: 0, maybe: 0, no: 0 }]))
        for (const [k, a] of Object.entries(v as Record<string, SlotAnswer>)) if (res.slots[k]) res.slots[k][a]++
      } else if (f.kind === 'file') {
        if ((res.files ??= []).length < MAX_TEXTS) res.files.push({ ...(v as PollFile), responseId: r.id })
      } else if ((res.texts ??= []).length < MAX_TEXTS) res.texts.push(String(v))
    }
    if (nums.length) {
      res.avg = Math.round((nums.reduce((a, n) => a + n, 0) / nums.length) * 100) / 100
      res.min = Math.min(...nums)
      res.max = Math.max(...nums)
    }
    if (res.counts && KIND_INFO[f.kind].choice) res.winner = winners(res.counts, ['blank', 'other'])
    if (f.kind === 'nps' && nums.length) {
      const promoters = nums.filter(n => n >= 9).length
      const detractors = nums.filter(n => n <= 6).length
      res.nps = { score: Math.round(((promoters - detractors) / nums.length) * 100), promoters, passives: nums.length - promoters - detractors, detractors }
    }
    if (res.ranks && res.answered) {
      for (const k of Object.keys(res.ranks)) res.ranks[k] = Math.round((res.ranks[k] / res.answered) * 10) / 10
      // a melhor é a de posição média mais baixa
      const best = Math.min(...Object.values(res.ranks))
      res.winner = Object.keys(res.ranks).filter(k => res.ranks![k] === best)
    }
    if (res.slots) {
      // "sim" vale 1 e "talvez" meio ponto
      const score = Object.fromEntries(Object.entries(res.slots).map(([k, s]) => [k, s.yes * 2 + s.maybe]))
      res.winner = winners(score)
    }
    return res
  })
  return { total: answers.length, fields }
}

/** Pontuação de uma ideia ou candidatura: votos, ou a média das notas do júri */
export function entryScore(votes: Record<string, number> | undefined, jury: boolean) {
  const list = Object.values(votes ?? {})
  if (!jury) return { score: list.length, votes: list.length }
  if (!list.length) return { score: 0, votes: 0 }
  return { score: Math.round((list.reduce((a, n) => a + n, 0) / list.length) * 10) / 10, votes: list.length }
}

/* ─── Exportar ────────────────────────────────────────────────────────── */

/** Texto de uma resposta para tabelas (CSV e planilha) */
export function answerText(f: PollField, v: AnswerValue | undefined, other?: string): string {
  if (v === undefined) return ''
  const label = (id: string) => (id === 'other' ? `Outra: ${other ?? ''}` : id === 'blank' ? 'Em branco' : f.options?.find(o => o.id === id)?.label ?? '')
  if (KIND_INFO[f.kind].choice) return (Array.isArray(v) ? v : [String(v)]).map(label).join('; ')
  if (f.kind === 'yesno') return v ? 'Sim' : 'Não'
  if (f.kind === 'file') return (v as PollFile).name
  if (f.kind === 'ranking') return (v as string[]).map((id, i) => `${i + 1}. ${label(id)}`).join('; ')
  if (f.kind === 'likert') return Object.entries(v as Record<string, string>).map(([row, o]) => `${f.rows?.find(r => r.id === row)?.label ?? ''}: ${label(o)}`).join('; ')
  if (f.kind === 'slots') {
    const word = { yes: 'Sim', maybe: 'Talvez', no: 'Não' }
    return Object.entries(v as Record<string, SlotAnswer>).map(([k, a]) => `${slotLabel(f.options?.find(o => o.id === k))}: ${word[a]}`).join('; ')
  }
  return String(v)
}

export function slotLabel(o: PollOption | undefined) {
  if (!o?.at) return o?.label ?? ''
  const d = new Date(`${o.at}:00`)
  const text = new Intl.DateTimeFormat('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
  return o.label ? `${text} (${o.label})` : text
}

/** Tabela das respostas: cabeçalho + uma linha por resposta */
export function responseTable(
  poll: Pick<Poll, 'fields'>,
  rows: { name?: string; createdAt: number; answers: Record<string, AnswerValue>; other?: Record<string, string> }[],
  withName: boolean,
): string[][] {
  const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
  const questions = poll.fields.filter(f => !isContent(f))
  const head = ['Data', ...(withName ? ['Nome'] : []), ...questions.map((f, i) => f.title || `Pergunta ${i + 1}`)]
  return [
    head,
    ...rows.map(r => [fmt.format(r.createdAt), ...(withName ? [r.name ?? ''] : []), ...questions.map(f => answerText(f, r.answers[f.id], r.other?.[f.id]))]),
  ]
}

export function toCsv(table: string[][]) {
  const cell = (s: string) => {
    // evita que o Excel corra fórmulas escritas nas respostas
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return '﻿' + table.map(r => r.map(cell).join(';')).join('\r\n')
}
