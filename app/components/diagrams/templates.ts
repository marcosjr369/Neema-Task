import { C, S } from './drawioTheme'

/** Modelos para começar um diagrama novo, com as formas e cores da biblioteca "Udacha" */

type V = { id: string; v: string; s: string; x: number; y: number; w: number; h: number; parent?: string }
type E = { id: string; from: string; to: string; s?: string; v?: string; exit?: string; entry?: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const side: Record<string, string> = {
  r: 'X=1;Y=0.5', l: 'X=0;Y=0.5', t: 'X=0.5;Y=0', b: 'X=0.5;Y=1',
}
const at = (prefix: 'exit' | 'entry', s?: string) => (s ? side[s].split(';').map(p => `${prefix}${p};`).join('') + `${prefix}Dx=0;${prefix}Dy=0;` : '')

function file(vs: V[], es: E[], page = { w: 1169, h: 827 }) {
  const cells = [
    ...vs.map(c => `<mxCell id="${c.id}" value="${esc(c.v)}" style="${esc(c.s)}" vertex="1" parent="${c.parent ?? '1'}"><mxGeometry x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" as="geometry"/></mxCell>`),
    ...es.map(e => `<mxCell id="${e.id}" value="${esc(e.v ?? '')}" style="${esc((e.s ?? S.edge) + at('exit', e.exit) + at('entry', e.entry))}" edge="1" parent="1" source="${e.from}" target="${e.to}"><mxGeometry relative="1" as="geometry"/></mxCell>`),
  ].join('')
  return `<mxfile><diagram id="p1" name="Página-1"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${page.w}" pageHeight="${page.h}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`
}

const flowchart = () => file(
  [
    { id: 't', v: 'Pedido de um cliente', s: S.text, x: 60, y: 40, w: 400, h: 40 },
    { id: 'a', v: 'Início', s: S.start, x: 60, y: 140, w: 120, h: 48 },
    { id: 'b', v: 'Recebe o pedido', s: S.process, x: 240, y: 132, w: 150, h: 64 },
    { id: 'c', v: 'Está completo?', s: S.decision, x: 450, y: 119, w: 130, h: 90 },
    { id: 'd', v: 'Trata o pedido', s: S.process, x: 650, y: 132, w: 150, h: 64 },
    { id: 'e', v: 'Envia ao cliente', s: S.document, x: 860, y: 129, w: 150, h: 70 },
    { id: 'f', v: 'Fim', s: S.end, x: 875, y: 290, w: 120, h: 48 },
    { id: 'g', v: 'Pede os dados em falta', s: S.process, x: 440, y: 282, w: 150, h: 64 },
    { id: 'n', v: 'Dica: arrasta formas da biblioteca "Udacha" à esquerda. A seta roxa é animada.', s: S.note, x: 60, y: 400, w: 260, h: 90 },
  ],
  [
    { id: 'e1', from: 'a', to: 'b', s: S.flow },
    { id: 'e2', from: 'b', to: 'c', s: S.flow },
    { id: 'e3', from: 'c', to: 'd', s: S.flow, v: 'Sim' },
    { id: 'e4', from: 'd', to: 'e', s: S.flow },
    { id: 'e5', from: 'e', to: 'f', s: S.flow, exit: 'b', entry: 't' },
    { id: 'e6', from: 'c', to: 'g', v: 'Não', exit: 'b', entry: 't' },
    { id: 'e7', from: 'g', to: 'b', exit: 'l', entry: 'b' },
  ],
)

const orgChart = () => {
  const head = (fill: string, stroke: string) => `rounded=1;arcSize=16;whiteSpace=wrap;html=1;fontFamily=Nunito;fontSize=13;fontStyle=1;strokeWidth=2;fillColor=${fill};strokeColor=${stroke};fontColor=#ffffff;shadow=1;`
  const team = (stroke: string) => `rounded=1;arcSize=16;whiteSpace=wrap;html=1;fontFamily=Nunito;fontSize=13;fontStyle=1;strokeWidth=2;fillColor=#ffffff;strokeColor=${stroke};fontColor=${C.ink};`
  const tree = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeWidth=2;strokeColor=${C.muted};endArrow=none;`
  const areas = [
    { id: 'o', name: 'Operações', fill: C.accent, dark: C.accentDark, people: ['Logística', 'Apoio ao cliente'] },
    { id: 'v', name: 'Vendas', fill: C.warm, dark: C.warmDark, people: ['Contas', 'Marketing'] },
    { id: 'd', name: 'Tecnologia', fill: C.blue, dark: C.blueDark, people: ['Produto', 'Engenharia'] },
  ]
  const vs: V[] = [
    { id: 't', v: 'Organograma', s: S.text, x: 60, y: 40, w: 300, h: 40 },
    { id: 'ceo', v: 'Direcção<br><span style="font-weight:600;font-size:11px">Nome da pessoa</span>', s: head(C.brand, C.brandDark), x: 445, y: 110, w: 180, h: 64 },
  ]
  const es: E[] = []
  areas.forEach((a, i) => {
    const x = 140 + i * 300
    vs.push({ id: a.id, v: `${a.name}<br><span style="font-weight:600;font-size:11px">Responsável</span>`, s: head(a.fill, a.dark), x, y: 250, w: 180, h: 60 })
    es.push({ id: `e${a.id}`, from: 'ceo', to: a.id, s: tree, exit: 'b', entry: 't' })
    a.people.forEach((p, j) => {
      const id = `${a.id}${j}`
      vs.push({ id, v: p, s: team(a.fill), x: x + 30, y: 370 + j * 80, w: 150, h: 50 })
      es.push({ id: `e${id}`, from: a.id, to: id, s: `${tree}`, exit: 'l', entry: 'l' })
    })
  })
  return file(vs, es)
}

const swimlanes = () => {
  const lanes = [
    { id: 'L1', v: 'Cliente', y: 100 },
    { id: 'L2', v: 'Equipa', y: 250 },
    { id: 'L3', v: 'Sistema', y: 400 },
  ]
  const vs: V[] = [
    { id: 't', v: 'Processo com raias', s: S.text, x: 40, y: 40, w: 400, h: 40 },
    ...lanes.map(l => ({ id: l.id, v: l.v, s: S.lane, x: 40, y: l.y, w: 1060, h: 140 })),
    // posições relativas à raia (a faixa do nome ocupa os primeiros 34 px)
    { id: 'a', v: 'Faz a encomenda', s: S.start, x: 70, y: 46, w: 170, h: 48, parent: 'L1' },
    { id: 'b', v: 'Regista a encomenda', s: S.data, x: 70, y: 40, w: 170, h: 60, parent: 'L3' },
    { id: 'c', v: 'Há stock?', s: S.decision, x: 480, y: 25, w: 130, h: 90, parent: 'L2' },
    { id: 'd', v: 'Prepara e envia', s: S.process, x: 700, y: 38, w: 150, h: 64, parent: 'L2' },
    { id: 'e', v: 'Encomenda ao fornecedor', s: S.process, x: 470, y: 38, w: 150, h: 64, parent: 'L3' },
    { id: 'f', v: 'Recebe a encomenda', s: S.end, x: 890, y: 46, w: 150, h: 48, parent: 'L1' },
  ]
  const es: E[] = [
    { id: 'e1', from: 'a', to: 'b', s: S.flow, exit: 'b', entry: 't' },
    { id: 'e2', from: 'b', to: 'c', s: S.flow, exit: 'r', entry: 'l' },
    { id: 'e3', from: 'c', to: 'd', s: S.flow, v: 'Sim', exit: 'r', entry: 'l' },
    { id: 'e4', from: 'c', to: 'e', v: 'Não', exit: 'b', entry: 't' },
    { id: 'e5', from: 'e', to: 'd', exit: 'r', entry: 'b' },
    { id: 'e6', from: 'd', to: 'f', s: S.flow, exit: 'r', entry: 'b' },
  ]
  return file(vs, es)
}

const mindMap = () => {
  const curve = (color: string) => `curved=1;html=1;strokeWidth=3;strokeColor=${color};endArrow=none;`
  const branch = (fill: string, stroke: string) => `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fontFamily=Nunito;fontSize=13;fontStyle=1;strokeWidth=2;fillColor=${fill};strokeColor=${stroke};fontColor=${C.ink};`
  const center = { x: 480, y: 360, w: 200, h: 80 }
  const items = [
    { v: 'Objectivos', fill: C.accentLight, stroke: C.accent, x: 160, y: 150 },
    { v: 'Pessoas', fill: C.warmLight, stroke: C.warm, x: 820, y: 150 },
    { v: 'Prazos', fill: C.blueLight, stroke: C.blue, x: 900, y: 380 },
    { v: 'Riscos', fill: C.dangerLight, stroke: C.danger, x: 800, y: 590 },
    { v: 'Recursos', fill: C.goldLight, stroke: C.gold, x: 190, y: 590 },
    { v: 'Ideias', fill: C.pinkLight, stroke: C.pink, x: 90, y: 380 },
  ]
  const vs: V[] = [
    { id: 't', v: 'Mapa de ideias', s: S.text, x: 60, y: 40, w: 300, h: 40 },
    { id: 'c', v: 'Tema central', s: `ellipse;whiteSpace=wrap;html=1;fontFamily=Nunito;fontSize=18;fontStyle=1;strokeWidth=3;fillColor=${C.brand};strokeColor=${C.brandDark};fontColor=#ffffff;shadow=1;`, ...center },
    ...items.map((it, i) => ({ id: `b${i}`, v: it.v, s: branch(it.fill, it.stroke), x: it.x, y: it.y, w: 150, h: 50 })),
  ]
  const es: E[] = items.map((it, i) => ({ id: `e${i}`, from: 'c', to: `b${i}`, s: curve(it.stroke) }))
  return file(vs, es)
}

export type TemplateId = 'blank' | 'flowchart' | 'org' | 'lanes' | 'mind'

export const TEMPLATES: { id: TemplateId; title: string; text: string; xml: () => string | undefined }[] = [
  { id: 'blank', title: 'Em branco', text: 'Uma folha vazia', xml: () => undefined },
  { id: 'flowchart', title: 'Fluxograma', text: 'Passos, decisões e setas animadas', xml: flowchart },
  { id: 'lanes', title: 'Processo com raias', text: 'Quem faz o quê, em cada etapa', xml: swimlanes },
  { id: 'org', title: 'Organograma', text: 'Direcção, áreas e equipas', xml: orgChart },
  { id: 'mind', title: 'Mapa de ideias', text: 'Um tema e os seus ramos', xml: mindMap },
]
