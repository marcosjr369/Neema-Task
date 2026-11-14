import {
  CalculatorIcon, CardsThreeIcon, GridFourIcon, HashIcon, PaletteIcon, TextAaIcon, WindIcon, XCircleIcon, type Icon,
} from '@phosphor-icons/react'
import type { GameId, GameStats } from '../../types'
import { GAME_RULES, formatScore } from '../../lib/games'

export type GameGroup = 'classicos' | 'rapidos'

export const GROUPS: { id: GameGroup; title: string; text: string }[] = [
  { id: 'classicos', title: 'Clássicos', text: 'Jogos de sempre, sem pressa.' },
  { id: 'rapidos', title: 'Pausas rápidas', text: 'Um a três minutos para relaxar ou acordar o cérebro.' },
]

/** Como cada jogo aparece (nome, cor) e como ajuda a descontrair, por etapas */
export type GameMeta = {
  id: GameId
  group: GameGroup
  title: string
  /** o que treina, numa palavra */
  tag: string
  summary: string
  /** regras em uma ou duas frases */
  howTo: string
  minutes: string
  icon: Icon
  color: string
  light: string
  /** como este tipo de jogo ajuda a descontrair (3 etapas) */
  relax: { title: string; text: string }[]
}

export const GAMES: GameMeta[] = [
  {
    id: 'respirar', group: 'rapidos', title: 'Respirar', tag: 'Respiração', minutes: '1–3 min',
    icon: WindIcon, color: '#12B5A6', light: '#DCF7F3',
    summary: 'Respiração guiada para baixar o ritmo.',
    howTo: 'Inspira quando o círculo cresce, segura quando pára e expira devagar quando encolhe.',
    relax: [
      { title: 'Abranda o corpo', text: 'Expirar mais devagar do que inspiras ajuda o coração a abrandar e os ombros a descer.' },
      { title: 'Uma coisa de cada vez', text: 'Seguir o círculo e contar ocupa a cabeça com uma só tarefa: os pensamentos do trabalho ficam em pausa.' },
      { title: 'Volta mais leve', text: 'Um a três minutos chegam para baixar a tensão e voltar ao trabalho com a cabeça mais limpa.' },
    ],
  },
  {
    id: 'galo', group: 'classicos', title: 'Jogo do Galo', tag: 'Estratégia', minutes: '1 min',
    icon: XCircleIcon, color: '#7B61FF', light: '#EEEAFF',
    summary: 'Três em linha contra a Udacha.',
    howTo: 'Tu és o X. Faz uma linha de três (na horizontal, vertical ou diagonal) antes da Udacha.',
    relax: [
      { title: 'Regras que já sabes', text: 'Não há nada para aprender: começas logo e a cabeça descansa do esforço de pensar em coisas novas.' },
      { title: 'Pensar uma jogada à frente', text: 'Planear com calma, sem relógio, é um exercício leve e satisfatório.' },
      { title: 'Rondas de segundos', text: 'Cada ronda é curta: jogas duas ou três e voltas ao trabalho quando quiseres.' },
    ],
  },
  {
    id: 'forca', group: 'classicos', title: 'Forca', tag: 'Palavras', minutes: '2 min',
    icon: TextAaIcon, color: '#FF8A3D', light: '#FFEDE0',
    summary: 'Adivinha a palavra letra a letra.',
    howTo: 'Escolhe letras para descobrir a palavra. Tens a categoria como pista e podes errar 6 vezes.',
    relax: [
      { title: 'Muda o tipo de pensamento', text: 'Depois de números e tarefas, brincar com palavras usa outra parte da cabeça e a parte cansada descansa.' },
      { title: 'Curiosidade sem pressão', text: 'Descobrir a palavra aos poucos entretém sem stress: não há relógio.' },
      { title: 'O momento do "já sei!"', text: 'Quando a palavra aparece, há uma pequena satisfação que melhora o humor.' },
    ],
  },
  {
    id: 'sudoku', group: 'classicos', title: 'Sudoku', tag: 'Lógica', minutes: '5–15 min',
    icon: HashIcon, color: '#4C7DFF', light: '#E6EDFF',
    summary: 'Preenche a grelha com 1 a 9.',
    howTo: 'Cada linha, coluna e quadrado de 3×3 tem os números de 1 a 9, sem repetir.',
    relax: [
      { title: 'Ordem e controlo', text: 'Preencher a grelha passo a passo dá uma sensação de arrumação que acalma.' },
      { title: 'Ao teu ritmo', text: 'Não há pressa: o tempo só conta para o recorde. Podes pensar devagar.' },
      { title: 'Ficar absorvido', text: 'Um problema com regras claras prende a atenção por inteiro: é uma das melhores maneiras de desligar.' },
    ],
  },
  {
    id: 'deslizar', group: 'classicos', title: 'Deslizar', tag: 'Espacial', minutes: '3–5 min',
    icon: GridFourIcon, color: '#EC5BA6', light: '#FCE6F2',
    summary: 'Arruma os números de 1 a 15.',
    howTo: 'Toca numa peça ao lado do espaço vazio para a deslizar. Põe tudo por ordem, de 1 a 15.',
    relax: [
      { title: 'Mãos ocupadas, cabeça calma', text: 'Mover peças tem algo de arrumar uma gaveta: repetitivo no bom sentido.' },
      { title: 'Pensar no espaço', text: 'Planear por onde passam as peças treina um raciocínio diferente do das tarefas.' },
      { title: 'Progresso à vista', text: 'Cada fila arrumada é um avanço que se vê, e isso motiva sem cansar.' },
    ],
  },
  {
    id: 'pares', group: 'rapidos', title: 'Pares', tag: 'Memória', minutes: '2 min',
    icon: CardsThreeIcon, color: '#7B61FF', light: '#EEEAFF',
    summary: 'Encontra os pares com o menor número de jogadas.',
    howTo: 'Vira duas cartas de cada vez. Se forem iguais ficam viradas; se não, lembra-te de onde estavam.',
    relax: [
      { title: 'Muda de canal', text: 'Passas de tarefas pesadas para imagens simples: mudar o tipo de esforço também é descansar.' },
      { title: 'Memória a curto prazo', text: 'Lembrar onde está cada carta treina o mesmo "músculo" que usas para não perder o fio a uma tarefa.' },
      { title: 'Pequenas vitórias', text: 'Cada par encontrado dá uma dose rápida de satisfação.' },
    ],
  },
  {
    id: 'contas', group: 'rapidos', title: 'Contas rápidas', tag: 'Cálculo', minutes: '1 min',
    icon: CalculatorIcon, color: '#FF8A3D', light: '#FFEDE0',
    summary: 'Quantas contas acertas num minuto?',
    howTo: 'Escolhe a resposta certa de cada conta. A cada 4 certas seguidas, ficam mais difíceis.',
    relax: [
      { title: 'Acorda a cabeça', text: 'Contas simples e rápidas aquecem o raciocínio quando a cabeça está "pesada".' },
      { title: 'Um minuto, uma regra', text: 'Com uma só coisa para fazer, o resto (emails, prazos) sai do pensamento.' },
      { title: 'Ritmo que puxa', text: 'A dificuldade cresce contigo: ficas no ponto certo entre fácil e difícil.' },
    ],
  },
  {
    id: 'cores', group: 'rapidos', title: 'Cores', tag: 'Atenção', minutes: '45 s',
    icon: PaletteIcon, color: '#EC5BA6', light: '#FCE6F2',
    summary: 'Toca na cor da tinta, não na palavra.',
    howTo: 'Aparece o nome de uma cor escrito noutra cor. Escolhe a cor da tinta, o mais depressa que conseguires.',
    relax: [
      { title: 'Desliga o piloto automático', text: 'A cabeça lê a palavra sem querer. Travar isso treina o controlo da atenção.' },
      { title: 'Presença total', text: '45 segundos em que não há espaço para preocupações: só a próxima cor.' },
      { title: 'Volta com mais foco', text: 'Ignorar a palavra aqui ajuda a ignorar distrações (notificações, conversas) a seguir.' },
    ],
  },
]

export const gameMeta = (id: GameId) => GAMES.find(g => g.id === id)!

/**
 * Tom mais escuro de cada cor, para botões com texto branco (contraste de pelo menos 4,5:1;
 * as cores claras, como o verde-água e o laranja, ficavam ilegíveis com texto branco).
 */
const DARK: Record<string, string> = { '#12B5A6': '#0B7F75', '#7B61FF': '#6247E8', '#FF8A3D': '#B8530F', '#4C7DFF': '#2F5FE6', '#EC5BA6': '#C93F87' }
export const gameDark = (id: GameId) => DARK[gameMeta(id).color] ?? '#6247E8'

/** Linha curta para o cartão: o recorde ou quantas vezes já jogou */
export function statsLine(id: GameId, stats: GameStats | undefined) {
  if (!stats) return 'Ainda não jogaste'
  if (GAME_RULES[id].better === 'time') return `${stats.plays} ${stats.plays === 1 ? 'vez' : 'vezes'}`
  return `Recorde: ${formatScore(id, stats.best)}`
}
