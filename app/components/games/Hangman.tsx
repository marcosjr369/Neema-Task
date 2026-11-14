'use client'

import { useEffect, useState } from 'react'
import { useAccount } from '../../context/AccountContext'
import { FORCA_ERRORS, forcaLetters, forcaPick, forcaShown, forcaState, isBetter } from '../../lib/games'
import { GameFrame, Intro } from './GameFrame'
import { gameMeta } from './meta'
import { TrophyIcon } from '@phosphor-icons/react'

const g = gameMeta('forca')
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

/** O desenho: a estrutura fica sempre (clara); cada erro desenha uma parte, com traço animado */
function Drawing({ errors }: { errors: number }) {
  const parts = [
    <circle key="head" cx="120" cy="58" r="13" />,
    <line key="body" x1="120" y1="71" x2="120" y2="108" />,
    <line key="armL" x1="120" y1="82" x2="104" y2="96" />,
    <line key="armR" x1="120" y1="82" x2="136" y2="96" />,
    <line key="legL" x1="120" y1="108" x2="106" y2="128" />,
    <line key="legR" x1="120" y1="108" x2="134" y2="128" />,
  ]
  return (
    <svg viewBox="0 0 180 150" className="h-36 w-auto" aria-label={`${errors} de ${FORCA_ERRORS} erros`}>
      <g stroke="#E9E7F2" strokeWidth="5" strokeLinecap="round" fill="none">
        <line x1="30" y1="140" x2="100" y2="140" />
        <line x1="55" y1="140" x2="55" y2="20" />
        <line x1="55" y1="20" x2="120" y2="20" />
        <line x1="120" y1="20" x2="120" y2="45" />
      </g>
      <g stroke={errors >= FORCA_ERRORS ? '#F2545B' : '#2B2840'} strokeWidth="5" strokeLinecap="round" fill="none">
        {parts.slice(0, errors).map(p => (
          <g key={p.key} className="gm-draw" style={{ ['--len' as string]: 90 }} strokeDasharray="90">{p}</g>
        ))}
      </g>
    </svg>
  )
}

export default function Hangman() {
  const { recordGame, user } = useAccount()
  const [playing, setPlaying] = useState(false)
  const [entry, setEntry] = useState(() => forcaPick())
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [streak, setStreak] = useState(0)
  const [record, setRecord] = useState(false)
  const { errors, won, lost } = forcaState(entry.word, guessed)
  const over = won || lost
  const letters = forcaLetters(entry.word)

  const guess = (ch: string) => {
    if (over || guessed.has(ch)) return
    setGuessed(s => new Set([...s, ch]))
  }

  // teclado do computador
  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toUpperCase()
      if (/^[A-Z]$/.test(k)) guess(k)
      else if (e.key === 'Enter' && over) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // fim da palavra: guarda a série de palavras seguidas
  useEffect(() => {
    if (!over) return
    const n = won ? streak + 1 : 0
     
    setRecord(won && n > 1 && isBetter('forca', n, user?.games?.forca?.best))
    setStreak(n)
    recordGame('forca', n)
    // só quando a palavra acaba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])

  const next = () => {
    setEntry(e => forcaPick(Math.random, e.word))
    setGuessed(new Set())
    setRecord(false)
  }

  if (!playing) return <GameFrame id="forca"><Intro id="forca" onStart={() => { next(); setPlaying(true) }} /></GameFrame>

  const shown = forcaShown(entry.word, guessed)
  return (
    <GameFrame id="forca" stat={<span className="gm-pill">{FORCA_ERRORS - errors} {FORCA_ERRORS - errors === 1 ? 'vida' : 'vidas'}</span>}>
      <div className="my-auto flex flex-col items-center py-4">
        <span className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]" style={{ background: g.light, color: g.color }}>{entry.hint}</span>
        <div className={lost ? 'animate-shake' : ''}><Drawing errors={errors} /></div>

        <div key={entry.word} className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label={won || lost ? `A palavra era ${entry.word}` : 'Palavra por descobrir'}>
          {shown.map((ch, i) => {
            const missing = ch === null
            const reveal = missing && lost
            return (
              <span key={i} className={`flex h-11 w-8 items-end justify-center pb-1 text-2xl font-black sm:w-9 ${/[A-ZÀ-Ü]/i.test(entry.word[i]) ? 'border-b-[3px]' : ''} ${won ? 'gm-win' : ''}`}
                style={{ borderColor: missing && !reveal ? '#E9E7F2' : '#2B2840', color: reveal ? '#F2545B' : '#2B2840' }}>
                {!missing && <span key={ch} className="gm-pop">{ch}</span>}
                {reveal && <span className="gm-in">{entry.word[i]}</span>}
              </span>
            )
          })}
        </div>

        <p key={`${won}-${lost}`} className="gm-in mt-5 h-6 text-center font-black text-ink" aria-live="polite">
          {won ? 'Descobriste!' : lost ? 'Ficou por descobrir' : ''}
        </p>
        {record && (
          <p className="gm-pop mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#FFF4D6] px-3 py-1 text-sm font-black text-gold-dark">
            <TrophyIcon size={15} weight="fill" /> Recorde: {streak} palavras seguidas
          </p>
        )}
        {!record && streak > 0 && !lost && <p className="mt-1 text-sm font-semibold text-muted">{streak} {streak === 1 ? 'palavra seguida' : 'palavras seguidas'}</p>}
      </div>

      {over ? (
        <button onClick={next} className="gm-cta gm-in mx-auto w-full max-w-xs">Próxima palavra</button>
      ) : (
        <div className="space-y-1.5" role="group" aria-label="Letras">
          {ROWS.map(row => (
            <div key={row} className="flex justify-center gap-1">
              {[...row].map(ch => {
                const used = guessed.has(ch)
                const hit = used && letters.has(ch)
                return (
                  <button
                    key={ch}
                    onClick={() => guess(ch)}
                    disabled={used}
                    aria-label={`Letra ${ch}${used ? (hit ? ', está na palavra' : ', não está') : ''}`}
                    className="flex h-11 min-w-0 flex-1 basis-0 cursor-pointer items-center justify-center rounded-lg border text-sm font-black transition-[background,transform,color] duration-150 active:scale-90 disabled:cursor-default sm:max-w-11"
                    style={used
                      ? hit ? { background: g.light, borderColor: 'transparent', color: g.color } : { background: 'transparent', borderColor: 'transparent', color: '#D7D3E6' }
                      : { background: '#fff', borderColor: '#E9E7F2', color: '#2B2840' }}
                  >
                    {ch}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </GameFrame>
  )
}
