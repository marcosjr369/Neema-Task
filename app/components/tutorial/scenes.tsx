'use client'

import type { ReactNode } from 'react'
import { At, Chip, Cursor, Face, Float, Stage, Ticker, Typed, Win, type CursorPoint, type SceneProps } from './kit'
import type { LessonId } from '../../lib/tutorial'

/*
 * Cenas do tutorial. Cada cena tem 4 passos, os mesmos das fases em texto (lib/tutorial.ts).
 * As coordenadas dos elementos são relativas ao corpo da janela (384×212); o cursor anda no
 * palco inteiro, por isso os pontos passam por p() (corpo → palco).
 */

const p = (x: number, y: number, at: number, extra: Partial<CursorPoint> = {}): CursorPoint => ({ x: x + 8, y: y + 30, at, ...extra })

const BRAND = '#7B61FF'
const ACCENT = '#12B5A6'
const WARM = '#FF8A3D'
const DANGER = '#F2545B'
const BLUE = '#4C7DFF'
const PINK = '#EC5BA6'
const GOLD = '#FFC53D'

function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-1.5 rounded-lg border-2 border-line bg-white px-2 ${className}`}>{children}</div>
}

function Check({ on, color = BRAND }: { on: boolean; color?: string }) {
  return (
    <span className="flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300" style={{ borderColor: on ? color : '#D7D3E6', background: on ? color : '#fff' }}>
      {on && <svg width="6" height="6" viewBox="0 0 6 6"><path d="M1 3 L2.5 4.5 L5 1.5" stroke="#fff" strokeWidth="1.3" fill="none" /></svg>}
    </span>
  )
}

/* ─── Primeiros passos ────────────────────────────────────────────────── */

const MENU = ['Início', 'Tarefas', 'Foco', 'Calendário', 'Quadros', 'Planilhas', 'Diagramas', 'Tutorial']

function Inicio({ step }: SceneProps) {
  return (
    <Stage>
      <Win title="Udacha">
        <div className="absolute inset-y-0 left-0 w-[92px] border-r-2 border-line bg-white px-1.5 py-2">
          {MENU.map((m, i) => (
            <div key={m}
              className={`mb-[3px] rounded-md px-2 py-[3px] text-[9px] font-extrabold ${step === 0 && i > 0 && i < 7 ? 'tut-hl' : ''} ${step === 3 && i === 7 ? 'tut-glow bg-brand-light text-brand-dark' : ''}`}
              style={{ ['--d' as string]: `${0.15 + i * 0.45}s` }}>{m}</div>
          ))}
        </div>
        <div className="absolute left-[100px] right-[96px] top-2">
          <p className="text-[11px] font-black text-ink">Bom dia! ☀️</p>
          {['Responder emails', 'Reunião com cliente'].map(t => (
            <Row key={t} className="mt-1.5 h-[22px]"><Check on={false} /><span className="text-[9px] text-ink">{t}</span></Row>
          ))}
        </div>
        <At step={step} at={1} until={1} anim="tut-pop" className="left-[176px] top-[84px] flex flex-col items-center">
          <span className="tut-key flex h-9 w-9 items-center justify-center rounded-lg border-2 border-line bg-white text-[16px] font-black text-ink" style={{ ['--d' as string]: '0.4s' }}>N</span>
          <span className="mt-1 text-[8px] text-muted">tecla</span>
        </At>
        <At step={step} at={1} until={1} anim="tut-up" d={1.1} className="bottom-0 left-[100px] right-[96px] rounded-t-xl border-2 border-b-0 border-brand/40 bg-white p-2 shadow-lg">
          <p className="text-[8px] font-extrabold uppercase text-muted">Nova tarefa</p>
          <p className="mt-1 rounded-md bg-snow px-1.5 py-1 text-[10px] text-ink"><Typed text="Preparar relatório" d={1.6} /></p>
        </At>
        <div className="absolute inset-y-2 right-2 w-[86px] space-y-1.5">
          {[
            { k: 'Hoje', v: '1h 20m', c: ACCENT },
            { k: 'Sequência', v: '🔥 5 dias', c: WARM },
            { k: 'Nível 4', v: '', c: BRAND },
          ].map((x, i) => (
            <div key={x.k} className={`rounded-lg border-2 border-line bg-white p-1.5 ${step === 2 ? 'tut-glow' : ''}`} style={{ ['--d' as string]: `${i * 0.3}s` }}>
              <p className="text-[8px] text-muted">{x.k}</p>
              {x.v ? <p className="text-[11px] font-black" style={{ color: x.c }}>{x.v}</p> : (
                <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-snow">
                  <div key={step} className="tut-fill h-full w-[70%] rounded-full" style={{ background: x.c, ['--d' as string]: '0.6s' }} />
                </div>
              )}
            </div>
          ))}
        </div>
        <At step={step} at={3} anim="tut-pop" d={1} className="left-[96px] top-[150px] rounded-lg bg-ink px-2 py-1 text-[9px] text-white shadow">
          Volta aqui quando quiseres ✨
        </At>
      </Win>
      <Cursor step={step} paths={[
        [p(46, 32, 0), p(46, 54, 500), p(46, 76, 950), p(46, 98, 1400), p(46, 120, 1850), p(46, 142, 2300)],
        [p(240, 150, 0)],
        [p(330, 60, 0), p(330, 105, 900)],
        [p(46, 165, 0, { click: true })],
      ]} />
    </Stage>
  )
}

/* ─── Tarefas ─────────────────────────────────────────────────────────── */

function Tarefas({ step }: SceneProps) {
  const sheet = step <= 2
  return (
    <Stage>
      <Win title="Tarefas" head={<span className={`flex h-[15px] w-[15px] items-center justify-center rounded-md bg-brand text-[11px] font-black text-white ${step === 0 ? 'tut-glow' : ''}`}>+</span>}>
        <div className="absolute inset-x-3 top-3 space-y-1.5">
          {step >= 3 && (
            <Row className="tut-in h-[26px]">
              <Check on={false} color={ACCENT} />
              <span className="flex-1 text-[9.5px] text-ink">Preparar relatório</span>
              <Chip color={DANGER} bg="#FDE4E5">Alta</Chip>
              <Chip>Amanhã 18:00</Chip>
            </Row>
          )}
          {['Rever proposta', 'Ligar ao fornecedor', 'Organizar ficheiros'].map(t => (
            <Row key={t} className="h-[26px]"><Check on={false} /><span className="text-[9.5px] text-ink">{t}</span></Row>
          ))}
        </div>
        {step === 3 && (
          <div className="absolute left-3 right-3 top-3 h-[26px]">
            <span className="tut-pop absolute left-[7px] top-[7px] flex h-[12px] w-[12px] items-center justify-center rounded-full bg-accent text-[7px] text-white" style={{ ['--d' as string]: '0.85s' }}>✓</span>
            <Float d={1.1} style={{ left: 120, top: -2 }}>+20 pts</Float>
          </div>
        )}
        {sheet && (
          <div className={`absolute left-[70px] right-[70px] top-[10px] rounded-xl border-2 border-line bg-white p-2.5 shadow-xl ${step === 0 ? 'tut-pop' : ''}`} style={{ ['--d' as string]: '0.8s' }}>
            <p className="text-[8px] font-extrabold uppercase text-muted">O que vais fazer?</p>
            <p className="mt-1 rounded-md border-2 border-accent bg-white px-1.5 py-1 text-[11px] font-black text-ink">
              <Typed text="Preparar relatório" d={1.3} play={step === 0} />
            </p>
            <p className="mt-2 text-[8px] font-extrabold uppercase text-muted">Prioridade</p>
            <div className="mt-1 flex gap-1">
              <Chip>Baixa</Chip>
              <Chip>Média</Chip>
              <Chip className="transition-colors duration-300" color={step >= 1 ? '#fff' : DANGER} bg={step >= 1 ? DANGER : '#FDE4E5'}>Alta</Chip>
              {step >= 1 && <Chip className={step === 1 ? 'tut-pop' : ''} style={{ ['--d' as string]: '1.9s' }}>📅 Amanhã 18:00</Chip>}
            </div>
            <p className="mt-2 text-[8px] font-extrabold uppercase text-muted">Checklist</p>
            <div className="mt-1 space-y-1">
              {['Juntar os números', 'Escrever o resumo', 'Enviar à chefia'].map((t, i) => (
                <At key={t} step={step} at={2} d={0.2 + i * 0.25} className="relative flex items-center gap-1.5 text-[9px] text-ink" style={{ position: 'relative' }}>
                  <span className={`h-[10px] w-[10px] rounded-[3px] border-2 transition-colors duration-200 ${step === 2 && i < 2 ? 'border-brand bg-brand delay-[1600ms]' : 'border-line'}`} style={step === 2 && i === 1 ? { transitionDelay: '2400ms' } : undefined} />
                  <span>{t}</span>
                </At>
              ))}
            </div>
          </div>
        )}
      </Win>
      <Cursor step={step} paths={[
        [p(300, 150, 0), p(374, -14, 50, { click: true })],
        [p(250, 70, 0), p(214, 73, 300, { click: true }), p(260, 74, 1400)],
        [p(260, 110, 0), p(110, 118, 800, { click: true }), p(110, 131, 1650, { click: true })],
        [p(200, 120, 0), p(16, 16, 100, { click: true })],
      ]} />
    </Stage>
  )
}

/* ─── Foco ────────────────────────────────────────────────────────────── */

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function Foco({ step }: SceneProps) {
  const ring = 2 * Math.PI * 46
  return (
    <Stage>
      <Win title="Foco">
        {step === 0 && (
          <div className="absolute inset-x-6 top-6 space-y-2">
            {['Preparar relatório', 'Estudar capítulo 3'].map((t, i) => (
              <Row key={t} className={`h-[32px] transition-colors delay-700 duration-300 ${i === 0 ? 'bg-accent-light' : ''}`}>
                <Check on={false} />
                <span className="flex-1 text-[10px] text-ink">{t}</span>
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-[8px] text-white">▶</span>
              </Row>
            ))}
          </div>
        )}
        {step >= 1 && (
          <div className={`absolute left-1/2 top-[14px] -translate-x-1/2 ${step === 1 ? 'tut-pop' : ''}`}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="46" fill="none" stroke="#E9E7F2" strokeWidth="9" />
              <circle key={step} cx="60" cy="60" r="46" fill="none" stroke={step === 2 ? WARM : DANGER} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={ring} transform="rotate(-90 60 60)" className="tut-draw" style={{ ['--len' as string]: ring, animationDuration: '3.6s' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-black tabular-nums text-ink">
                {step === 1 ? <Ticker from={25 * 60} to={24 * 60 + 52} ms={3600} format={clock} /> : step === 2 ? '00:00' : '05:00'}
              </span>
              <span className="text-[8px] text-muted">{step === 2 ? 'bloco terminado' : step === 3 ? 'pausa' : 'Preparar relatório'}</span>
            </div>
          </div>
        )}
        <At step={step} at={2} until={2} anim="tut-pop" d={0.6} className="left-[230px] top-[40px] w-[130px] rounded-xl border-2 border-warm/40 bg-white p-2 shadow-lg">
          <p className="text-[10px] font-black text-ink">Hora de pausar ☕</p>
          <p className="text-[8.5px] text-muted">Focaste 25 min. 5 min de pausa?</p>
          <span className="mt-1.5 inline-block rounded-md bg-warm px-2 py-1 text-[8.5px] font-black text-white">Começar pausa</span>
        </At>
        <At step={step} at={3} className="inset-x-10 bottom-4">
          <div className="flex justify-between text-[8.5px]"><span>Meta do dia</span><span className="text-ink">1h 40m / 2h</span></div>
          <div className="mt-1 h-[8px] overflow-hidden rounded-full bg-snow">
            <div className="tut-fill h-full w-[84%] rounded-full bg-accent" style={{ ['--d' as string]: '0.3s', ['--t' as string]: '1.6s' }} />
          </div>
          <Float d={1.2} style={{ right: 40, top: -18 }}>+5 pts</Float>
        </At>
      </Win>
      <Cursor step={step} paths={[
        [p(220, 140, 0), p(349, 40, 100, { click: true })],
        [p(330, 170, 0)],
        [p(330, 170, 0), p(270, 89, 1300, { click: true })],
        [p(330, 170, 0)],
      ]} />
    </Stage>
  )
}

/* ─── Calendário ──────────────────────────────────────────────────────── */

function Calendario({ step }: SceneProps) {
  const cell = (i: number) => ({ x: 8 + (i % 7) * 30, y: 30 + Math.floor(i / 7) * 34 })
  const day = 13
  return (
    <Stage>
      <Win title="Calendário" head={<Chip color="#fff" bg={BRAND}>Agendar</Chip>}>
        <div className="absolute left-2 top-2 flex w-[212px] justify-between px-1 text-[8px] text-muted">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="w-[28px] text-center">{d}</span>)}
        </div>
        {Array.from({ length: 35 }, (_, i) => {
          const c = cell(i)
          const sel = i === day && step >= 0
          return (
            <div key={i} className="absolute flex h-[30px] w-[28px] flex-col items-center rounded-md pt-[3px] text-[9px] transition-colors duration-300"
              style={{ left: c.x, top: c.y, background: sel ? '#EEEAFF' : '#fff', color: sel ? '#5B43D6' : '#4A4763', transitionDelay: step === 0 ? '0.8s' : '0s', boxShadow: sel ? `inset 0 0 0 2px ${BRAND}` : 'inset 0 0 0 1px #F0EEF7' }}>
              {(i % 31) + 1}
              {i === day && step >= 3 && <span className="tut-pop mt-[2px] h-[4px] w-[16px] rounded-full bg-brand" style={{ ['--d' as string]: '0.4s' }} />}
              {(i === 4 || i === 22) && <span className="mt-[2px] h-[4px] w-[12px] rounded-full bg-accent/60" />}
            </div>
          )
        })}
        <At step={step} at={1} anim="tut-slide" className="right-2 top-2 w-[150px] rounded-xl border-2 border-line bg-white p-2 shadow-lg">
          <p className="text-[8px] font-extrabold uppercase text-muted">O quê?</p>
          <p className="mt-0.5 rounded-md border-2 border-accent px-1.5 py-1 text-[10px] font-black text-ink"><Typed text="Reunião de equipa" d={0.6} play={step === 1} /></p>
          <div className="mt-1.5 flex gap-1">
            <Chip color="#fff" bg={BRAND}>Reunião</Chip>
            <Chip>14 · 10:00</Chip>
          </div>
          <p className="mt-1.5 text-[8px] text-muted">📍 Sala 2 · ou link da chamada</p>
          <p className="mt-2 text-[8px] font-extrabold uppercase text-muted">Participantes</p>
          <div className="mt-1 flex -space-x-1">
            {step >= 2 && [['Ana Silva', ACCENT], ['Rui Costa', WARM], ['Inês Lopes', PINK]].map(([n, c], i) => (
              <span key={n} className={step === 2 ? 'tut-pop' : ''} style={{ ['--d' as string]: `${0.8 + i * 0.4}s` }}><Face name={n} color={c} size={18} /></span>
            ))}
            <span className="ml-2 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-dashed border-line text-[10px] text-muted">+</span>
          </div>
        </At>
        <At step={step} at={3} anim="tut-slide" d={0.9} className="right-3 top-[150px] flex w-[150px] items-center gap-1.5 rounded-xl bg-ink p-2 text-white shadow-xl">
          <span className="text-[14px]">🔔</span>
          <span><span className="block text-[9px] font-black">Reunião daqui a 5 min</span><span className="block text-[8px] text-white/70">Reunião de equipa · 10:00</span></span>
        </At>
      </Win>
      <Cursor step={step} paths={[
        [p(150, 170, 0), p(cell(day).x + 14, cell(day).y + 15, 0, { click: true })],
        [p(300, 30, 0)],
        [p(300, 30, 0), p(318, 122, 300, { click: true }), p(318, 122, 1100, { click: true }), p(318, 122, 1500, { click: true })],
        [p(150, 190, 0)],
      ]} />
    </Stage>
  )
}

/* ─── Quadros ─────────────────────────────────────────────────────────── */

const LISTS = [
  { t: 'A fazer', cards: ['Escrever textos', 'Escolher fotos'] },
  { t: 'Em curso', cards: ['Página inicial'] },
  { t: 'Feito', cards: ['Domínio comprado', 'Paleta de cores'] },
]

function Quadros({ step }: SceneProps) {
  const listX = (i: number) => 8 + i * 125
  // o cartão novo: na lista 1 (passo 0), depois arrastado para a lista 2
  const moved = step >= 1
  const card = moved ? { x: listX(1) + 6, y: 33 } : { x: listX(0) + 6, y: 82 }
  return (
    <Stage>
      <Win title="Lançamento do site" tint="linear-gradient(135deg,#7B61FF,#4C7DFF)"
        head={<span className={`rounded-md bg-brand px-1.5 py-[1px] text-[8px] font-black text-white ${step === 3 ? 'tut-glow' : ''}`}>Partilhar</span>}>
        {LISTS.map((l, i) => (
          <div key={l.t} className="absolute top-2 w-[118px] rounded-xl bg-snow/95 p-1.5" style={{ left: listX(i), height: 196 }}>
            <p className="px-1 text-[9px] font-black text-ink">{l.t}</p>
            <div className="mt-1 space-y-1" style={{ paddingTop: i === 1 && moved ? 32 : 0, transition: 'padding .4s', transitionDelay: step === 1 ? '1.2s' : '0s' }}>
              {l.cards.map(c => <div key={c} className="rounded-md bg-white px-1.5 py-1.5 text-[8.5px] text-ink shadow-sm">{c}</div>)}
            </div>
            {i === 0 && <p className="mt-1 px-1 text-[8.5px] text-muted" style={{ marginTop: moved ? 6 : 36, transition: 'margin .4s .9s' }}>+ Adicionar cartão</p>}
          </div>
        ))}
        {(step >= 1 || step === 0) && (
          <div className={`absolute z-20 w-[106px] rounded-md bg-white px-1.5 py-1.5 text-[8.5px] text-ink shadow-md ${step === 0 ? 'tut-pop' : ''}`}
            style={{ left: card.x, top: card.y, transition: 'left .75s cubic-bezier(.4,0,.2,1) .9s, top .75s cubic-bezier(.4,0,.2,1) .9s, transform .2s', transform: step === 1 ? 'rotate(-3deg)' : 'none', ['--d' as string]: '0.9s' }}>
            {step >= 2 && <span className="mb-1 flex gap-1"><span className="h-[4px] w-[16px] rounded-full bg-warm" /><span className="h-[4px] w-[16px] rounded-full bg-accent" /></span>}
            <Typed text="Desenhar logótipo" d={1.1} play={step === 0} />
          </div>
        )}
        <At step={step} at={2} until={2} anim="tut-pop" d={1} className="left-[170px] top-[30px] z-30 w-[190px] rounded-xl bg-white p-2.5 shadow-2xl">
          <p className="text-[11px] font-black text-ink">Desenhar logótipo</p>
          <p className="mt-1.5 text-[8px] font-extrabold uppercase text-muted">Etiquetas</p>
          <div className="mt-0.5 flex gap-1"><Chip color="#fff" bg={WARM}>Design</Chip><Chip color="#fff" bg={ACCENT}>Urgente</Chip></div>
          <p className="mt-1.5 text-[8px] font-extrabold uppercase text-muted">Membros · Datas</p>
          <div className="mt-0.5 flex items-center gap-1"><Face name="Ana Silva" color={PINK} /><Face name="Rui Costa" color={BLUE} /><Chip>📅 Sex, 14</Chip></div>
          <p className="mt-1.5 text-[8px] font-extrabold uppercase text-muted">Checklist 2/3</p>
          <div className="mt-0.5 h-[5px] overflow-hidden rounded-full bg-snow"><div className="tut-fill h-full w-2/3 rounded-full bg-accent" style={{ ['--d' as string]: '1.6s' }} /></div>
        </At>
        <At step={step} at={3} anim="tut-pop" d={0.8} className="right-2 top-2 z-30 w-[170px] rounded-xl bg-white p-2.5 shadow-2xl">
          <p className="text-[11px] font-black text-ink">Partilhar quadro</p>
          <p className="mt-1 rounded-md border-2 border-accent px-1.5 py-1 text-[9px] text-ink"><Typed text="rui@empresa.pt" d={1.4} /></p>
          <div className="mt-1.5 flex items-center justify-between"><Chip>Pode editar ▾</Chip><Chip color="#fff" bg={BRAND}>Convidar</Chip></div>
          <p className="mt-1.5 truncate rounded-md bg-snow px-1.5 py-1 text-[8px] text-muted">🔗 udacha.app/p/x7Kq…</p>
        </At>
      </Win>
      <Cursor step={step} paths={[
        [p(200, 180, 0), p(listX(0) + 40, 125, 0, { click: true })],
        [p(listX(0) + 50, 90, 0, { press: true }), p(listX(1) + 50, 66, 900, { press: true }), p(listX(1) + 60, 120, 1800)],
        [p(listX(1) + 50, 66, 0, { click: true })],
        [p(360, -12, 0, { click: true }), p(300, 26, 1300, { click: true })],
      ]} />
    </Stage>
  )
}

/* ─── Planilhas ───────────────────────────────────────────────────────── */

function Planilhas({ step }: SceneProps) {
  const col = (c: number) => 26 + c * 82
  const row = (r: number) => 40 + r * 22
  const cellText = (r: number, c: number): ReactNode => {
    if (r === 0) return ['Item', 'Valor', 'Estado', 'Notas'][c]
    if (c === 0) return ['', 'Rendas', 'Material', 'Total'][r] ?? ''
    if (c === 1 && r === 1) return step === 0 ? <Typed text="120" d={0.9} /> : '120 €'
    if (c === 1 && r === 2) return step === 0 ? <Typed text="80" d={2.3} /> : '80 €'
    if (c === 1 && r === 3 && step >= 1) return <span className={step === 1 ? 'tut-pop inline-block font-black text-accent-dark' : 'font-black'} style={{ ['--d' as string]: '2.4s' }}>200 €</span>
    if (c === 2 && r > 0 && r < 3) return <Chip color={ACCENT} bg="#DCF7F3">Pago</Chip>
    return ''
  }
  const formula = step === 1 ? <Typed text="=SOMA(B2:B3)" d={0.9} /> : step >= 2 ? '=SOMA(B2:B3)' : ''
  return (
    <Stage>
      <Win title="Orçamento 2026" head={step === 3 ? <Chip color="#fff" bg={BRAND} className="tut-glow">Exportar ▾</Chip> : <Chip>Exportar ▾</Chip>}>
        <div className="absolute inset-x-0 top-0 flex h-[16px] items-center gap-1 border-b-2 border-line px-2">
          <span className={`rounded px-1 text-[9px] font-black transition-colors ${step === 2 ? 'bg-brand-light text-brand-dark delay-700' : ''}`}>B</span>
          <span className="rounded px-1 text-[9px] italic">I</span>
          <span className={`h-[8px] w-[10px] rounded-sm ${step === 2 ? 'tut-glow' : ''}`} style={{ background: '#EEEAFF', ['--d' as string]: '1.2s' }} />
        </div>
        <div className="absolute inset-x-0 top-[16px] flex h-[18px] items-center gap-1.5 border-b-2 border-line px-2 font-mono text-[9px] text-ink">
          <span className="rounded bg-snow px-1 font-sans text-[8px] font-black">{step === 0 ? 'B2' : step === 1 ? 'B4' : step === 2 ? 'A1:D1' : 'B4'}</span>
          <span className="text-muted">ƒx</span>{formula}
        </div>
        {[0, 1, 2, 3].map(c => <span key={c} className="absolute top-[34px] text-[8px] text-muted" style={{ left: col(c) + 36 }}>{'ABCD'[c]}</span>)}
        {Array.from({ length: 6 }, (_, r) => (
          <span key={r} className="absolute left-[8px] text-[8px] text-muted" style={{ top: row(r) + 6 }}>{r + 1}</span>
        ))}
        {Array.from({ length: 6 }, (_, r) => [0, 1, 2, 3].map(c => {
          const head = r === 0
          const styled = head && step >= 2
          return (
            <div key={`${r}-${c}`} className="absolute flex items-center border border-[#EEECF5] px-1 text-[9px] text-ink transition-colors duration-300"
              style={{ left: col(c), top: row(r), width: 82, height: 22, background: styled ? '#EEEAFF' : '#fff', fontWeight: styled ? 900 : 700, transitionDelay: step === 2 ? `${0.9 + c * 0.1}s` : '0s', justifyContent: c === 1 && r > 0 ? 'flex-end' : 'flex-start' }}>
              {cellText(r, c)}
            </div>
          )
        }))}
        {step === 1 && <div className="tut-in absolute rounded-sm border-2 border-dashed border-accent" style={{ left: col(1), top: row(1), width: 82, height: 44, ['--d' as string]: '1.6s' }} />}
        {step === 0 && <div className="absolute border-2 border-brand transition-all duration-300 delay-[1500ms]" style={{ left: col(1), top: row(1), width: 82, height: 22 }} />}
        {step === 1 && <div className="absolute border-2 border-brand" style={{ left: col(1), top: row(3), width: 82, height: 22 }} />}
        {step === 2 && <div className="tut-in absolute border-2 border-brand" style={{ left: col(0), top: row(0), width: 328, height: 22, ['--d' as string]: '0.5s' }} />}
        <At step={step} at={3} anim="tut-pop" d={0.8} className="right-2 top-2 z-20 w-[150px] rounded-xl bg-white p-1.5 shadow-2xl">
          <p className="rounded-md bg-brand-light px-2 py-1 text-[9px] text-brand-dark">⬇ Excel (.xlsx), todas as folhas</p>
          <p className="px-2 py-1 text-[9px]">⬇ CSV (.csv), só esta folha</p>
          <p className="border-t-2 border-line px-2 pt-1 text-[9px]">⬆ Importar .xlsx ou .csv</p>
        </At>
        <At step={step} at={3} anim="tut-slide" d={2} className="bottom-3 left-3 rounded-lg bg-ink px-2 py-1 text-[9px] text-white shadow-lg">✓ Orçamento 2026.xlsx</At>
      </Win>
      <Cursor step={step} paths={[
        [p(300, 180, 0), p(col(1) + 40, row(1) + 11, 0, { click: true }), p(col(1) + 40, row(2) + 11, 1500, { click: true })],
        [p(col(1) + 40, row(3) + 11, 0, { click: true })],
        [p(col(0) + 20, row(0) + 11, 0, { press: true }), p(col(3) + 60, row(0) + 11, 600, { press: true }), p(14, 8, 1300, { click: true })],
        [p(355, -12, 0, { click: true }), p(300, 9, 1300, { click: true })],
      ]} />
    </Stage>
  )
}

/* ─── Diagramas ───────────────────────────────────────────────────────── */

function Diagramas({ step }: SceneProps) {
  const templates = [
    { t: 'Em branco', c: '#A3A0B8', bg: '#F7F6FC' },
    { t: 'Fluxograma', c: BRAND, bg: '#EEEAFF' },
    { t: 'Organograma', c: WARM, bg: '#FFEDE0' },
  ]
  const shape = step >= 2 ? { x: 150, y: 90 } : { x: 18, y: 60 }
  return (
    <Stage>
      <Win title={step === 0 ? 'Novo diagrama' : 'Processo de vendas'}
        head={step === 3 ? <><Chip color={ACCENT} bg="#DCF7F3" className="tut-pop">✓ Guardado</Chip><Chip color="#fff" bg={BRAND} className="tut-glow">Partilhar</Chip></> : undefined}>
        {step === 0 && (
          <div className="absolute inset-x-6 top-8 grid grid-cols-3 gap-3">
            {templates.map((t, i) => (
              <div key={t.t} className={`tut-in relative rounded-xl border-2 p-2 transition-colors delay-[900ms] duration-300 ${i === 1 ? 'border-brand bg-brand-light/40' : 'border-line bg-white'}`} style={{ ['--d' as string]: `${i * 0.1}s` }}>
                <span className="flex h-[34px] items-center justify-center rounded-lg" style={{ background: t.bg }}>
                  <svg width="46" height="22" viewBox="0 0 46 22"><rect x="1" y="6" width="12" height="10" rx="3" fill={t.c} /><path d="M14 11 H20" stroke={t.c} strokeWidth="2" /><rect x="21" y="6" width="12" height="10" rx="3" fill={t.c} opacity=".6" /><path d="M34 11 H39" stroke={t.c} strokeWidth="2" /><circle cx="42" cy="11" r="3.5" fill={t.c} opacity=".4" /></svg>
                </span>
                <p className="mt-1.5 text-[9.5px] font-black text-ink">{t.t}</p>
                {i === 1 && <span className="tut-pop absolute right-1.5 top-1.5 flex h-[12px] w-[12px] items-center justify-center rounded-full bg-brand text-[8px] text-white" style={{ ['--d' as string]: '1s' }}>✓</span>}
              </div>
            ))}
          </div>
        )}
        {step >= 1 && (
          <>
            <div className={`absolute inset-y-0 left-0 w-[70px] border-r-2 border-line bg-white p-1.5 ${step === 1 ? 'tut-slide' : ''}`}>
              <p className="text-[8px] font-black text-ink">Udacha</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <span className="h-[14px] rounded-full bg-accent" />
                <span className="h-[14px] rounded-[4px] border-2 border-brand bg-brand-light" />
                <span className="h-[14px] rotate-45 scale-[.7] border-2 border-warm bg-[#FFEDE0]" />
                <span className="h-[14px] rounded-full bg-danger" />
              </div>
            </div>
            <div className="absolute inset-y-0 left-[70px] right-0" style={{ backgroundImage: 'radial-gradient(#E3E0F0 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
            <div className="absolute z-10 flex h-[34px] w-[80px] items-center justify-center rounded-[8px] border-2 border-brand bg-brand-light text-[9px] font-black text-ink shadow-sm"
              style={{ left: shape.x, top: shape.y, transition: 'left .75s cubic-bezier(.4,0,.2,1) .9s, top .75s cubic-bezier(.4,0,.2,1) .9s, width .3s, height .3s', ...(step === 1 ? { left: 150, top: 90 } : {}) }}>
              Contactar cliente
            </div>
            <div className="absolute left-[290px] top-[86px] flex h-[42px] w-[64px] rotate-0 items-center justify-center">
              <span className="absolute h-[36px] w-[36px] rotate-45 rounded-[4px] border-2 border-warm bg-[#FFEDE0]" />
              <span className="relative text-[8.5px] font-black text-ink">Aceitou?</span>
            </div>
            <div className="absolute left-[96px] top-[96px] flex h-[22px] w-[34px] items-center justify-center rounded-full bg-accent text-[8px] font-black text-white">Início</div>
            <svg className="absolute inset-0" width="384" height="212">
              <path d="M130 107 H150" stroke="#4A4763" strokeWidth="2" markerEnd="url(#tut-arrow)" />
              {step >= 2 && (
                <path d="M230 107 H286" stroke={BRAND} strokeWidth="3" fill="none" markerEnd="url(#tut-arrow-b)"
                  className={step === 2 ? 'tut-draw' : 'dg-flow'} style={{ ['--len' as string]: 56, ['--d' as string]: '1.4s' }} />
              )}
              {step >= 3 && <path d="M230 107 H286" stroke={BRAND} strokeWidth="3" fill="none" className="dg-flow" />}
              <defs>
                <marker id="tut-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#4A4763" /></marker>
                <marker id="tut-arrow-b" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill={BRAND} /></marker>
              </defs>
            </svg>
            {step === 2 && <span className="tut-pop absolute left-[226px] top-[103px] h-[8px] w-[8px] rounded-full bg-[#29b6f2]" style={{ ['--d' as string]: '0.8s' }} />}
            <At step={step} at={3} anim="tut-pop" d={1} className="bottom-3 right-3 flex gap-1"><Chip>⬇ PNG</Chip><Chip>⬇ SVG</Chip><Chip>⬇ .drawio</Chip></At>
          </>
        )}
      </Win>
      <Cursor step={step} paths={[
        [p(200, 180, 0), p(190, 60, 0, { click: true })],
        [p(38, 22, 0, { press: true }), p(190, 105, 900, { press: true }), p(220, 150, 1800)],
        [p(229, 107, 0), p(229, 107, 800, { press: true }), p(288, 107, 1400, { press: true }), p(300, 150, 2300)],
        [p(340, -12, 0)],
      ]} />
    </Stage>
  )
}

/* ─── Estatísticas ────────────────────────────────────────────────────── */

function Estatisticas({ step }: SceneProps) {
  const week = [40, 75, 55, 90, 62, 30, 82]
  const month = [60, 45, 88, 70, 95, 52, 74]
  const bars = step === 3 ? month : week
  const donut = [{ v: 0.45, c: BRAND }, { v: 0.3, c: ACCENT }, { v: 0.25, c: WARM }]
  const r = 30, len = 2 * Math.PI * r
  let acc = 0
  return (
    <Stage>
      <Win title="Estatísticas" head={
        <span className="flex rounded-md bg-snow p-[1px] text-[8px]">
          <span className={`rounded px-1.5 transition-colors ${step !== 3 ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>Semana</span>
          <span className={`rounded px-1.5 transition-colors delay-700 ${step === 3 ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>Mês</span>
        </span>
      }>
        <div className="absolute left-3 top-3 w-[200px]">
          <p className="text-[9px] font-black text-ink">Tempo focado por dia</p>
          <div className="mt-2 flex h-[120px] items-end gap-2 border-b-2 border-line pb-0.5">
            {bars.map((h, i) => (
              <div key={`${step === 3}-${i}`} className="tut-grow flex-1 rounded-t-md" style={{ height: `${h}%`, background: i === 3 ? BRAND : '#C9BEFF', ['--d' as string]: `${(step === 3 ? 0.9 : 0.1) + i * 0.08}s` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between px-1 text-[8px] text-muted">{'STQQSSD'.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
        </div>
        <At step={step} at={1} className="left-[226px] top-3 w-[140px]">
          <p className="text-[9px] font-black text-ink">Por categoria</p>
          <div className="mt-1 flex items-center gap-2">
            <svg width="76" height="76" viewBox="0 0 76 76">
              {donut.map((s, i) => {
                const off = acc
                acc += s.v
                return <circle key={i} cx="38" cy="38" r={r} fill="none" stroke={s.c} strokeWidth="12" strokeDasharray={`${s.v * len} ${len}`} strokeDashoffset={-off * len}
                  transform="rotate(-90 38 38)" className={step === 1 ? 'tut-draw' : ''} style={{ ['--len' as string]: s.v * len, ['--d' as string]: `${0.2 + i * 0.35}s` }} />
              })}
            </svg>
            <div className="space-y-1 text-[8px]">
              {['Trabalho', 'Estudo', 'Reuniões'].map((t, i) => <p key={t} className="flex items-center gap-1"><span className="h-[6px] w-[6px] rounded-full" style={{ background: donut[i].c }} />{t}</p>)}
            </div>
          </div>
        </At>
        <At step={step} at={2} className="bottom-3 left-[226px] w-[140px] rounded-xl border-2 border-line bg-white p-2">
          <p className="flex items-center justify-between text-[10px] font-black text-ink"><span>🔥 5 dias</span><span className="text-brand">Nível 5</span></p>
          <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-snow"><div className="tut-fill h-full w-[78%] rounded-full bg-brand" style={{ ['--d' as string]: '0.5s' }} /></div>
          <p className="mt-1 text-[8px] text-muted">780 / 1000 XP</p>
          {step === 2 && <Float d={1.4} style={{ right: 4, top: -14 }}>Nível 5!</Float>}
        </At>
      </Win>
      <Cursor step={step} paths={[
        [p(180, 160, 0), p(110, 70, 1300)],
        [p(250, 70, 0)],
        [p(300, 180, 0)],
        [p(357, -12, 0, { click: true })],
      ]} />
    </Stage>
  )
}

/* ─── Ranking ─────────────────────────────────────────────────────────── */

function Ranking({ step }: SceneProps) {
  const people = [
    { n: 'Ana Silva', pts: 840, c: PINK },
    { n: 'Rui Costa', pts: 790, c: BLUE },
    { n: 'Inês Lopes', pts: 760, c: ACCENT },
    { n: 'Tu', pts: 720, c: BRAND, me: true },
    { n: 'João Matos', pts: 610, c: WARM },
  ]
  // no passo 2, a tua linha sobe para o 2.º lugar
  const order = step >= 2 ? [0, 3, 1, 2, 4] : [0, 1, 2, 3, 4]
  const myPts = step >= 2 ? 805 : 720
  const myName = step >= 3 ? 'T. U.' : 'Tu'
  return (
    <Stage>
      <Win title="Ranking">
        <div className="absolute inset-x-3 top-2 h-[180px]">
          {people.map((x, i) => {
            const pos = order.indexOf(i)
            return (
              <div key={x.n} className={`absolute inset-x-0 flex h-[28px] items-center gap-2 rounded-lg border-2 px-2 ${step === 0 ? 'tut-slide' : ''} ${x.me ? 'border-brand bg-brand-light' : 'border-line bg-white'}`}
                style={{ top: pos * 32, transition: 'top .7s cubic-bezier(.3,1.3,.5,1)', transitionDelay: step === 2 ? '0.6s' : '0s', ['--d' as string]: `${i * 0.12}s` }}>
                <span className="w-[14px] text-[10px] font-black text-muted">{pos + 1}</span>
                <Face name={x.me ? 'T U' : x.n} color={x.c} size={18} />
                <span className="flex-1 text-[10px] font-black text-ink">{x.me ? myName : x.n}</span>
                <span className="text-[10px] font-black text-ink tabular-nums">{x.me && step === 2 ? <Ticker from={720} to={805} ms={1300} format={n => `${n}`} /> : x.me ? myPts : x.pts} pts</span>
              </div>
            )
          })}
        </div>
        <At step={step} at={1} until={1} className="right-3 top-[44px] z-20 w-[130px] rounded-xl bg-ink p-2 text-white shadow-xl" anim="tut-pop">
          <p className="text-[9px] font-black">Como ganhas pontos</p>
          {['⏱ 1 pt / 5 min de foco', '✓ 8–15 pts por tarefa', '📅 +5 dentro do prazo', '⭐ +15 aprovada à 1.ª'].map((t, i) => (
            <p key={t} className="tut-in mt-1 text-[8.5px] text-white/90" style={{ ['--d' as string]: `${0.4 + i * 0.35}s` }}>{t}</p>
          ))}
        </At>
        {step === 2 && <Float d={0.4} style={{ right: 80, top: 30 }}>+85 pts</Float>}
        <At step={step} at={3} anim="tut-up" className="inset-x-3 bottom-2 flex items-center gap-2 rounded-xl border-2 border-line bg-white p-1.5">
          <span className="text-[8.5px] text-muted">No ranking aparecer com:</span>
          <span className="flex rounded-md bg-snow p-[1px] text-[8.5px]">
            {['Nome', 'Iniciais', 'Oculto'].map(o => (
              <span key={o} className={`rounded px-1.5 py-[1px] transition-colors delay-[900ms] ${o === 'Iniciais' ? 'bg-white text-brand-dark shadow-sm' : 'text-muted'}`}>{o}</span>
            ))}
          </span>
        </At>
      </Win>
      <Cursor step={step} paths={[
        [p(300, 190, 0)],
        [p(300, 190, 0)],
        [p(330, 160, 0)],
        [p(250, 195, 0, { click: true })],
      ]} />
    </Stage>
  )
}

/* ─── Jogos ───────────────────────────────────────────────────────────── */

const GAME_TILES = [
  { t: 'Respirar', tag: 'Relaxar', c: ACCENT, bg: '#DCF7F3', g: '◎' },
  { t: 'Jogo do Galo', tag: 'Estratégia', c: BRAND, bg: '#EEEAFF', g: '✕' },
  { t: 'Sudoku', tag: 'Lógica', c: BLUE, bg: '#E6EDFF', g: '#' },
  { t: 'Cores', tag: 'Atenção', c: PINK, bg: '#FCE6F2', g: '◐' },
]
const PAIR_FACES = [DANGER, WARM, BLUE, ACCENT, BRAND, PINK, DANGER, BLUE]
/** cartas já viradas no passo 2 e quando viram (s) */
const PAIR_OPEN: Record<number, number> = { 0: 0.3, 6: 0.8, 2: 1.4, 7: 2 }

function Jogos({ step }: SceneProps) {
  return (
    <Stage>
      <Win title={step === 1 ? 'Respirar' : step === 2 ? 'Pares' : step === 3 ? 'Contas rápidas' : 'Jogos'}>
        {step === 0 && (
          <>
            <div className="absolute left-4 top-4 grid w-[220px] grid-cols-2 gap-2">
              {GAME_TILES.map((x, i) => (
                <div key={x.t} className="tut-in rounded-xl border-2 border-line bg-white p-2" style={{ ['--d' as string]: (i * 0.12) + 's' }}>
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-lg text-[13px] font-black" style={{ background: x.bg, color: x.c }}>{x.g}</span>
                  <p className="mt-1 text-[10px] font-black text-ink">{x.t}</p>
                  <Chip color={x.c} bg={x.bg}>{x.tag}</Chip>
                </div>
              ))}
            </div>
            <At step={step} at={0} anim="tut-pop" d={0.9} className="right-3 top-[34px] w-[136px] rounded-xl border-2 border-warm/40 bg-[#FFEDE0] p-2 shadow-lg">
              <p className="text-[10px] font-black text-[#DB6A1F]">Hora de pausar!</p>
              <p className="text-[8.5px] text-[#DB6A1F]/80">Focaste 25 min.</p>
              <span className="mt-1.5 block rounded-md bg-warm px-2 py-1 text-center text-[8.5px] font-black text-white">Fazer pausa</span>
              <span className="mt-1 block rounded-md bg-white px-2 py-1 text-center text-[8.5px] font-black text-[#DB6A1F]">Pausa com um minijogo</span>
            </At>
          </>
        )}
        {step === 1 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative flex h-[130px] w-[130px] items-center justify-center">
              <span className="tut-breathe absolute inset-0 rounded-full bg-accent/15" />
              <span className="tut-breathe absolute inset-[14px] rounded-full bg-gradient-to-br from-[#5EE0D2] to-accent" />
              <span className="relative text-[13px] font-black text-white">Inspira…</span>
            </div>
            <p className="mt-2 text-[9px] text-muted">inspira 4 s · segura 4 s · expira 6 s</p>
          </div>
        )}
        {step === 2 && (
          <div className="absolute left-1/2 top-[18px] grid -translate-x-1/2 grid-cols-4 gap-1.5">
            {PAIR_FACES.map((c, i) => (
              <span key={i} className="relative h-[42px] w-[42px]">
                <span className="absolute inset-0 rounded-lg border-b-2 border-brand-dark bg-brand" />
                {i in PAIR_OPEN && (
                  <span className="tut-pop absolute inset-0 flex items-center justify-center rounded-lg border-2 bg-white" style={{ borderColor: c + '55', ['--d' as string]: PAIR_OPEN[i] + 's' }}>
                    <span className="h-[14px] w-[14px] rounded-full" style={{ background: c }} />
                  </span>
                )}
              </span>
            ))}
            <span className="col-span-4 mt-1 text-center text-[9px] text-muted">2 de 8 pares · 3 jogadas</span>
          </div>
        )}
        {step === 3 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[11px] font-black text-ink">Boa cabeça!</p>
            <p className="text-[30px] font-black tabular-nums text-warm"><Ticker from={0} to={18} ms={1400} format={n => String(n)} /> certas</p>
            <span className="tut-pop mt-1 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[9px] font-black text-gold-dark" style={{ ['--d' as string]: '1.5s' }}>🏆 Novo recorde!</span>
            <p className="tut-in mt-2 text-[8.5px] text-muted" style={{ ['--d' as string]: '2s' }}>Os jogos não dão XP: são só para descansar</p>
            <Float d={1.6} style={{ right: 120, top: 40 }}>Recorde</Float>
          </div>
        )}
      </Win>
      <Cursor step={step} paths={[
        [p(150, 150, 0), p(320, 118, 1400, { click: true })],
        [p(330, 180, 0)],
        [p(110, 30, 0, { click: true }), p(290, 75, 900, { click: true }), p(200, 30, 1700, { click: true })],
        [p(330, 180, 0)],
      ]} />
    </Stage>
  )
}

/* ─── Equipa ──────────────────────────────────────────────────────────── */

function Equipa({ step }: SceneProps) {
  const team = [['Ana Silva', PINK], ['Rui Costa', BLUE], ['Inês Lopes', ACCENT], ['João Matos', WARM]] as const
  return (
    <Stage>
      <Win title={['Funcionários', 'Departamentos', 'Tarefas da equipa', 'Relatórios'][step] ?? 'Empresa'}
        head={step === 0 ? <Chip color="#fff" bg={BRAND} className="tut-glow">+ Convidar para a equipa</Chip> : undefined}>
        {step === 0 && (
          <>
            <div className="absolute inset-x-3 top-3 space-y-1.5">
              {team.slice(0, 3).map(([n, c]) => (
                <Row key={n} className="h-[26px]"><Face name={n} color={c} /><span className="flex-1 text-[9.5px] text-ink">{n}</span><Chip>Membro</Chip></Row>
              ))}
            </div>
            <div className="tut-pop absolute left-[100px] top-[40px] w-[190px] rounded-xl bg-white p-2.5 shadow-2xl" style={{ ['--d' as string]: '0.9s' }}>
              <p className="text-[11px] font-black text-ink">Convidar para a equipa</p>
              <p className="mt-1 rounded-md border-2 border-accent px-1.5 py-1 text-[9px] text-ink"><Typed text="joao@empresa.pt" d={1.4} /></p>
              <div className="mt-1.5 flex justify-between"><Chip>🔗 Copiar link de convite</Chip><Chip color="#fff" bg={BRAND}>Convidar</Chip></div>
            </div>
          </>
        )}
        {step === 1 && (
          <div className="absolute inset-x-3 top-3 grid grid-cols-2 gap-3">
            {[{ t: 'Vendas', c: WARM, who: [0, 3] }, { t: 'Operações', c: ACCENT, who: [1, 2] }].map((d, k) => (
              <div key={d.t} className="tut-in rounded-xl border-2 bg-white p-2" style={{ borderColor: d.c, ['--d' as string]: `${k * 0.2}s` }}>
                <p className="text-[10px] font-black" style={{ color: d.c }}>{d.t}</p>
                <p className="text-[8px] text-muted">Chefe: {team[d.who[0]][0]}</p>
                <div className="mt-2 space-y-1">
                  {d.who.map((w, i) => (
                    <div key={w} className="tut-up flex items-center gap-1.5 rounded-md bg-snow px-1.5 py-1" style={{ ['--d' as string]: `${0.6 + (k * 2 + i) * 0.35}s` }}>
                      <Face name={team[w][0]} color={team[w][1]} /><span className="text-[9px] text-ink">{team[w][0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="absolute inset-x-3 top-3 space-y-1.5">
            {[['Relatório mensal', 0], ['Visita ao cliente', 1]].map(([t, w], i) => (
              <Row key={t as string} className="tut-in h-[30px]" >
                <Check on={i === 0} color={ACCENT} />
                <span className="flex-1 text-[9.5px] text-ink">{t}</span>
                <Face name={team[w as number][0]} color={team[w as number][1]} />
                {i === 0 ? (
                  <>
                    <span className="relative inline-flex">
                      <Chip color={WARM} bg="#FFEDE0" className="w-[62px] justify-center whitespace-nowrap">Por rever</Chip>
                      <Chip color="#fff" bg={ACCENT} className="tut-pop absolute inset-0 w-[62px] justify-center whitespace-nowrap" style={{ ['--d' as string]: '1.2s' }}>Aprovada ✓</Chip>
                    </span>
                    <Chip color="#fff" bg={BRAND}>Aprovar</Chip>
                  </>
                ) : <Chip>Em curso</Chip>}
              </Row>
            ))}
            <Float d={1.5} style={{ left: 120, top: -12 }}>+15 pts para a Ana</Float>
          </div>
        )}
        {step === 3 && (
          <div className="absolute inset-3 grid grid-cols-[1fr_120px] gap-3">
            <div className="rounded-xl border-2 border-line bg-white p-2">
              <p className="text-[9px] font-black text-ink">Horas de foco da equipa</p>
              <svg viewBox="0 0 200 100" className="mt-1 w-full">
                <path d="M0 80 L33 62 L66 70 L100 40 L133 48 L166 22 L200 30" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" className="tut-draw" style={{ ['--len' as string]: 260 }} />
                <path d="M0 90 L33 82 L66 76 L100 70 L133 60 L166 58 L200 50" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" className="tut-draw" style={{ ['--len' as string]: 220, ['--d' as string]: '0.4s' }} />
              </svg>
            </div>
            <div className="space-y-1.5 rounded-xl border-2 border-line bg-white p-2">
              <p className="text-[9px] font-black text-ink">Presença agora</p>
              {team.map(([n], i) => (
                <p key={n} className="tut-in flex items-center gap-1.5 text-[8.5px]" style={{ ['--d' as string]: `${0.3 + i * 0.2}s` }}>
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: i === 3 ? '#A3A0B8' : i === 1 ? GOLD : ACCENT }} />{n.split(' ')[0]}
                  <span className="ml-auto text-muted">{i === 3 ? 'offline' : i === 1 ? 'pausa' : 'a trabalhar'}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </Win>
      <Cursor step={step} paths={[
        [p(200, 180, 0), p(330, -12, 0, { click: true }), p(260, 80, 1300)],
        [p(300, 190, 0)],
        [p(250, 150, 0), p(353, 18, 0, { click: true })],
        [p(300, 190, 0)],
      ]} />
    </Stage>
  )
}

export const SCENES: Record<LessonId, (props: SceneProps) => ReactNode> = {
  inicio: Inicio,
  tarefas: Tarefas,
  foco: Foco,
  calendario: Calendario,
  quadros: Quadros,
  planilhas: Planilhas,
  diagramas: Diagramas,
  estatisticas: Estatisticas,
  ranking: Ranking,
  jogos: Jogos,
  equipa: Equipa,
}
