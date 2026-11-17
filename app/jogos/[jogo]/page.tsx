'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, type ComponentType } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { PLAY_MIN_SECONDS } from '../../lib/games'
import { isGameId } from '../../lib/games'
import type { GameId } from '../../types'
import Mascot from '../../components/ui/Mascot'
import Spinner from '../../components/ui/Spinner'
import BreakOverLock from '../../components/games/BreakOverLock'

const loading = () => <div className="flex min-h-[60dvh] items-center justify-center"><Spinner /></div>

// cada jogo é carregado só quando se abre (não pesa no resto da app)
const GAMES: Record<GameId, ComponentType> = {
  respirar: dynamic(() => import('../../components/games/Breathe'), { loading }),
  pares: dynamic(() => import('../../components/games/Pairs'), { loading }),
  contas: dynamic(() => import('../../components/games/QuickMath'), { loading }),
  cores: dynamic(() => import('../../components/games/Colors'), { loading }),
  galo: dynamic(() => import('../../components/games/TicTacToe'), { loading }),
  forca: dynamic(() => import('../../components/games/Hangman'), { loading }),
  sudoku: dynamic(() => import('../../components/games/Sudoku'), { loading }),
  deslizar: dynamic(() => import('../../components/games/Sliding'), { loading }),
}

/**
 * Conta o tempo nesta página de jogo, só com o separador à vista, e envia-o ao sair (ou ao
 * esconder o separador). No espaço de uma empresa fica ligado ao funcionário: a administração
 * vê-o nos relatórios.
 */
function usePlayTime(game: GameId | null) {
  const { workspace } = useApp()
  const orgId = workspace.kind === 'org' ? workspace.orgId : undefined
  useEffect(() => {
    if (!game) return
    let start = Date.now()
    let since: number | null = document.visibilityState === 'visible' ? Date.now() : null
    let counted = 0
    const flush = () => {
      if (since !== null) { counted += (Date.now() - since) / 1000; since = null }
      if (counted >= PLAY_MIN_SECONDS) {
        api('/api/jogos/tempo', { body: { game, start, end: Date.now(), seconds: Math.round(counted), orgId }, keepalive: true }).catch(() => undefined)
      }
      counted = 0
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else { start = Date.now(); since = Date.now() }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [game, orgId])
}

export default function GamePage() {
  const { jogo } = useParams<{ jogo: string }>()
  usePlayTime(isGameId(jogo) ? jogo : null)
  if (!isGameId(jogo)) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
        <Mascot size={96} mood="thinking" />
        <h1 className="mt-3 text-xl font-black text-ink">Esse jogo não existe</h1>
        <Link href="/jogos" className="btn btn-primary mt-5">Ver os jogos</Link>
      </div>
    )
  }
  const Game = GAMES[jogo]
  return <BreakOverLock><Game /></BreakOverLock>
}
