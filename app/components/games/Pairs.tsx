'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CoffeeIcon, FireIcon, HeartIcon, LightningIcon, PlantIcon, StarIcon, TimerIcon, TrophyIcon, type Icon,
} from '@phosphor-icons/react'
import { PAIRS, pairsDeck, pairsStars, type PairCard } from '../../lib/games'
import { GameFrame, Intro, ResultCard, useGameResult, useStopwatch } from './GameFrame'

const FACES: { icon: Icon; color: string; name: string }[] = [
  { icon: TimerIcon, color: '#F2545B', name: 'cronómetro' },
  { icon: FireIcon, color: '#FF8A3D', name: 'chama' },
  { icon: LightningIcon, color: '#E0A419', name: 'raio' },
  { icon: TrophyIcon, color: '#B8860B', name: 'troféu' },
  { icon: CoffeeIcon, color: '#8B5E3C', name: 'café' },
  { icon: PlantIcon, color: '#12A150', name: 'planta' },
  { icon: StarIcon, color: '#4C7DFF', name: 'estrela' },
  { icon: HeartIcon, color: '#EC5BA6', name: 'coração' },
]

/** Memória: 16 cartas, 8 pares. Conta as jogadas (duas cartas viradas = uma jogada) */
export default function Pairs() {
  const [playing, setPlaying] = useState(false)
  const [deck, setDeck] = useState<PairCard[]>(() => pairsDeck())
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [moves, setMoves] = useState(0)
  const locked = useRef(false)
  const { result, finish, reset } = useGameResult('pares')
  const done = matched.size === deck.length
  const clock = useStopwatch(playing && !done)

  useEffect(() => {
    if (!done) return
    // deixa ver o último par a acender antes do ecrã do fim
    const t = window.setTimeout(() => finish(moves), 800)
    return () => window.clearTimeout(t)
  }, [done, moves, finish])

  const flip = (card: PairCard) => {
    if (locked.current || open.includes(card.id) || matched.has(card.id)) return
    if (open.length === 0) { setOpen([card.id]); return }
    const first = deck.find(c => c.id === open[0])!
    setMoves(m => m + 1)
    if (first.face === card.face) {
      setMatched(s => new Set([...s, first.id, card.id]))
      setOpen([])
      return
    }
    setOpen([first.id, card.id])
    locked.current = true
    window.setTimeout(() => { setOpen([]); locked.current = false }, 850)
  }

  const start = () => {
    reset()
    setDeck(pairsDeck())
    setOpen([])
    setMatched(new Set())
    setMoves(0)
    clock.reset()
    setPlaying(true)
  }

  if (result) {
    const stars = pairsStars(result.score)
    return (
      <GameFrame id="pares">
        <ResultCard id="pares" result={result} title={stars === 3 ? 'Memória de elefante' : stars === 2 ? 'Muito bem' : 'Conseguiste'} onAgain={start}>
          <p className="text-xl tracking-widest" aria-label={`${stars} de 3 estrelas`}>
            {[0, 1, 2].map(i => <span key={i} className={i < stars ? 'text-gold' : 'text-line'}>★</span>)}
          </p>
          <p className="text-sm font-semibold text-muted">{clock.seconds} segundos · perfeito são {PAIRS} jogadas</p>
        </ResultCard>
      </GameFrame>
    )
  }

  if (!playing) return <GameFrame id="pares"><Intro id="pares" onStart={start} /></GameFrame>

  return (
    <GameFrame id="pares" stat={<><span className="gm-pill">{matched.size / 2}/{PAIRS}</span><span className="gm-pill">{moves} jogadas</span></>}>
      <div className="my-auto grid w-full grid-cols-4 gap-2.5 py-6 [perspective:800px]">
        {deck.map((card, i) => {
          const isOpen = open.includes(card.id) || matched.has(card.id)
          const face = FACES[card.face]
          return (
            <button
              key={card.id}
              onClick={() => flip(card)}
              data-open={isOpen}
              data-matched={matched.has(card.id)}
              aria-label={isOpen ? face.name : 'Carta virada para baixo'}
              disabled={matched.has(card.id)}
              className="gm-card gm-pop aspect-square cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
              style={{ ['--d' as string]: `${i * 0.025}s` }}
            >
              <span className="gm-card-inner">
                <span className="gm-face flex items-center justify-center rounded-2xl bg-brand-light transition-colors hover:bg-[#E4DEFF]">
                  <span className="h-2 w-2 rounded-full bg-brand/40" />
                </span>
                <span className="gm-face gm-back flex items-center justify-center rounded-2xl border border-line bg-white" style={{ color: face.color }}>
                  <face.icon size={32} weight="duotone" />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </GameFrame>
  )
}
