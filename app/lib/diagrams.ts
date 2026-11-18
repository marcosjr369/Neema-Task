/** Ficheiros de diagramas no browser: importar .drawio e descarregar .drawio / .svg / .png */
import { UserError } from './api'

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim() || 'diagrama'

const MAX_FILE = 2 * 1024 * 1024

/** Lê um ficheiro do draw.io (.drawio ou .xml) e devolve o XML */
export async function readDiagramFile(file: File): Promise<string> {
  if (file.size > MAX_FILE) throw new UserError('O ficheiro tem mais de 2 MB')
  const text = (await file.text()).replace(/^﻿/, '').trim()
  if (!/^(<\?xml[^>]*>\s*)?<(mxfile|mxGraphModel)[\s>]/.test(text)) throw new UserError('Escolhe um ficheiro do draw.io (.drawio)')
  return text
}

function save(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadXml = (title: string, xml: string) => save(`${safeName(title)}.drawio`, new Blob([xml], { type: 'application/vnd.jgraph.mxfile' }))

/** Descarrega uma imagem que o editor devolveu como data URI */
export async function downloadDataUri(name: string, dataUri: string) {
  save(name, await (await fetch(dataUri)).blob())
}
