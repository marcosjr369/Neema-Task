/**
 * Udacha, a mascote da app: personagem ilustrada, de corpo inteiro, com poses animadas.
 * As animações vivem em globals.css (classes mk-*) e respeitam prefers-reduced-motion.
 *
 * Os ângulos de cada pose vão em style (e não no atributo transform) para o CSS os poder
 * interpolar: ao trocar de pose, braços, cabeça e puffs deslizam com efeito de mola.
 * Por dentro de cada articulação há um segundo <g> com o movimento contínuo da pose.
 *
 * Abaixo de 64px mostra só o busto (cabeça e ombros), para caber em ícones e barras.
 */

import type { CSSProperties } from 'react'

export type MascotMood = 'happy' | 'excited' | 'sleepy' | 'sad' | 'thinking'
export type MascotPose = 'idle' | 'wave' | 'thumbs' | 'peace' | 'think' | 'jump' | 'dance' | 'walk' | 'celebrate' | 'sad'
export type MascotOutfit = 'cardigan' | 'casual'

type Props = {
  size?: number
  className?: string
  mood?: MascotMood
  /** pose do corpo; por omissão deduz-se de mood/wave/bounce */
  pose?: MascotPose
  /** casaco amarelo com blusa florida (por omissão) ou blusa branca de folhos com calças azuis */
  outfit?: MascotOutfit
  /** viva: respira, pisca os olhos, olha à volta e mexe-se */
  animated?: boolean
  /** atalho: pose "wave" */
  wave?: boolean
  /** atalho: pose "celebrate" (pula sem parar) */
  bounce?: boolean
  /** mexe a boca (enquanto o balão de fala escreve) */
  talking?: boolean
}

const C = {
  skin: '#74452A',
  skinDark: '#56321F',
  skinShine: '#8E5A3A',
  blush: '#D9776B',
  hair: '#17110E',
  hairLight: '#3A2C25',
  eye: '#120C0A',
  lip: '#8E4A40',
  mouth: '#3A1E18',
  tongue: '#E8838A',
  gold: '#E2A72E',
  scrunchie: '#F4F4F6',
  scrunchieEdge: '#C9CCD3',
  petal: '#F7C51E',
  petalDark: '#E0A800',
  flower: '#7A4416',
  cardigan: '#E4A72C',
  cardiganDark: '#C48A17',
  floral: '#FFF7F2',
  button: '#8B5A33',
  pink: '#F2B8CB',
  pinkDark: '#E297B0',
  blouse: '#FBFBFD',
  blouseEdge: '#DADDE3',
  trim: '#26262B',
  denim: '#2D5D8A',
  denimLight: '#8FB3D6',
  sneaker: '#F472B6',
  sneakerDark: '#DB4F98',
  sole: '#F4F4F5',
  bracelet: '#3B82F6',
  zzz: '#7B61FF',
}

/** Ângulos (graus) de cada pose: braço (lu/ru) no ombro, antebraço (lf/rf) no cotovelo, cabeça */
const POSES: Record<MascotPose, { lu: number; lf: number; ru: number; rf: number; head: number }> = {
  idle: { lu: 8, lf: -6, ru: -8, rf: 6, head: 0 },
  wave: { lu: 8, lf: -6, ru: -150, rf: -12, head: -4 },
  thumbs: { lu: 8, lf: -6, ru: -35, rf: -120, head: 3 },
  peace: { lu: 8, lf: -6, ru: -28, rf: -128, head: 7 },
  think: { lu: 6, lf: -4, ru: 34, rf: 118, head: -7 },
  jump: { lu: 140, lf: 12, ru: -140, rf: -12, head: 0 },
  dance: { lu: 125, lf: 20, ru: -40, rf: -60, head: 4 },
  walk: { lu: 10, lf: -10, ru: -10, rf: 10, head: 0 },
  celebrate: { lu: 155, lf: 8, ru: -155, rf: -8, head: 0 },
  sad: { lu: 2, lf: 0, ru: -2, rf: 0, head: 9 },
}

type Motion = {
  body?: string
  head?: string
  /** puffs de cabelo: ficam para trás e balançam com o corpo */
  puff?: string
  lu?: string
  ru?: string
  rf?: string
  ll?: string
  rl?: string
  shadow?: string
}

/** Movimento contínuo de cada pose (classes em globals.css) */
const MOTION: Partial<Record<MascotPose, Motion>> = {
  idle: { body: 'mk-breathe', head: 'mk-head-idle', puff: 'mk-puff-sway' },
  wave: { body: 'mk-breathe', head: 'mk-head-bob', puff: 'mk-puff-sway', rf: 'mk-wave' },
  thumbs: { body: 'mk-breathe', head: 'mk-head-idle', puff: 'mk-puff-sway', ru: 'mk-pump' },
  peace: { body: 'mk-breathe', head: 'mk-head-idle', puff: 'mk-puff-sway', rf: 'mk-peace' },
  think: { body: 'mk-breathe', head: 'mk-head-think', puff: 'mk-puff-sway' },
  sad: { body: 'mk-breathe mk-slow' },
  jump: { body: 'mk-jump', puff: 'mk-puff-jump', shadow: 'mk-shadow-jump' },
  celebrate: { body: 'mk-bounce', puff: 'mk-puff-bounce', shadow: 'mk-shadow-bounce', lu: 'mk-cheer-l', ru: 'mk-cheer-r' },
  dance: { body: 'mk-dance', head: 'mk-head-dance', puff: 'mk-puff-dance', lu: 'mk-dance-l', ru: 'mk-dance-r', ll: 'mk-step-l', rl: 'mk-step-r' },
  walk: { body: 'mk-walk', head: 'mk-head-walk', puff: 'mk-puff-walk', lu: 'mk-swing-l', ru: 'mk-swing-r', ll: 'mk-stride-l', rl: 'mk-stride-r' },
}

/** Rotação animável por CSS (classe mk-joint dá a transição com mola) */
function joint(deg: number, x: number, y: number): CSSProperties {
  return { transform: `rotate(${deg}deg)`, transformOrigin: `${x}px ${y}px` }
}

function Face({ mood, pose, talking, live }: { mood: MascotMood; pose: MascotPose; talking: boolean; live: boolean }) {
  const sad = mood === 'sad' || pose === 'sad'
  const thinking = mood === 'thinking' || pose === 'think'
  const look = thinking ? { x: -1.6, y: -2 } : { x: 0, y: 0 }
  const brow = { stroke: C.hair, strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const }
  return (
    <g>
      {/* brilho na testa e bochechas */}
      <ellipse cx="100" cy="42" rx="12" ry="4" fill={C.skinShine} opacity="0.55" />
      <ellipse cx="79" cy="78" rx="6" ry="3.5" fill={C.blush} opacity="0.35" />
      <ellipse cx="121" cy="78" rx="6" ry="3.5" fill={C.blush} opacity="0.35" />

      {/* sobrancelhas */}
      {sad ? (
        <>
          <path d="M81 49 Q87 50.5 93 53.5" {...brow} />
          <path d="M107 53.5 Q113 50.5 119 49" {...brow} />
        </>
      ) : thinking ? (
        <>
          <path d="M81 48 Q87 44 93 47.5" {...brow} />
          <path d="M107 50.5 Q113 49.5 119 51" {...brow} />
        </>
      ) : (
        <>
          <path d="M81 50.5 Q87 46.5 93 49" {...brow} />
          <path d="M107 49 Q113 46.5 119 50.5" {...brow} />
        </>
      )}

      {/* olhos */}
      {mood === 'sleepy' ? (
        <>
          <path d="M82 63 Q87 67 92 63" stroke={C.eye} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M108 63 Q113 67 118 63" stroke={C.eye} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M82.5 64 l-3 1.4 M117.5 64 l3 1.4" stroke={C.eye} strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : mood === 'excited' ? (
        <>
          <path d="M82 64 Q87 56.5 92 64" stroke={C.eye} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M108 64 Q113 56.5 118 64" stroke={C.eye} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M82 61 l-3.4 -2 M118 61 l3.4 -2" stroke={C.eye} strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <g className={live ? 'mk-blink' : undefined}>
          <g className={live && !thinking && !sad ? 'mk-look' : undefined}>
            <ellipse cx={87 + look.x} cy={62 + look.y} rx="5" ry="6" fill={C.eye} />
            <ellipse cx={113 + look.x} cy={62 + look.y} rx="5" ry="6" fill={C.eye} />
            <circle cx={88.8 + look.x} cy={59.6 + look.y} r="1.8" fill="#fff" />
            <circle cx={114.8 + look.x} cy={59.6 + look.y} r="1.8" fill="#fff" />
            <circle cx={85.6 + look.x} cy={64.6 + look.y} r="0.8" fill="#fff" opacity="0.8" />
            <circle cx={111.6 + look.x} cy={64.6 + look.y} r="0.8" fill="#fff" opacity="0.8" />
          </g>
          {/* pestanas */}
          <path d="M82.6 58.4 l-3.2 -2.4 M82 61.6 l-3.8 -0.8 M117.4 58.4 l3.2 -2.4 M118 61.6 l3.8 -0.8" stroke={C.eye} strokeWidth="1.7" strokeLinecap="round" />
        </g>
      )}

      {/* nariz */}
      <path d="M95.5 75.5 Q100 79 104.5 75.5" stroke={C.skinDark} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* boca */}
      {talking ? (
        <g className="mk-talk">
          <ellipse cx="100" cy="89" rx="5.2" ry="4.2" fill={C.mouth} stroke={C.lip} strokeWidth="1.6" />
          <ellipse cx="100" cy="91" rx="2.6" ry="1.4" fill={C.tongue} />
        </g>
      ) : mood === 'excited' ? (
        <g>
          <path d="M89.5 85.5 Q100 100 110.5 85.5 Z" fill={C.mouth} stroke={C.lip} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M94 86.3 L106 86.3 L105 88.4 L95 88.4 Z" fill="#fff" />
          <path d="M95 93.5 Q100 96.5 105 93.5 Q100 92 95 93.5 Z" fill={C.tongue} />
        </g>
      ) : sad ? (
        <path d="M92.5 92 Q100 86.5 107.5 92" stroke={C.lip} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      ) : thinking ? (
        // biquinho, como nas fotos
        <g>
          <ellipse cx="103" cy="89.5" rx="3.8" ry="3.2" fill={C.lip} />
          <ellipse cx="103" cy="89.5" rx="1.4" ry="1" fill={C.mouth} />
        </g>
      ) : (
        <g>
          <path d="M90 86 Q100 96 110 86 Q100 90.5 90 86 Z" fill={C.lip} stroke={C.lip} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M96 90.6 Q100 91.6 104 90.6" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.35" fill="none" />
        </g>
      )}

      {sad && (
        <>
          <path d="M82 69 q-3 5 0 7 q3 -2 0 -7z" fill="#4CC9F0" className={live ? 'mk-tear' : undefined} />
          <path d="M118 69 q-3 5 0 7 q3 -2 0 -7z" fill="#4CC9F0" className={live ? 'mk-tear mk-tear-late' : undefined} />
        </>
      )}
    </g>
  )
}

/** Um puff de cabelo afro: círculo central com rebordo encaracolado */
function Puff({ cx, cy }: { cx: number; cy: number }) {
  const curls = Array.from({ length: 11 }, (_, k) => {
    const a = (k / 11) * Math.PI * 2
    return { x: cx + Math.cos(a) * 14.5, y: cy + Math.sin(a) * 14.5 }
  })
  return (
    <g>
      <circle cx={cx} cy={cy} r="16" fill={C.hair} />
      {curls.map((p, k) => <circle key={k} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="6.4" fill={C.hair} />)}
      <path
        d={`M${cx - 8} ${cy - 3} q3 -4 6 0 M${cx + 1} ${cy - 9} q3 -3 6 1 M${cx + 3} ${cy + 4} q3 -4 6 0 M${cx - 6} ${cy + 7} q3 -3 5 1`}
        stroke={C.hairLight}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  )
}

function Sunflower({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, k) => (
        <ellipse key={k} cx={x} cy={y - 6} rx="2.5" ry="4.8" fill={k % 2 ? C.petalDark : C.petal} transform={`rotate(${k * 30} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r="4" fill={C.flower} />
      <circle cx={x - 1.2} cy={y - 1} r="0.8" fill="#A36A33" />
      <circle cx={x + 1.3} cy={y + 0.6} r="0.8" fill="#A36A33" />
    </g>
  )
}

function Head({ mood, pose, talking, live, puff }: { mood: MascotMood; pose: MascotPose; talking: boolean; live: boolean; puff?: string }) {
  // tristeza: os puffs descaem
  const droop = mood === 'sad' || pose === 'sad' ? 16 : mood === 'sleepy' ? 7 : 0
  return (
    <g>
      <rect x="91" y="88" width="18" height="20" rx="4" fill={C.skinDark} />

      {/* puffs (atrás da cabeça, presos por elásticos) */}
      <g className="mk-joint" style={joint(-droop, 76, 38)}>
        <g className={`mk-puff-l ${puff ?? ''}`}><Puff cx={58} cy={22} /></g>
      </g>
      <g className="mk-joint" style={joint(droop, 124, 38)}>
        <g className={`mk-puff-r ${puff ?? ''}`}><Puff cx={142} cy={22} /></g>
      </g>

      {/* orelhas com argolas douradas */}
      <ellipse cx="67" cy="64" rx="6" ry="8" fill={C.skin} />
      <ellipse cx="67" cy="64" rx="3" ry="5" fill={C.skinDark} />
      <ellipse cx="133" cy="64" rx="6" ry="8" fill={C.skin} />
      <ellipse cx="133" cy="64" rx="3" ry="5" fill={C.skinDark} />
      <circle cx="66" cy="75" r="4.2" fill="none" stroke={C.gold} strokeWidth="2.2" className={live ? 'mk-ear-l' : undefined} />
      <circle cx="134" cy="75" r="4.2" fill="none" stroke={C.gold} strokeWidth="2.2" className={live ? 'mk-ear-r' : undefined} />

      {/* rosto */}
      <path d="M68 60 Q68 26 100 26 Q132 26 132 60 Q132 85 120 96 Q110 104 100 104 Q90 104 80 96 Q68 85 68 60 Z" fill={C.skin} />

      {/* cabelo puxado para trás, rente à cabeça */}
      <path d="M65 62 Q59 20 100 16 Q141 20 135 62 Q132 49 125 43 Q113 35.5 100 37 Q87 35.5 75 43 Q68 49 65 62 Z" fill={C.hair} />
      <path d="M80 26 q4 -3 8 0 M100 21 q4 -3 8 0 M114 27 q4 -3 8 0 M88 32 q4 -3 8 0" stroke={C.hairLight} strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* elástico à esquerda, girassol à direita */}
      <ellipse cx="73" cy="34" rx="6.5" ry="4" fill={C.scrunchie} stroke={C.scrunchieEdge} strokeWidth="1.2" transform="rotate(-42 73 34)" />
      <path d="M70 31.5 l2 4 M74 30 l1.6 4.4" stroke={C.scrunchieEdge} strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="127" cy="34" rx="6.5" ry="4" fill={C.scrunchie} stroke={C.scrunchieEdge} strokeWidth="1.2" transform="rotate(42 127 34)" />
      <Sunflower x={129} y={33} />

      <Face mood={mood} pose={pose} talking={talking} live={live} />
    </g>
  )
}

const TORSO = 'M60 112 Q100 100 140 112 Q150 116 150 130 L141 186 Q100 194 59 186 L50 130 Q50 116 60 112 Z'

function Torso({ outfit }: { outfit: MascotOutfit }) {
  if (outfit === 'casual') {
    return (
      <g>
        <path d={TORSO} fill={C.blouse} stroke={C.blouseEdge} strokeWidth="1.5" />
        <path d="M89 103 Q100 112 111 103 L100 116 Z" fill={C.skinDark} />
        {/* carcela com botões */}
        <line x1="100" y1="114" x2="100" y2="190" stroke={C.blouseEdge} strokeWidth="1.6" />
        {[128, 144, 160, 176].map(y => <circle key={y} cx="103" cy={y} r="1.7" fill={C.blouseEdge} />)}
        {/* gola grande de folhos com debrum escuro */}
        <path d="M100 114 Q88 104 86 103 Q72 107 64 118 Q80 127 100 114 Z" fill={C.blouse} stroke={C.trim} strokeWidth="1.6" strokeDasharray="2.6 1.4" strokeLinejoin="round" />
        <path d="M100 114 Q112 104 114 103 Q128 107 136 118 Q120 127 100 114 Z" fill={C.blouse} stroke={C.trim} strokeWidth="1.6" strokeDasharray="2.6 1.4" strokeLinejoin="round" />
      </g>
    )
  }
  return (
    <g>
      <path d={TORSO} fill={C.cardigan} />
      {/* blusa florida por baixo do casaco aberto */}
      <path d="M84 104 Q100 113 116 104 L108 190 Q100 191 92 190 Z" fill={C.floral} />
      {([[95, 121, '#E85D8A'], [105, 133, '#E0453A'], [96, 147, '#C04BA8'], [104, 161, '#E85D8A'], [97, 175, '#E0453A']] as const).map(([x, y, c]) => (
        <g key={y}>
          <ellipse cx={x + 3.4} cy={y + 1.5} rx="2.2" ry="1.1" fill="#4FA36A" transform={`rotate(30 ${x + 3.4} ${y + 1.5})`} />
          <circle cx={x} cy={y} r="2.6" fill={c} />
          <circle cx={x} cy={y} r="0.9" fill="#FFE08A" />
        </g>
      ))}
      {/* colar com pingente azul */}
      <path d="M90.5 105 Q100 119 109.5 105" stroke={C.gold} strokeWidth="1" fill="none" />
      <circle cx="100" cy="117" r="2.6" fill="#2E7FD8" />
      <circle cx="100" cy="117" r="1.2" fill="#fff" />
      <circle cx="100" cy="117" r="0.55" fill="#12324F" />
      {/* frentes do casaco, botões e barra canelada */}
      <path d="M84 104 L92 190" stroke={C.cardiganDark} strokeWidth="3" strokeLinecap="round" />
      <path d="M116 104 L108 190" stroke={C.cardiganDark} strokeWidth="3" strokeLinecap="round" />
      {[[87.6, 141], [89.4, 158], [91, 174]].map(([x, y]) => (
        <g key={y}>
          <circle cx={x} cy={y} r="2.9" fill={C.button} />
          <circle cx={x - 0.8} cy={y} r="0.5" fill={C.cardiganDark} />
          <circle cx={x + 0.8} cy={y} r="0.5" fill={C.cardiganDark} />
        </g>
      ))}
      <path d="M56 177 Q74 182 92 183 L92 190 Q74 190 59 186 Z" fill={C.cardiganDark} />
      <path d="M144 177 Q126 182 108 183 L108 190 Q126 190 141 186 Z" fill={C.cardiganDark} />
    </g>
  )
}

function Leg({ side, outfit, motion }: { side: 'l' | 'r'; outfit: MascotOutfit; motion?: string }) {
  const x = side === 'l' ? 78 : 103
  const shoeX = side === 'l' ? 85 : 115
  const casual = outfit === 'casual'
  return (
    <g className={motion}>
      <rect x={x} y="166" width="19" height="72" rx="8" fill={casual ? C.denim : C.pink} />
      {casual ? (
        // padrão de caxemira (aproximado com gotas)
        [[5, 184], [13, 198], [6, 212], [13, 226]].map(([dx, y]) => (
          <ellipse key={y} cx={x + dx} cy={y} rx="2.6" ry="1.7" fill="none" stroke={C.denimLight} strokeWidth="1.1" transform={`rotate(-30 ${x + dx} ${y})`} />
        ))
      ) : (
        <line x1={x + 9.5} y1="184" x2={x + 9.5} y2="232" stroke={C.pinkDark} strokeWidth="1.2" />
      )}
      {/* ténis */}
      <ellipse cx={shoeX} cy="240" rx="15" ry="8" fill={casual ? C.sneaker : '#FFFFFF'} stroke={casual ? C.sneakerDark : '#E4E4E7'} strokeWidth="1.2" />
      {!casual && <path d={`M${shoeX - 9} 238 Q${shoeX} 233 ${shoeX + 9} 238`} stroke={C.sneaker} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      <path d={`M${shoeX - 15} 241 Q${shoeX} 249 ${shoeX + 15} 241 L${shoeX + 14} 244 Q${shoeX} 251 ${shoeX - 14} 244 Z`} fill={C.sole} />
    </g>
  )
}

function Arm({
  side, outfit, upper, fore, upperMotion, foreMotion, hand,
}: {
  side: 'l' | 'r'
  outfit: MascotOutfit
  upper: number
  fore: number
  upperMotion?: string
  foreMotion?: string
  hand?: 'thumb' | 'peace'
}) {
  const sx = side === 'l' ? 64 : 136
  const casual = outfit === 'casual'
  const sleeve = casual ? C.blouse : C.cardigan
  const edge = casual ? C.blouseEdge : C.cardiganDark
  return (
    <g className="mk-joint" style={joint(upper, sx, 118)}>
      <g className={upperMotion}>
        <rect x={sx - 9} y="110" width="18" height="38" rx="9" fill={sleeve} stroke={edge} strokeWidth="1.5" />
        {/* manga de balão */}
        {casual && <ellipse cx={sx} cy="120" rx="11.5" ry="11" fill={C.blouse} stroke={C.blouseEdge} strokeWidth="1.5" />}
        <g className="mk-joint" style={joint(fore, sx, 144)}>
          <g className={foreMotion}>
            <rect x={sx - 9} y="138" width="18" height="33" rx="9" fill={casual ? C.skin : sleeve} stroke={casual ? C.skinDark : edge} strokeWidth="1.5" />
            {/* cotovelo: tapa a junção quando o braço dobra (na blusa é o fim da manga) */}
            <circle cx={sx} cy="144" r={casual ? 9.6 : 8.2} fill={sleeve} stroke={casual ? C.blouseEdge : undefined} strokeWidth="1.5" />
            {casual
              ? side === 'r' && <rect x={sx - 8.5} y="159" width="17" height="4.5" rx="2" fill={C.bracelet} />
              : <rect x={sx - 8.5} y="162" width="17" height="7" rx="3" fill={C.cardiganDark} />}
            {hand === 'peace' && (
              <>
                <rect x={sx - 7.5} y="176" width="6.4" height="21" rx="3.2" fill={C.skin} stroke={C.skinDark} strokeWidth="1.2" transform={`rotate(12 ${sx - 4} 180)`} />
                <rect x={sx + 1} y="176" width="6.4" height="21" rx="3.2" fill={C.skin} stroke={C.skinDark} strokeWidth="1.2" transform={`rotate(-12 ${sx + 4} 180)`} />
              </>
            )}
            <circle cx={sx} cy="176" r="9.2" fill={C.skin} />
            {hand === 'peace' && <path d={`M${sx - 5} 174 Q${sx} 178 ${sx + 5} 174`} stroke={C.skinDark} strokeWidth="1.3" fill="none" strokeLinecap="round" />}
            {hand === 'thumb' && <rect x={sx + 1.5} y="174" width="7.5" height="18" rx="3.7" fill={C.skin} stroke={C.skinDark} strokeWidth="1.2" />}
          </g>
        </g>
      </g>
    </g>
  )
}

/** Zzz a subir quando tem sono */
function Sleepy({ live }: { live: boolean }) {
  return (
    <g fill={C.zzz} fontWeight="900" fontFamily="inherit">
      <text x="146" y="40" fontSize="11" className={live ? 'mk-zzz' : undefined}>z</text>
      <text x="156" y="27" fontSize="14" className={live ? 'mk-zzz mk-zzz-2' : undefined}>z</text>
      <text x="168" y="12" fontSize="17" className={live ? 'mk-zzz mk-zzz-3' : undefined}>z</text>
    </g>
  )
}

export default function Mascot({
  size = 80, className = '', mood = 'happy', pose, outfit = 'cardigan', animated = false, wave = false, bounce = false, talking = false,
}: Props) {
  const resolved: MascotPose =
    pose ?? (bounce ? 'celebrate' : wave ? 'wave' : mood === 'sad' ? 'sad' : mood === 'thinking' ? 'think' : 'idle')
  const live = animated || !!pose || bounce || wave
  const angles = POSES[resolved]
  const base = live ? MOTION[resolved] ?? {} : {}
  // com sono: respira devagar e os puffs quase não mexem
  const motion: Motion = mood === 'sleepy' && base.body === 'mk-breathe' ? { ...base, body: 'mk-breathe mk-slow', head: undefined, puff: undefined } : base
  const bust = size < 64

  if (bust) {
    // ícones pequenos: só cabeça e ombros
    return (
      <svg width={size} height={size} viewBox="36 2 128 128" className={className} aria-hidden>
        <Torso outfit={outfit} />
        <Head mood={mood} pose={resolved} talking={talking} live={live} puff={motion.puff} />
      </svg>
    )
  }

  return (
    <svg width={Math.round((size * 200) / 260)} height={size} viewBox="0 0 200 260" className={className} aria-hidden overflow="visible">
      <ellipse cx="100" cy="250" rx="46" ry="6" fill="#000" opacity="0.1" className={motion.shadow} />
      <g className={motion.body}>
        <Leg side="l" outfit={outfit} motion={motion.ll} />
        <Leg side="r" outfit={outfit} motion={motion.rl} />
        <Torso outfit={outfit} />
        <g className="mk-joint" style={joint(angles.head, 100, 104)}>
          <g className={motion.head}>
            <Head mood={mood} pose={resolved} talking={talking} live={live} puff={motion.puff} />
          </g>
        </g>
        <Arm side="l" outfit={outfit} upper={angles.lu} fore={angles.lf} upperMotion={motion.lu} />
        <Arm
          side="r"
          outfit={outfit}
          upper={angles.ru}
          fore={angles.rf}
          upperMotion={motion.ru}
          foreMotion={motion.rf}
          hand={resolved === 'thumbs' ? 'thumb' : resolved === 'peace' ? 'peace' : undefined}
        />
      </g>
      {mood === 'sleepy' && <Sleepy live={live} />}
    </svg>
  )
}
