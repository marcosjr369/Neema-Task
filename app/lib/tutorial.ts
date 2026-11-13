import {
  CalendarBlankIcon, ChartBarIcon, FlowArrowIcon, KanbanIcon, ListChecksIcon, RocketLaunchIcon, TableIcon, TimerIcon, TrophyIcon,
  UsersThreeIcon, type Icon,
} from '@phosphor-icons/react'
import type { NavMode } from './nav'

/**
 * Lições do tutorial: cada funcionalidade tem uma cena animada (components/tutorial/scenes)
 * e as mesmas fases em texto. As fases e as cenas andam a par: a fase N é o passo N da cena.
 */

export type LessonId = 'inicio' | 'tarefas' | 'foco' | 'calendario' | 'quadros' | 'planilhas' | 'diagramas' | 'estatisticas' | 'ranking' | 'equipa'

export type Lesson = {
  id: LessonId
  title: string
  /** frase curta para os cartões */
  summary: string
  icon: Icon
  color: string
  light: string
  /** onde praticar */
  href: string
  /** tipos de conta que vêem esta lição */
  modes: NavMode[]
  steps: { title: string; text: string }[]
}

const PEOPLE: NavMode[] = ['person', 'manager', 'admin']
const ALL: NavMode[] = ['person', 'manager', 'admin', 'company']

export const LESSONS: Lesson[] = [
  {
    id: 'inicio',
    title: 'Primeiros passos',
    summary: 'Onde está cada coisa e os atalhos que poupam tempo',
    icon: RocketLaunchIcon,
    color: '#7B61FF',
    light: '#EEEAFF',
    href: '/',
    modes: ALL,
    steps: [
      { title: 'O menu', text: 'À esquerda (no telemóvel, em baixo) tens todas as secções: Tarefas, Foco, Calendário, Quadros, Planilhas, Diagramas e o teu progresso.' },
      { title: 'Criar depressa', text: 'Carrega na tecla N em qualquer página para criar uma tarefa nova. No telemóvel, usa o botão redondo com o +.' },
      { title: 'O teu dia', text: 'O painel da direita mostra o tempo focado hoje, a tua sequência de dias e o teu nível.' },
      { title: 'Ajuda sempre à mão', text: 'Podes voltar a este tutorial quando quiseres, no menu, em Tutorial.' },
    ],
  },
  {
    id: 'tarefas',
    title: 'Tarefas',
    summary: 'Criar, organizar e concluir o que tens para fazer',
    icon: ListChecksIcon,
    color: '#12B5A6',
    light: '#DCF7F3',
    href: '/tarefas',
    modes: PEOPLE,
    steps: [
      { title: 'Nova tarefa', text: 'Carrega em + (ou na tecla N) e escreve o que vais fazer, por exemplo "Preparar relatório".' },
      { title: 'Prioridade e prazo', text: 'Escolhe a prioridade e, se quiseres, um prazo. A app avisa-te quando o prazo se aproxima.' },
      { title: 'Passos', text: 'Divide tarefas grandes em passos na Checklist e vai riscando à medida que avanças.' },
      { title: 'Concluir', text: 'Toca no círculo para concluir. Ganhas pontos: mais na prioridade alta e um bónus se acabares dentro do prazo.' },
    ],
  },
  {
    id: 'foco',
    title: 'Foco',
    summary: 'Cronómetro de concentração com pausas automáticas',
    icon: TimerIcon,
    color: '#F2545B',
    light: '#FDE4E5',
    href: '/foco',
    modes: PEOPLE,
    steps: [
      { title: 'Escolher a tarefa', text: 'Em Foco (ou no ▶ de uma tarefa), escolhe em que vais trabalhar e liga o cronómetro.' },
      { title: 'Concentrar', text: 'O tempo conta numa só tarefa. Por defeito são blocos de 25 minutos; podes mudar isso no Perfil.' },
      { title: 'Pausar', text: 'No fim do bloco a app sugere uma pausa curta e chama-te quando for hora de voltar.' },
      { title: 'Meta do dia', text: 'Cada 5 minutos focados valem 1 ponto e enchem a tua meta diária.' },
    ],
  },
  {
    id: 'calendario',
    title: 'Calendário',
    summary: 'Agendar reuniões e eventos e convidar colegas',
    icon: CalendarBlankIcon,
    color: '#22A6CF',
    light: '#E0F4FA',
    href: '/calendario',
    modes: ALL,
    steps: [
      { title: 'Escolher o dia', text: 'Abre o Calendário e toca no dia, ou carrega em Agendar.' },
      { title: 'O quê e quando', text: 'Escreve o nome (ex.: "Reunião de equipa"), o tipo, a hora e o local ou link da chamada.' },
      { title: 'Participantes', text: 'Numa empresa, junta os colegas em Participantes. Eles recebem o convite.' },
      { title: 'Avisos', text: 'Todos recebem um aviso 5 minutos antes e outro à hora certa (com as notificações ligadas, até com a app fechada).' },
    ],
  },
  {
    id: 'quadros',
    title: 'Quadros',
    summary: 'Listas e cartões para acompanhar o trabalho em equipa',
    icon: KanbanIcon,
    color: '#7B61FF',
    light: '#EEEAFF',
    href: '/quadros',
    modes: ALL,
    steps: [
      { title: 'Listas e cartões', text: 'Um quadro tem listas (ex.: A fazer, Em curso, Feito). Em cada lista, adiciona cartões.' },
      { title: 'Arrastar', text: 'Arrasta um cartão de uma lista para outra à medida que o trabalho avança.' },
      { title: 'Detalhes', text: 'Abre um cartão para lhe pôr etiquetas, membros, datas, checklist e comentários.' },
      { title: 'Partilhar', text: 'Em Partilhar convidas pessoas para ver ou editar, ou crias um link.' },
    ],
  },
  {
    id: 'planilhas',
    title: 'Planilhas',
    summary: 'Folhas de cálculo com fórmulas, partilhadas',
    icon: TableIcon,
    color: '#12B5A6',
    light: '#DCF7F3',
    href: '/planilhas',
    modes: ALL,
    steps: [
      { title: 'Escrever', text: 'Toca numa célula e escreve. Enter passa para a de baixo; as setas mexem-te pela grelha.' },
      { title: 'Fórmulas', text: 'Começa por = para calcular, por exemplo =SOMA(B2:B3). Aceita nomes em português e em inglês.' },
      { title: 'Formatar', text: 'Selecciona células e usa negrito, cores e formatos (€, %).' },
      { title: 'Excel', text: 'Importa um .xlsx ou .csv e exporta quando quiseres. Tudo fica gravado sozinho.' },
    ],
  },
  {
    id: 'diagramas',
    title: 'Diagramas',
    summary: 'Fluxogramas, organogramas e mapas de ideias',
    icon: FlowArrowIcon,
    color: '#FF8A3D',
    light: '#FFEDE0',
    href: '/diagramas',
    modes: ALL,
    steps: [
      { title: 'Começar com um modelo', text: 'Em Novo diagrama, escolhe um modelo (Fluxograma, Processo com raias, Organograma…) ou começa em branco.' },
      { title: 'Arrastar formas', text: 'Arrasta formas da biblioteca Udacha, à esquerda, para a tela. Duplo clique para escrever.' },
      { title: 'Ligar', text: 'Passa o rato por uma forma e puxa uma das setas para a ligar a outra. A "Seta animada" mostra o fluxo a andar.' },
      { title: 'Gravar e partilhar', text: 'Grava sozinho a cada alteração. Descarrega em PNG ou SVG, ou partilha com a equipa.' },
    ],
  },
  {
    id: 'estatisticas',
    title: 'Estatísticas',
    summary: 'Ver onde vai o teu tempo e como estás a evoluir',
    icon: ChartBarIcon,
    color: '#EC5BA6',
    light: '#FCE6F2',
    href: '/estatisticas',
    modes: PEOPLE,
    steps: [
      { title: 'Tempo por dia', text: 'O gráfico mostra quanto focaste em cada dia. Passa o rato numa barra para ver o detalhe.' },
      { title: 'Por categoria', text: 'Vê em que tipo de trabalho passas mais tempo.' },
      { title: 'Sequência e nível', text: 'Foca todos os dias para manter a sequência e subir de nível com XP.' },
      { title: 'Período', text: 'Muda entre semana, mês e mais para comparar.' },
    ],
  },
  {
    id: 'ranking',
    title: 'Ranking',
    summary: 'Pontos, posições e quem está a dar tudo',
    icon: TrophyIcon,
    color: '#E0A419',
    light: '#FFF6DB',
    href: '/ranking',
    modes: ALL,
    steps: [
      { title: 'A tabela', text: 'O Ranking ordena as pessoas por pontos. A tua linha aparece destacada.' },
      { title: 'Como se ganham pontos', text: '1 ponto por cada 5 minutos de foco, 8 a 15 por tarefa concluída, +5 dentro do prazo e +15 se for aprovada à primeira.' },
      { title: 'Subir', text: 'Cada tarefa e cada minuto contam: vês a tua posição subir.' },
      { title: 'Privacidade', text: 'No Perfil escolhes aparecer com o nome, só com as iniciais ou ficar oculto.' },
    ],
  },
  {
    id: 'equipa',
    title: 'Gerir a equipa',
    summary: 'Convidar pessoas, departamentos e aprovar tarefas',
    icon: UsersThreeIcon,
    color: '#4C7DFF',
    light: '#E6EDFF',
    href: '/empresa',
    modes: ['manager', 'admin', 'company'],
    steps: [
      { title: 'Convidar', text: 'Em Funcionários, carrega em Convidar para a equipa e envia o email ou copia o link de convite.' },
      { title: 'Departamentos', text: 'Organiza as pessoas em departamentos e escolhe quem os chefia.' },
      { title: 'Atribuir e aprovar', text: 'Em Tarefas da equipa atribuis trabalho. As tarefas que precisam de aprovação esperam pelo teu Aprovar.' },
      { title: 'Relatórios', text: 'Acompanha o tempo, as tarefas e a presença da equipa em Relatórios e Recordes.' },
    ],
  },
]

export const lessonsFor = (mode: NavMode) => LESSONS.filter(l => l.modes.includes(mode))


/** As lições mostradas nas boas-vindas (as essenciais de cada tipo de conta) */
export function welcomeLessons(mode: NavMode): Lesson[] {
  const ids: LessonId[] = mode === 'company' ? ['equipa', 'quadros', 'calendario'] : mode === 'person' ? ['tarefas', 'foco', 'quadros'] : ['tarefas', 'foco', 'equipa']
  return ids.map(id => LESSONS.find(l => l.id === id)!).filter(l => l.modes.includes(mode))
}
