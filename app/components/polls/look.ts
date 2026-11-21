import {
  BankIcon, CalendarBlankIcon, CalendarCheckIcon, CalendarDotsIcon, CaretCircleDownIcon, CheckSquareIcon, ClipboardTextIcon, EnvelopeSimpleIcon,
  ClockIcon, GaugeIcon, GridFourIcon, HashIcon, ImageIcon, LightbulbIcon, ListNumbersIcon, RowsIcon, TextAaIcon, MedalIcon, PaperclipIcon, PhoneIcon, RadioButtonIcon, StarIcon, TextAlignLeftIcon, TextTIcon, ToggleLeftIcon, type Icon,
} from '@phosphor-icons/react'
import type { FieldKind, PollType } from '../../types'

/** Aspecto de cada tipo de inquérito (cartões, lista e cabeçalho) */
export const TYPE_LOOK: Record<PollType, { icon: Icon; color: string; light: string }> = {
  vote: { icon: CheckSquareIcon, color: '#4C7DFF', light: '#E6EDFF' },
  election: { icon: BankIcon, color: '#12B5A6', light: '#DCF7F3' },
  form: { icon: ClipboardTextIcon, color: '#7B61FF', light: '#EEEAFF' },
  contest: { icon: MedalIcon, color: '#EC5BA6', light: '#FCE6F2' },
  ideas: { icon: LightbulbIcon, color: '#FF8A3D', light: '#FFEDE0' },
  schedule: { icon: CalendarCheckIcon, color: '#22A6CF', light: '#E0F4FA' },
}

export const KIND_ICON: Record<FieldKind, Icon> = {
  short: TextTIcon,
  long: TextAlignLeftIcon,
  email: EnvelopeSimpleIcon,
  phone: PhoneIcon,
  number: HashIcon,
  date: CalendarBlankIcon,
  single: RadioButtonIcon,
  multi: CheckSquareIcon,
  dropdown: CaretCircleDownIcon,
  scale: StarIcon,
  yesno: ToggleLeftIcon,
  file: PaperclipIcon,
  slots: CalendarDotsIcon,
  time: ClockIcon,
  nps: GaugeIcon,
  ranking: ListNumbersIcon,
  likert: GridFourIcon,
  section: RowsIcon,
  text: TextAaIcon,
  image: ImageIcon,
}

/** Imagens do aspeto (servidas a qualquer pessoa que tenha o link do inquérito) */
export const imageUrl = (pollId: string, imageId: string) => `/api/proxy/inqueritos/${pollId}/imagens?f=${encodeURIComponent(imageId)}`

/** Cores das barras dos resultados, por ordem das opções */
export const BAR_COLORS = ['#7B61FF', '#12B5A6', '#FF8A3D', '#4C7DFF', '#EC5BA6', '#E0A419', '#22A6CF', '#F2545B']

export const fileUrl = (pollId: string, fileId: string, view = false) => `/api/proxy/inqueritos/${pollId}/ficheiros?f=${encodeURIComponent(fileId)}${view ? '&ver' : ''}`

export const ago = (t: number) => {
  const d = Math.round((Date.now() - t) / 60000)
  if (d < 1) return 'agora mesmo'
  if (d < 60) return `há ${d} min`
  if (d < 1440) return `há ${Math.round(d / 60)} h`
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(t)
}

/** "fecha dentro de 2 dias", "fecha hoje às 18:00" */
export function closesText(at: number) {
  const ms = at - Date.now()
  if (ms <= 0) return 'Fechado'
  const time = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' }).format(at)
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return new Date(at).getDate() === new Date().getDate() ? `Fecha hoje às ${time}` : `Fecha amanhã às ${time}`
  if (days < 7) return `Fecha dentro de ${days + 1} dias`
  return `Fecha a ${new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(at)}`
}
