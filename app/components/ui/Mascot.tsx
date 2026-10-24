/**
 * Marcos, a mascote da app: personagem ilustrada, de corpo inteiro, com poses animadas.
 * As animações vivem em globals.css (classes mk-*) e respeitam prefers-reduced-motion.
 *
 * Abaixo de 64px mostra só o busto (cabeça e ombros), para caber em ícones e barras.
 */

export type MascotMood = 'happy' | 'excited' | 'sleepy' | 'sad' | 'thinking'
export type MascotPose = 'idle' | 'wave' | 'thumbs' | 'think' | 'jump' | 'dance' | 'walk' | 'celebrate' | 'sad'
export type MascotOutfit = 'suit' | 'casual'

type Props = {
  size?: number
  className?: string
  mood?: MascotMood
  /** pose do corpo; por omissão deduz-se de mood/wave/bounce */
  pose?: MascotPose
  /** fato (por omissão) ou camisa e calças azul-claras com ténis */
  outfit?: MascotOutfit
  /** vivo: respira, pisca os olhos e mexe-se */
  animated?: boolean
  /** atalho: pose "wave" */
  wave?: boolean
  /** atalho: pose "celebrate" (pula sem parar) */
  bounce?: boolean
  /** mexe a boca (enquanto o balão de fala escreve) */
  talking?: boolean
}

const C = {
  skin: '#8A5A3B',
  skinDark: '#6B432B',
  hair: '#1E1916',
  mouth: '#3A2218',
  suit: '#262A31',
  suitLight: '#373C46',
  suitDark: '#17191D',
  shirt: '#FFFFFF',
  tie: '#2E5CA8',
  tieDark: '#204587',
  casual: '#C9DBEF',
  casualDark: '#A6BFDC',
  shoe: '#18181B',
  sole: '#F4F4F5',
  watch: '#111111',
  dial: '#3B5B8C',
}

/** Ângulos (graus) de cada pose: braço (lu/ru) no ombro, antebraço (lf/rf) no cotovelo, cabeça */
const POSES: Record<MascotPose, { lu: number; lf: number; ru: number; rf: number; head: number }> = {
  idle: { lu: 8, lf: -6, ru: -8, rf: 6, head: 0 },
  wave: { lu: 8, lf: -6, ru: -150, rf: -12, head: -3 },
  thumbs: { lu: 8, lf: -6, ru: -35, rf: -120, head: 3 },
  think: { lu: 6, lf: -4, ru: 34, rf: 118, head: -7 },
  jump: { lu: 140, lf: 12, ru: -140, rf: -12, head: 0 },
  dance: { lu: 125, lf: 20, ru: -40, rf: -60, head: 4 },
  walk: { lu: 10, lf: -10, ru: -10, rf: 10, head: 0 },
  celebrate: { lu: 155, lf: 8, ru: -155, rf: -8, head: 0 },
  sad: { lu: 2, lf: 0, ru: -2, rf: 0, head: 9 },
}

/** Movimento contínuo de cada pose (classes em globals.css) */
const MOTION: Partial<Record<MascotPose, { body?: string; lu?: string; ru?: string; rf?: string; ll?: string; rl?: string; shadow?: string }>> = {
  idle: { body: 'mk-breathe' },
  wave: { body: 'mk-breathe', rf: 'mk-wave' },
  thumbs: { body: 'mk-breathe' },
  think: { body: 'mk-breathe' },
  sad: { body: 'mk-breathe' },
  jump: { body: 'mk-jump', shadow: 'mk-shadow-jump' },
  celebrate: { body: 'mk-bounce', shadow: 'mk-shadow-bounce', lu: 'mk-cheer-l', ru: 'mk-cheer-r' },
  dance: { body: 'mk-dance', lu: 'mk-dance-l', ru: 'mk-dance-r', ll: 'mk-step-l', rl: 'mk-step-r' },
  walk: { body: 'mk-walk', lu: 'mk-swing-l', ru: 'mk-swing-r', ll: 'mk-stride-l', rl: 'mk-stride-r' },
}

function Face({ mood, pose, talking, live }: { mood: MascotMood; pose: MascotPose; talking: boolean; live: boolean }) {
  const sad = mood === 'sad' || pose === 'sad'
  const thinking = mood === 'thinking' || pose === 'think'
  const look = thinking ? { x: -1.6, y: -2 } : { x: 0, y: 0 }
  return (
    <g>
      {/* sobrancelhas */}
      {sad ? (
        <>
          <path d="M80 48 Q87 50 94 53" stroke={C.hair} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M106 53 Q113 50 120 48" stroke={C.hair} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        </>
      ) : thinking ? (
        <>
          <path d="M80 47 Q87 43 94 47" stroke={C.hair} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M106 50 Q113 49 120 51" stroke={C.hair} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M80 50 Q87 45 94 48" stroke={C.hair} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M106 48 Q113 45 120 50" stroke={C.hair} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* olhos */}
      {mood === 'sleepy' ? (
        <>
          <path d="M82 62 Q87 66 92 62" stroke={C.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M108 62 Q113 66 118 62" stroke={C.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'excited' ? (
        <>
          <path d="M82 63 Q87 56 92 63" stroke={C.hair} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path d="M108 63 Q113 56 118 63" stroke={C.hair} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <g className={live ? 'mk-blink' : undefined}>
          <ellipse cx={87 + look.x} cy={61 + look.y} rx="4.3" ry="5.3" fill={C.hair} />
          <ellipse cx={113 + look.x} cy={61 + look.y} rx="4.3" ry="5.3" fill={C.hair} />
          <circle cx={88.6 + look.x} cy={59 + look.y} r="1.5" fill="#fff" />
          <circle cx={114.6 + look.x} cy={59 + look.y} r="1.5" fill="#fff" />
        </g>
      )}

      {/* nariz e bigode fino */}
      <path d="M96 76 Q100 79 104 76" stroke={C.skinDark} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M91 82.5 Q100 79.5 109 82.5" stroke={C.hair} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.75" />

      {/* boca */}
      {talking ? (
        <ellipse cx="100" cy="89" rx="5" ry="4" fill={C.mouth} className="mk-talk" />
      ) : mood === 'excited' ? (
        <g>
          <path d="M90 86 Q100 99 110 86 Z" fill={C.mouth} />
          <path d="M94 86.5 L106 86.5 L105 88.5 L95 88.5 Z" fill="#fff" />
          <path d="M95 93 Q100 96 105 93 Q100 91.5 95 93 Z" fill="#E8838A" />
        </g>
      ) : sad ? (
        <path d="M92 92 Q100 86 108 92" stroke={C.mouth} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : thinking ? (
        <path d="M94 89.5 Q100 88 106 90.5" stroke={C.mouth} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M91 87 Q100 94 109 87" stroke={C.mouth} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}

      {/* pêra */}
      <path d="M94 96 Q100 106 106 96 Q100 99.5 94 96 Z" fill={C.hair} />

      {sad && (
        <>
          <path d="M82 68 q-3 5 0 7 q3 -2 0 -7z" fill="#4CC9F0" className={live ? 'mk-tear' : undefined} />
          <path d="M118 68 q-3 5 0 7 q3 -2 0 -7z" fill="#4CC9F0" className={live ? 'mk-tear mk-tear-late' : undefined} />
        </>
      )}
    </g>
  )
}

function Head({ mood, pose, talking, live }: { mood: MascotMood; pose: MascotPose; talking: boolean; live: boolean }) {
  return (
    <g>
      <rect x="91" y="88" width="18" height="20" rx="4" fill={C.skinDark} />
      <ellipse cx="66.5" cy="64" rx="6" ry="8" fill={C.skin} />
      <ellipse cx="66.5" cy="64" rx="3" ry="5" fill={C.skinDark} />
      <ellipse cx="133.5" cy="64" rx="6" ry="8" fill={C.skin} />
      <ellipse cx="133.5" cy="64" rx="3" ry="5" fill={C.skinDark} />
      {/* rosto */}
      <path d="M67 60 Q67 25 100 25 Q133 25 133 60 Q133 84 121 96 Q111 104 100 104 Q89 104 79 96 Q67 84 67 60 Z" fill={C.skin} />
      {/* cabelo curto, com entradas */}
      <path d="M66.5 58 Q64.5 22 100 21 Q135.5 22 133.5 58 Q131 45 124 39 Q113 33.5 100 34.5 Q87 33.5 76 39 Q69 45 66.5 58 Z" fill={C.hair} />
      <Face mood={mood} pose={pose} talking={talking} live={live} />
    </g>
  )
}

function Torso({ outfit }: { outfit: MascotOutfit }) {
  if (outfit === 'casual') {
    return (
      <g>
        <path d="M60 112 Q100 100 140 112 Q150 116 150 130 L141 186 Q100 194 59 186 L50 130 Q50 116 60 112 Z" fill={C.casual} />
        {/* gola aberta e carcela com botões */}
        <path d="M86 104 L100 120 L114 104 L110 102 L100 113 L90 102 Z" fill={C.casualDark} />
        <path d="M89 103 L100 116 L111 103 Z" fill={C.skinDark} />
        <line x1="100" y1="118" x2="100" y2="190" stroke={C.casualDark} strokeWidth="1.6" />
        {[130, 146, 162, 178].map(y => <circle key={y} cx="103" cy={y} r="1.6" fill={C.casualDark} />)}
        <rect x="74" y="128" width="16" height="14" rx="3" fill="none" stroke={C.casualDark} strokeWidth="1.6" />
      </g>
    )
  }
  return (
    <g>
      <path d="M60 112 Q100 100 140 112 Q150 116 150 130 L141 186 Q100 194 59 186 L50 130 Q50 116 60 112 Z" fill={C.suit} />
      {/* camisa e gravata */}
      <path d="M87 103 L100 146 L113 103 Z" fill={C.shirt} />
      <path d="M96 105 L104 105 L103 112 L97 112 Z" fill={C.tieDark} />
      <path d="M97 111 L103 111 L105.5 118 L101 147 L100 150 L99 147 L94.5 118 Z" fill={C.tie} />
      {/* lapelas */}
      <path d="M87 103 L100 146 L93 151 L79 114 Q81 105 87 103 Z" fill={C.suitLight} />
      <path d="M113 103 L100 146 L107 151 L121 114 Q119 105 113 103 Z" fill={C.suitLight} />
      <line x1="100" y1="151" x2="100" y2="191" stroke={C.suitDark} strokeWidth="1.6" />
      <circle cx="100" cy="161" r="2.2" fill={C.suitDark} />
      <circle cx="100" cy="174" r="2.2" fill={C.suitDark} />
      <path d="M118 128 L132 126" stroke={C.suitDark} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function Leg({ side, outfit, motion }: { side: 'l' | 'r'; outfit: MascotOutfit; motion?: string }) {
  const x = side === 'l' ? 78 : 103
  const shoeX = side === 'l' ? 85 : 115
  const pants = outfit === 'casual' ? C.casual : C.suit
  return (
    <g className={motion}>
      <rect x={x} y="166" width="19" height="72" rx="8" fill={pants} />
      <ellipse cx={shoeX} cy="240" rx="15" ry="8" fill={C.shoe} />
      {outfit === 'casual' && <path d={`M${shoeX - 15} 241 Q${shoeX} 249 ${shoeX + 15} 241 L${shoeX + 14} 244 Q${shoeX} 251 ${shoeX - 14} 244 Z`} fill={C.sole} />}
    </g>
  )
}

function Arm({
  side, outfit, upper, fore, upperMotion, foreMotion, thumb,
}: {
  side: 'l' | 'r'
  outfit: MascotOutfit
  upper: number
  fore: number
  upperMotion?: string
  foreMotion?: string
  thumb?: boolean
}) {
  const sx = side === 'l' ? 64 : 136
  const sleeve = outfit === 'casual' ? C.casual : C.suit
  const edge = outfit === 'casual' ? C.casualDark : C.suitDark
  return (
    <g transform={`rotate(${upper} ${sx} 118)`}>
      <g className={upperMotion}>
        <rect x={sx - 9} y="110" width="18" height="38" rx="9" fill={sleeve} stroke={edge} strokeWidth="1.5" />
        <g transform={`rotate(${fore} ${sx} 144)`}>
          <g className={foreMotion}>
            <rect x={sx - 9} y="138" width="18" height="33" rx="9" fill={sleeve} stroke={edge} strokeWidth="1.5" />
            {/* cotovelo: tapa a junção quando o braço dobra */}
            <circle cx={sx} cy="144" r="8.2" fill={sleeve} />
            {outfit === 'suit' && <rect x={sx - 7.5} y="164" width="15" height="5" rx="2" fill={C.shirt} />}
            {/* relógio no pulso esquerdo dele (à direita de quem vê) */}
            {side === 'r' && (
              <>
                <rect x={sx - 8.5} y="157" width="17" height="6" rx="2" fill={C.watch} />
                <circle cx={sx} cy="160" r="3.8" fill={C.dial} stroke="#9AA3AF" strokeWidth="1" />
              </>
            )}
            <circle cx={sx} cy="176" r="9.2" fill={C.skin} />
            {thumb && <rect x={sx + 1.5} y="174" width="7.5" height="18" rx="3.7" fill={C.skin} stroke={C.skinDark} strokeWidth="1.2" />}
          </g>
        </g>
      </g>
    </g>
  )
}

export default function Mascot({
  size = 80, className = '', mood = 'happy', pose, outfit = 'suit', animated = false, wave = false, bounce = false, talking = false,
}: Props) {
  const resolved: MascotPose =
    pose ?? (bounce ? 'celebrate' : wave ? 'wave' : mood === 'sad' ? 'sad' : mood === 'thinking' ? 'think' : 'idle')
  const live = animated || !!pose || bounce || wave
  const angles = POSES[resolved]
  const motion = live ? MOTION[resolved] ?? {} : {}
  const bust = size < 64

  if (bust) {
    // ícones pequenos: só cabeça e ombros
    return (
      <svg width={size} height={size} viewBox="50 16 100 100" className={className} aria-hidden>
        <Torso outfit={outfit} />
        <Head mood={mood} pose={resolved} talking={talking} live={live} />
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
        <g transform={`rotate(${angles.head} 100 104)`}>
          <Head mood={mood} pose={resolved} talking={talking} live={live} />
        </g>
        <Arm side="l" outfit={outfit} upper={angles.lu} fore={angles.lf} upperMotion={motion.lu} />
        <Arm
          side="r"
          outfit={outfit}
          upper={angles.ru}
          fore={angles.rf}
          upperMotion={motion.ru}
          foreMotion={motion.rf}
          thumb={resolved === 'thumbs'}
        />
      </g>
    </svg>
  )
}
