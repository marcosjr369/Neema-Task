/**
 * Aparência do editor de diagramas (draw.io), enviada no arranque (evento "configure"):
 * as cores e a fonte da app, formas e setas por defeito mais bonitas, paleta de cores,
 * uma biblioteca "Udacha" com formas prontas (incluindo setas animadas) e CSS para a interface.
 * Referência: https://www.drawio.com/doc/faq/configure-diagram-editor
 */

export const C = {
  brand: '#7B61FF', brandDark: '#5B43D6', brandLight: '#EEEAFF',
  accent: '#12B5A6', accentDark: '#0D9488', accentLight: '#DCF7F3',
  warm: '#FF8A3D', warmDark: '#DB6A1F', warmLight: '#FFEDE0',
  danger: '#F2545B', dangerDark: '#CF3540', dangerLight: '#FDE4E5',
  gold: '#FFC53D', goldDark: '#E0A419', goldLight: '#FFF6DB',
  pink: '#EC5BA6', pinkDark: '#C93F87', pinkLight: '#FCE6F2',
  blue: '#4C7DFF', blueDark: '#3461DB', blueLight: '#E6EDFF',
  ink: '#2B2840', body: '#4A4763', muted: '#A3A0B8', line: '#E9E7F2', snow: '#F7F6FC',
}

const FONT = 'Nunito'

/* ─── Estilos das formas ──────────────────────────────────────────────── */

const base = `whiteSpace=wrap;html=1;fontFamily=${FONT};fontSize=13;fontStyle=1;strokeWidth=2;`
const tone = (fill: string, stroke: string, font = C.ink) => `fillColor=${fill};strokeColor=${stroke};fontColor=${font};`

export const S = {
  process: `rounded=1;arcSize=18;${base}${tone(C.brandLight, C.brand)}`,
  start: `rounded=1;arcSize=50;${base}${tone(C.accent, C.accentDark, '#ffffff')}`,
  end: `rounded=1;arcSize=50;${base}${tone(C.danger, C.dangerDark, '#ffffff')}`,
  decision: `rhombus;${base}${tone(C.warmLight, C.warm)}`,
  data: `shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=16;${base}${tone(C.blueLight, C.blue)}`,
  document: `shape=document;boundedLbl=1;size=0.18;${base}${tone(C.accentLight, C.accent)}`,
  database: `shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;${base}${tone(C.pinkLight, C.pink)}`,
  note: `shape=note;size=16;${base}fontStyle=0;align=left;spacingLeft=8;${tone(C.goldLight, C.gold)}`,
  person: `shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;outlineConnect=0;${base}${tone(C.brandLight, C.brand)}`,
  card: `rounded=1;arcSize=14;${base}${tone('#ffffff', C.line)}shadow=1;`,
  lane: `swimlane;horizontal=0;startSize=34;rounded=1;arcSize=6;${base}fontSize=14;${tone(C.snow, C.line, C.body)}swimlaneFillColor=#ffffff;`,
  text: `text;html=1;fontFamily=${FONT};fontSize=20;fontStyle=1;fontColor=${C.ink};align=left;verticalAlign=middle;`,
  edge: `edgeStyle=orthogonalEdgeStyle;rounded=1;curved=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=${C.body};endArrow=blockThin;endFill=1;endSize=8;fontFamily=${FONT};fontStyle=1;fontColor=${C.body};labelBackgroundColor=#ffffff;`,
  flow: `edgeStyle=orthogonalEdgeStyle;rounded=1;curved=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=3;strokeColor=${C.brand};endArrow=blockThin;endFill=1;endSize=8;flowAnimation=1;dashed=1;dashPattern=8 6;fontFamily=${FONT};fontStyle=1;fontColor=${C.brand};labelBackgroundColor=#ffffff;`,
}

/** Estilo como objecto (para defaultVertexStyle/defaultEdgeStyle) */
const obj = (style: string) => Object.fromEntries(style.split(';').filter(Boolean).map(kv => {
  const i = kv.indexOf('=')
  return i < 0 ? [kv, '1'] : [kv.slice(0, i), kv.slice(i + 1)]
}))

/* ─── Biblioteca "Udacha" ─────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function vertex(style: string, value: string, w: number, h: number) {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="1"><mxGeometry width="${w}" height="${h}" as="geometry"/></mxCell></root></mxGraphModel>`
}

function edge(style: string, w: number) {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="" style="${esc(style)}" edge="1" parent="1"><mxGeometry width="${w}" height="0" relative="1" as="geometry"><mxPoint as="sourcePoint"/><mxPoint x="${w}" as="targetPoint"/></mxGeometry></mxCell></root></mxGraphModel>`
}

const LIBRARY: { title: string; xml: string; w: number; h: number }[] = [
  { title: 'Início', xml: vertex(S.start, 'Início', 120, 48), w: 120, h: 48 },
  { title: 'Processo', xml: vertex(S.process, 'Processo', 140, 64), w: 140, h: 64 },
  { title: 'Decisão', xml: vertex(S.decision, 'Decisão?', 120, 90), w: 120, h: 90 },
  { title: 'Fim', xml: vertex(S.end, 'Fim', 120, 48), w: 120, h: 48 },
  { title: 'Dados', xml: vertex(S.data, 'Dados', 140, 60), w: 140, h: 60 },
  { title: 'Documento', xml: vertex(S.document, 'Documento', 130, 70), w: 130, h: 70 },
  { title: 'Base de dados', xml: vertex(S.database, 'Base de dados', 110, 80), w: 110, h: 80 },
  { title: 'Pessoa', xml: vertex(S.person, 'Pessoa', 36, 64), w: 36, h: 64 },
  { title: 'Nota', xml: vertex(S.note, 'Escreve uma nota…', 160, 90), w: 160, h: 90 },
  { title: 'Cartão', xml: vertex(S.card, 'Cartão', 150, 70), w: 150, h: 70 },
  { title: 'Título', xml: vertex(S.text, 'Título', 180, 40), w: 180, h: 40 },
  { title: 'Raia', xml: vertex(S.lane, 'Equipa', 560, 140), w: 560, h: 140 },
  { title: 'Seta', xml: edge(S.edge, 120), w: 120, h: 0 },
  { title: 'Seta animada', xml: edge(S.flow, 120), w: 120, h: 0 },
]

/** O draw.io espera cada forma comprimida: base64(deflateRaw(encodeURIComponent(xml))) */
async function compress(xml: string) {
  const stream = new Blob([encodeURIComponent(xml)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function library() {
  if (typeof CompressionStream === 'undefined') return null
  const data = await Promise.all(LIBRARY.map(async e => ({ xml: await compress(e.xml), w: e.w, h: e.h, title: e.title, aspect: 'fixed' })))
  return [{
    title: { main: 'Udacha' },
    entries: [{ id: 'udacha', title: { main: 'Udacha' }, desc: { main: 'Formas com as cores da Udacha' }, libs: [{ title: { main: 'Udacha' }, data, expand: 1 }] }],
  }]
}

/* ─── CSS da interface ────────────────────────────────────────────────── */

const CSS = `
:root { --u-brand: ${C.brand}; --u-ink: ${C.ink}; --u-body: ${C.body}; --u-muted: ${C.muted}; --u-line: ${C.line}; --u-snow: ${C.snow}; }
@keyframes uPop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes uFade { from { opacity: 0; } to { opacity: 1; } }

html body.geEditor, .geEditor, .geEditor * , .geDialog, .mxPopupMenu, .mxTooltip { font-family: '${FONT}', system-ui, sans-serif !important; }
.geEditor { color: var(--u-body); background: #fff !important; }

/* fundo da área de desenho */
.geDiagramContainer { background: var(--u-snow) !important; }
.geBackgroundPage { box-shadow: 0 1px 2px rgba(43,40,64,.06), 0 8px 28px rgba(43,40,64,.08) !important; border-radius: 6px; }

/* barras */
.geMenubarContainer, .geToolbarContainer { background: #fff !important; border-color: var(--u-line) !important; }
.geToolbarContainer { border-bottom: 2px solid var(--u-line) !important; box-shadow: none !important; }
.geMenubar a.geItem { border-radius: 8px; font-weight: 700; color: var(--u-body) !important; transition: background .15s, color .15s; }
.geMenubar a.geItem:hover { background: #EEEAFF !important; color: ${C.brandDark} !important; }
.geToolbar .geButton, .geToolbar .geLabel { border-radius: 10px !important; transition: background .15s, transform .12s; }
.geToolbar .geButton:hover, .geToolbar .geLabel:hover { background: #EEEAFF !important; }
.geToolbar .geButton:active { transform: scale(.9); }
.geToolbar .geSeparator { background: var(--u-line) !important; }

/* painel das formas */
.geSidebarContainer { background: #fff !important; border-right: 2px solid var(--u-line) !important; }
.geSidebarContainer .geTitle { font-weight: 800 !important; color: var(--u-ink) !important; font-size: 13px !important; border-radius: 10px; margin: 2px 6px; transition: background .15s; }
.geSidebarContainer .geTitle:hover { background: var(--u-snow) !important; }
.geSidebar { animation: uFade .25s ease; }
.geSidebar .geItem { border-radius: 10px !important; transition: transform .15s cubic-bezier(.3,1.6,.6,1), background .15s, box-shadow .15s !important; }
.geSidebar .geItem:hover { background: #EEEAFF !important; transform: translateY(-2px) scale(1.08); box-shadow: 0 4px 12px rgba(123,97,255,.18); }
.geSidebar .geItem:active { transform: scale(.95); }
.geSearchSidebar input, .geSidebarContainer input[type=search], .geSidebarContainer input[type=text] { border: 2px solid var(--u-line) !important; border-radius: 12px !important; background: var(--u-snow) !important; font-weight: 600; transition: border-color .15s, background .15s; }
.geSidebarContainer input:focus { border-color: ${C.accent} !important; background: #fff !important; outline: none; }
.geSidebarContainer .geDropTarget { border-radius: 12px !important; border-color: var(--u-line) !important; color: var(--u-muted) !important; }
.geSidebarContainer .geBtn, .geSidebarFooter .geBtn { border-radius: 12px !important; }

/* painel de formato */
.geFormatContainer { background: #fff !important; border-left: 2px solid var(--u-line) !important; }
.geFormatContainer > div { animation: uFade .2s ease; }
.geFormatSection { border-color: var(--u-line) !important; }
.geFormatContainer button, .geFormatContainer select, .geFormatContainer input[type=text] { border-radius: 8px !important; }

/* separadores das páginas */
.geFooterContainer, .geTabContainer { background: #fff !important; border-color: var(--u-line) !important; }
.geTab { border-radius: 10px 10px 0 0 !important; font-weight: 700; transition: background .15s, color .15s; }
.geTab:hover { color: ${C.brandDark} !important; }
.geActiveTab { color: ${C.brandDark} !important; box-shadow: inset 0 -3px 0 ${C.brand}; }

/* menus, janelas e dicas */
.mxPopupMenu { border-radius: 14px !important; border: 2px solid var(--u-line) !important; box-shadow: 0 12px 32px rgba(43,40,64,.16) !important; padding: 4px !important; animation: uPop .16s ease; transform-origin: top left; }
.mxPopupMenu .mxPopupMenuItem { border-radius: 8px; font-weight: 600; color: var(--u-body); }
.mxPopupMenu tr.mxPopupMenuItemHover { background: #EEEAFF !important; }
.mxPopupMenu tr.mxPopupMenuItemHover td { color: ${C.brandDark} !important; }
.geDialog { border-radius: 20px !important; border: 0 !important; box-shadow: 0 24px 60px rgba(43,40,64,.25) !important; animation: uPop .2s ease; }
.mxTooltip { border-radius: 10px !important; border: 0 !important; background: var(--u-ink) !important; color: #fff !important; font-weight: 700; box-shadow: 0 6px 18px rgba(43,40,64,.2) !important; animation: uFade .15s ease; }
.geHint { border-radius: 10px !important; border: 0 !important; background: var(--u-ink) !important; color: #fff !important; font-weight: 700; }
.geBtn { border-radius: 12px !important; font-weight: 800 !important; transition: transform .1s, filter .15s; }
.geBtn:active { transform: translateY(1px); }
.gePrimaryBtn, .geBigButton { background: ${C.brand} !important; border-color: ${C.brandDark} !important; color: #fff !important; }
.gePrimaryBtn:hover { filter: brightness(1.06); }

/* selecção por arrasto */
.mxRubberband { background: rgba(123,97,255,.12) !important; border: 2px solid ${C.brand} !important; border-radius: 6px; }

/* barras de deslocamento */
.geEditor ::-webkit-scrollbar { width: 10px; height: 10px; }
.geEditor ::-webkit-scrollbar-thumb { background: #DCD8EC; border-radius: 10px; border: 3px solid transparent; background-clip: padding-box; }
.geEditor ::-webkit-scrollbar-thumb:hover { background-color: ${C.muted}; }
`

/* ─── Configuração ────────────────────────────────────────────────────── */

export async function drawioConfig(): Promise<Record<string, unknown>> {
  const libraries = await library().catch(() => null)
  return {
    css: CSS,
    fontCss: `@import url('https://fonts.googleapis.com/css2?family=${FONT}:wght@400;600;700;800;900&display=swap');`,
    defaultFonts: [FONT, 'Helvetica', 'Verdana', 'Georgia', 'Courier New'],
    defaultVertexStyle: obj(`${base}${tone('#ffffff', C.brand)}rounded=1;arcSize=16;`),
    defaultEdgeStyle: obj(S.edge),
    // linha de cores rápidas no painel "Estilo"
    defaultColorSchemes: [[
      { fill: C.brandLight, stroke: C.brand, font: C.ink },
      { fill: C.accentLight, stroke: C.accent, font: C.ink },
      { fill: C.warmLight, stroke: C.warm, font: C.ink },
      { fill: C.blueLight, stroke: C.blue, font: C.ink },
      { fill: C.pinkLight, stroke: C.pink, font: C.ink },
      { fill: C.goldLight, stroke: C.gold, font: C.ink },
      { fill: C.dangerLight, stroke: C.danger, font: C.ink },
      { fill: C.snow, stroke: C.muted, font: C.body },
      { fill: C.brand, stroke: C.brandDark, font: '#ffffff' },
      { fill: C.accent, stroke: C.accentDark, font: '#ffffff' },
      { fill: C.warm, stroke: C.warmDark, font: '#ffffff' },
      { fill: C.ink, stroke: C.ink, font: '#ffffff' },
    ]],
    customPresetColors: [C.brand, C.accent, C.warm, C.blue, C.pink, C.gold, C.danger, C.ink, C.brandLight, C.accentLight, C.warmLight, C.blueLight, C.pinkLight, C.goldLight].map(c => c.slice(1)),
    ...(libraries ? { libraries, defaultLibraries: 'udacha;general;flowchart' } : { defaultLibraries: 'general;flowchart' }),
    sidebarWidth: 240,
    // nome debaixo de cada forma, para se perceber o que é
    sidebarTitles: true,
    thumbWidth: 46,
    thumbHeight: 40,
    expandLibraries: true,
    // grelha e página
    defaultGridColor: '#ECEAF5',
    defaultPageBackgroundColor: '#ffffff',
    // guias de alinhamento, de distância e de tamanho ao arrastar
    enablePositionGuides: true,
    enableDistanceGuides: true,
    enableSizeGuides: true,
    // animações ao inserir e mexer em formas; arrastar a pega move também as formas ligadas
    enableAnimations: true,
    insertAnimations: true,
    springMove: true,
    // sombras suaves
    shadowColor: C.ink,
    shadowOpacity: 0.12,
    shadowBlur: 6,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    // temas rápidos no painel "Diagrama" (aplicam-se ao diagrama inteiro)
    styles: [
      {},
      { commonStyle: { fontColor: C.ink, strokeColor: C.brand, fillColor: C.brandLight }, edgeStyle: { strokeColor: C.brand } },
      { commonStyle: { fontColor: C.ink, strokeColor: C.accent, fillColor: C.accentLight }, edgeStyle: { strokeColor: C.accentDark } },
      { commonStyle: { fontColor: C.ink, strokeColor: C.warm, fillColor: C.warmLight }, edgeStyle: { strokeColor: C.warmDark } },
      { vertexStyle: { strokeColor: C.brandDark, fillColor: C.brand, fontColor: '#ffffff' }, edgeStyle: { strokeColor: C.brandDark } },
      { commonStyle: { fontColor: '#ffffff', strokeColor: C.brand, fillColor: '#3A3657' }, edgeStyle: { strokeColor: C.muted }, graph: { background: C.ink, gridColor: '#3A3657' } },
      { commonStyle: { fontColor: C.body, strokeColor: C.muted, fillColor: C.snow }, graph: { background: '#ffffff', gridColor: C.line } },
    ],
  }
}
