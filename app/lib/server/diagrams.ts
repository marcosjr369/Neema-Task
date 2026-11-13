import type { Access, Diagram, DiagramView } from '../../types'
import { fail } from './api'
import { sharingInfo } from './sharing'

export const DIAGRAM_LIMITS = {
  title: 80,
  /** XML do draw.io; o pedido inteiro tem de caber no limite da Vercel (4,5 MB) */
  xml: 2_500_000,
  /** miniatura SVG em base64; maior do que isto, a lista fica sem miniatura */
  preview: 400_000,
}

/** Diagrama vazio, como o draw.io o grava */
export const EMPTY_DIAGRAM = '<mxfile><diagram id="p1" name="Página-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'

export function cleanXml(v: unknown): string {
  const xml = typeof v === 'string' ? v.trim() : ''
  if (!xml) fail(400, 'Diagrama vazio')
  if (xml.length > DIAGRAM_LIMITS.xml) fail(400, 'O diagrama é demasiado grande')
  // o editor grava <mxfile>; ficheiros antigos podem trazer só <mxGraphModel>
  if (!/^(<\?xml[^>]*>\s*)?<(mxfile|mxGraphModel)[\s>]/.test(xml)) fail(400, 'Isto não parece um ficheiro do draw.io')
  return xml
}

/** Só aceita SVG em data URI (é mostrado com <img>, que não corre scripts); o resto é ignorado */
export function cleanPreview(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > DIAGRAM_LIMITS.preview) return undefined
  return /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(v) ? v : undefined
}

export function diagramView(d: Diagram, access: Access): DiagramView {
  // o link só é mostrado a quem gere a partilha
  return { ...d, sharing: sharingInfo(d.sharing, access === 'owner') }
}

/** O que um visitante sem conta vê (link público ou senha) */
export function publicDiagramView(d: Diagram): DiagramView {
  return { ...d, ownerId: '', updatedBy: undefined, sharing: { visibility: d.sharing.visibility, hasPassword: !!d.sharing.password } }
}
