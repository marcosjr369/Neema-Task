'use client'

import { useEffect, useState } from 'react'
import { TrophyIcon } from '@phosphor-icons/react'
import { useAccount } from '../../context/AccountContext'
import { galoMove, galoResult, isBetter, type GaloBoard, type Mark } from '../../lib/games'
import { GameFrame, Intro, OptionCards } from './GameFrame'
import { gameMeta } from './meta'

type Level = 'facil' | 'dificil'
const g = gameMeta('galo')
const EMPTY: GaloBoard = Array(9).fill(null)
const ME: Mark = 'X'
const AI: Mark = 'O'

/** X e O desenhados com traço animado */
function Glyph({ mark, win }: { mark: Mark; win: boolean }) {
  const color = mark === ME ? g.color : '#A3A0B8'
  return (
    <svg viewBox="0 0 60 60" className={`h-3/5 w-3/5 ${win ? 'gm-win' : ''}`} aria-hidden>
      {mark === 'X' ? (
        <>
          <line x1="14" y1="14" x2="46" y2="46" stroke={color} strokeWidth="7" strokeLinecap="round" className="gm-draw" style={{ ['--len' as string]: 46 }} />
          <line x1="46" y1="14" x2="14" y2="46" stroke={color} strokeWidth="7" strokeLinecap="round" className="gm-draw" style={{ ['--len' as string]: 46, ['--d' as string]: '0.12s' }} />
        </>
      ) : (
        <circle cx="30" cy="30" r="17" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" className="gm-draw" style={{ ['--len' as string]: 107 }} transform="rotate(-90 30 30)" />
      )}
    </svg>
  )
}

export default function TicTacToe() {
  const { recordGame, user } = useAccount()
  const [level, setLevel] = useState<Level>('facil')
  const [playing, setPlaying] = useState(false)
  const [board, setBoard] = useState<GaloBoard>(EMPTY)
  const [round, setRound] = useState(0)
  const [turn, setTurn] = useState<Mark>(ME)
  const [tally, setTally] = useState({ me: 0, draw: 0, ai: 0 })
  const [streak, setStreak] = useState(0)
  const [record, setRecord] = useState(false)
  const outcome = galoResult(board)

  // a Udacha joga (com uma pequena pausa, como quem pensa)
  useEffect(() => {
    if (!playing || outcome || turn !== AI) return
    const t = window.setTimeout(() => {
      const i = galoMove(board, AI, level)
      if (i >= 0) {
        setBoard(b => b.map((v, k) => (k === i ? AI : v)))
        setTurn(ME)
      }
    }, 550)
    return () => window.clearTimeout(t)
  }, [playing, outcome, turn, board, level])

  // fim da ronda: conta e guarda a série de vitórias
  useEffect(() => {
    if (!outcome) return
    const won = outcome.winner === ME
    const next = won ? streak + 1 : outcome.winner === 'draw' ? streak : 0
     
    setTally(t => ({ me: t.me + (won ? 1 : 0), draw: t.draw + (outcome.winner === 'draw' ? 1 : 0), ai: t.ai + (outcome.winner === AI ? 1 : 0) }))
    setRecord(won && isBetter('galo', next, user?.games?.galo?.best) && next > 1)
    setStreak(next)
    recordGame('galo', next)
    // só quando a ronda acaba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome?.winner])

  const play = (i: number) => {
    if (!playing || outcome || turn !== ME || board[i]) return
    setBoard(b => b.map((v, k) => (k === i ? ME : v)))
    setTurn(AI)
  }

  const nextRound = () => {
    const r = round + 1
    setRound(r)
    setBoard(EMPTY)
    setRecord(false)
    // começa um de cada vez
    setTurn(r % 2 === 0 ? ME : AI)
  }

  if (!playing) {
    return (
      <GameFrame id="galo">
        <Intro
          id="galo"
          onStart={() => { setPlaying(true); setBoard(EMPTY); setTurn(ME); setRound(0) }}
          options={
            <OptionCards id="galo" label="Dificuldade" value={level} onChange={setLevel} items={[
              { value: 'facil', title: 'Fácil', hint: 'Para descontrair e ganhar' },
              { value: 'dificil', title: 'Difícil', hint: 'A Udacha nunca perde' },
            ]} />
          }
        />
      </GameFrame>
    )
  }

  const status = outcome
    ? outcome.winner === ME ? 'Ganhaste!' : outcome.winner === AI ? 'A Udacha ganhou' : 'Empate'
    : turn === ME ? 'A tua vez' : 'A Udacha está a pensar…'

  return (
    <GameFrame id="galo" stat={<span className="gm-pill">{level === 'facil' ? 'Fácil' : 'Difícil'}</span>}>
      <div className="mt-6 grid grid-cols-3 text-center">
        {[['Tu', tally.me, g.color], ['Empates', tally.draw, '#A3A0B8'], ['Udacha', tally.ai, '#4A4763']].map(([label, n, c]) => (
          <div key={label as string}>
            <p key={n as number} className="gm-pop text-2xl font-black tabular-nums" style={{ color: c as string }}>{n}</p>
            <p className="text-xs font-bold text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="my-auto py-6">
        <p key={status} className="gm-in mb-4 text-center text-lg font-black text-ink" aria-live="polite">{status}</p>
        <div className="mx-auto grid aspect-square w-full max-w-xs grid-cols-3 grid-rows-3 gap-2">
          {board.map((v, i) => {
            const win = !!outcome?.line?.includes(i)
            return (
              <button
                key={`${round}-${i}`}
                onClick={() => play(i)}
                aria-label={v ? (v === ME ? 'X (tu)' : 'O (Udacha)') : `Casa ${i + 1}, livre`}
                disabled={!!v || !!outcome || turn !== ME}
                className="gm-pop flex cursor-pointer items-center justify-center rounded-2xl transition-colors duration-300 enabled:hover:bg-[#EFEDF6] disabled:cursor-default"
                style={{ background: win ? g.light : '#F7F6FC', ['--d' as string]: `${i * 0.03}s` }}
              >
                {v && <Glyph mark={v} win={win} />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        {record && (
          <p className="gm-pop inline-flex items-center gap-1.5 rounded-full bg-[#FFF4D6] px-3 py-1 text-sm font-black text-gold-dark">
            <TrophyIcon size={15} weight="fill" /> Recorde: {streak} vitórias seguidas
          </p>
        )}
        {!record && streak > 0 && <p className="text-sm font-semibold text-muted">{streak} {streak === 1 ? 'vitória seguida' : 'vitórias seguidas'}</p>}
        {/* o botão só aparece no fim da ronda (o espaço fica reservado para nada saltar) */}
        {outcome ? <button onClick={nextRound} className="gm-cta gm-in w-full max-w-xs">Outra ronda</button> : <span className="h-12" aria-hidden />}
      </div>
    </GameFrame>
  )
}
