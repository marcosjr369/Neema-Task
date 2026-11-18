'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { drawioConfig } from './drawioTheme'
import { UserError } from '../../lib/api'

/**
 * Editor do diagrams.net (draw.io) embutido num iframe, no modo "embed" com protocolo JSON:
 * https://www.drawio.com/doc/faq/embed-mode
 *
 * O diagrama nunca sai do browser para os servidores do diagrams.net: o editor corre no iframe e
 * devolve-nos o XML por postMessage; somos nós que o gravamos. No arranque o editor pede a
 * configuração (configure=1) e recebe o tema da app (ver drawioTheme.ts). Para usar uma cópia
 * própria do editor (ex.: sem depender de um serviço externo), define NEXT_PUBLIC_DRAWIO_URL.
 */

export const DRAWIO_URL = (process.env.NEXT_PUBLIC_DRAWIO_URL || 'https://embed.diagrams.net').replace(/\/$/, '')
const DRAWIO_ORIGIN = new URL(DRAWIO_URL).origin

export type ExportFormat = 'svg' | 'png' | 'xmlpng'
export type ExportResult = { data: string; xml: string }

export type DrawioHandle = {
  /** substitui o diagrama aberto (perde o anular/refazer) */
  load: (xml: string) => void
  /** pede uma imagem do diagrama actual (data URI) e o XML correspondente */
  exportAs: (format: ExportFormat) => Promise<ExportResult>
}

type Msg = { event: string; xml?: string; data?: string; format?: string; modified?: boolean; message?: string }

const EXPORT_TIMEOUT = 15000

function src(readOnly: boolean) {
  const p = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '0',
    lang: 'pt',
    // o editor pede o tema antes de arrancar (evento "configure")
    configure: '1',
    // sem botões de "Gravar"/"Sair": gravamos sozinhos a cada alteração
    saveAndExit: '0',
    noSaveBtn: '1',
    noExitBtn: '1',
  })
  if (readOnly) {
    // visualizador sem menus nem edição
    p.set('chrome', '0')
    p.set('nav', '1')
  } else {
    p.set('ui', 'kennedy')
    p.set('libraries', '1')
  }
  return `${DRAWIO_URL}/?${p}`
}

const TIPS = [
  'Arrasta formas da biblioteca Udacha para a tela',
  'Passa o rato por uma forma e puxa uma das setas azuis para ligar',
  'Duplo clique numa forma para escrever',
  'Ctrl + roda do rato para aproximar ou afastar',
  'As alterações gravam-se sozinhas',
]

/** Enquanto o editor abre: um pequeno fluxo a desenhar-se */
function Loader({ readOnly }: { readOnly: boolean }) {
  const [tip, setTip] = useState(0)
  useEffect(() => {
    if (readOnly) return
    const t = setInterval(() => setTip(i => (i + 1) % TIPS.length), 2600)
    return () => clearInterval(t)
  }, [readOnly])
  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <svg width="260" height="96" viewBox="0 0 260 96" aria-hidden className="drop-shadow-sm">
        <path d="M66 48 H100" className="dg-line" stroke="#7B61FF" strokeWidth="3" fill="none" style={{ animationDelay: '.2s' }} />
        <path d="M160 48 H194" className="dg-line" stroke="#7B61FF" strokeWidth="3" fill="none" style={{ animationDelay: '.55s' }} />
        <rect x="6" y="30" width="60" height="36" rx="18" fill="#12B5A6" className="dg-node" />
        <rect x="100" y="28" width="60" height="40" rx="10" fill="#EEEAFF" stroke="#7B61FF" strokeWidth="2.5" className="dg-node" style={{ animationDelay: '.35s' }} />
        <path d="M224 22 L250 48 L224 74 L198 48 Z" fill="#FFEDE0" stroke="#FF8A3D" strokeWidth="2.5" className="dg-node" style={{ animationDelay: '.7s' }} />
      </svg>
      <p className="mt-4 font-black text-ink">{readOnly ? 'A abrir o diagrama…' : 'A preparar a tela…'}</p>
      {!readOnly && <p key={tip} className="mt-1 h-5 text-sm font-semibold text-muted animate-fade-in">{TIPS[tip]}</p>}
    </div>
  )
}

const DrawioFrame = forwardRef<DrawioHandle, {
  xml: string
  readOnly?: boolean
  /** chamado a cada alteração no editor, com o XML novo */
  onChange?: (xml: string) => void
  /** Ctrl+S no editor */
  onSaveRequest?: (xml: string) => void
  className?: string
}>(function DrawioFrame({ xml, readOnly = false, onChange, onSaveRequest, className = '' }, ref) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  // o editor já desenhou o diagrama: mostra-o com uma entrada suave
  const [shown, setShown] = useState(false)
  const [failed, setFailed] = useState(false)
  // o XML inicial: o iframe só o pede uma vez (evento "init"); mudanças depois vão por load()
  const initial = useRef(xml)
  const exports = useRef<{ resolve: (r: ExportResult) => void; reject: (e: Error) => void; timer: number }[]>([])
  const handlers = useRef({ onChange, onSaveRequest })
  useEffect(() => { handlers.current = { onChange, onSaveRequest } })

  const post = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(msg), DRAWIO_ORIGIN)
  }, [])

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      // só aceitamos mensagens do nosso iframe e da origem do editor
      if (e.origin !== DRAWIO_ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      let msg: Msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.event === 'configure') {
        // sem resposta o editor não arranca: em último caso vai sem tema
        const config = await drawioConfig().catch(() => ({}))
        post({ action: 'configure', config })
      } else if (msg.event === 'init') {
        post({ action: 'load', xml: initial.current, autosave: readOnly ? 0 : 1, noSaveBtn: '1', noExitBtn: '1', saveAndExit: '0' })
        setReady(true)
      } else if (msg.event === 'load') {
        setShown(true)
      } else if (msg.event === 'autosave' && typeof msg.xml === 'string') {
        handlers.current.onChange?.(msg.xml)
      } else if (msg.event === 'save' && typeof msg.xml === 'string') {
        handlers.current.onSaveRequest?.(msg.xml)
      } else if (msg.event === 'export') {
        const p = exports.current.shift()
        if (!p) return
        clearTimeout(p.timer)
        if (typeof msg.data === 'string') p.resolve({ data: msg.data, xml: msg.xml ?? '' })
        else p.reject(new UserError('Não foi possível exportar o diagrama. Tenta outra vez.'))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [post, readOnly])

  // se o evento "load" não chegar, mostra o editor na mesma
  useEffect(() => {
    if (!ready || shown) return
    const t = setTimeout(() => setShown(true), 2500)
    return () => clearTimeout(t)
  }, [ready, shown])

  // se o editor não arrancar (sem internet, bloqueado pela rede da empresa…), avisa
  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setFailed(true), 25000)
    return () => clearTimeout(t)
  }, [ready])

  useEffect(() => () => {
    for (const p of exports.current) { clearTimeout(p.timer); p.reject(new Error('Editor fechado')) }
    exports.current = []
  }, [])

  useImperativeHandle(ref, () => ({
    load: x => post({ action: 'load', xml: x, autosave: readOnly ? 0 : 1 }),
    exportAs: format => new Promise<ExportResult>((resolve, reject) => {
      if (!ready) return reject(new UserError('O editor ainda está a abrir. Espera um momento e tenta outra vez.'))
      const timer = window.setTimeout(() => {
        exports.current = exports.current.filter(p => p.timer !== timer)
        reject(new UserError('O editor não respondeu. Tenta outra vez.'))
      }, EXPORT_TIMEOUT)
      exports.current.push({ resolve, reject, timer })
      post({ action: 'export', format, border: 10, background: format === 'svg' ? 'none' : '#ffffff', shadow: false })
    }),
  }), [post, ready, readOnly])

  return (
    <div className={`relative h-full w-full overflow-hidden bg-snow ${className}`}>
      <iframe
        ref={frame}
        src={src(readOnly)}
        title={readOnly ? 'Diagrama' : 'Editor de diagramas'}
        className={`h-full w-full border-0 transition-[opacity,transform] duration-500 ease-out ${shown ? 'opacity-100' : 'scale-[0.985] opacity-0'}`}
        allow="clipboard-read; clipboard-write"
      />
      {!shown && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-snow">
          {failed ? (
            <div className="flex flex-col items-center text-center animate-dg-rise">
              <p className="font-black text-ink">O editor de diagramas não abriu</p>
              <p className="mt-1 max-w-sm text-sm font-semibold text-muted">Confirma a ligação à internet (o editor vem de {new URL(DRAWIO_URL).host}) e recarrega a página.</p>
              <button className="btn btn-ghost mt-4" onClick={() => window.location.reload()}>Recarregar</button>
            </div>
          ) : <Loader readOnly={readOnly} />}
        </div>
      )}
    </div>
  )
})

export default DrawioFrame
