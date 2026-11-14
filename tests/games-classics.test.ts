import { describe, expect, it } from 'vitest'
import {
  FORCA_ERRORS, FORCA_WORDS, GAME_IDS, formatScore, forcaLetters, forcaShown, forcaState, galoMove, galoResult, plainLetter,
  seeded, slideDone, slideMove, slideScramble, slideSolved, sudokuConflicts, sudokuCount, sudokuPuzzle, sudokuSolution,
  type GaloBoard, type Mark,
} from '../app/lib/games'
import { GAMES } from '../app/components/games/meta'

/* Jogos clássicos: só a lógica (as regras de cada jogo e a Udacha a jogar ao galo) */

describe('Jogo do Galo', () => {
  const b = (s: string): GaloBoard => [...s].map(c => (c === 'X' || c === 'O' ? c : null)) as GaloBoard

  it('vê linhas, colunas, diagonais e empate', () => {
    expect(galoResult(b('XXX......'))).toEqual({ winner: 'X', line: [0, 1, 2] })
    expect(galoResult(b('O..O..O..'))?.winner).toBe('O')
    expect(galoResult(b('..X.X.X..'))?.line).toEqual([2, 4, 6])
    expect(galoResult(b('XOXXOOOXX'))).toEqual({ winner: 'draw' })
    expect(galoResult(b('XO.......'))).toBeNull()
  })

  it('difícil: ganha quando pode e bloqueia quando tem de ser', () => {
    expect(galoMove(b('OO.XX....'), 'O', 'dificil')).toBe(2)
    expect(galoMove(b('XX..O....'), 'O', 'dificil')).toBe(2)
  })

  it('difícil nunca perde: contra todas as jogadas possíveis, empata ou ganha', () => {
    // percorre todas as partidas em que tu (X) começas e a Udacha (O) responde
    let games = 0
    const explore = (board: GaloBoard, turn: Mark) => {
      const r = galoResult(board)
      if (r) { expect(r.winner).not.toBe('X'); games++; return }
      if (turn === 'O') {
        const i = galoMove(board, 'O', 'dificil', seeded(games + 1))
        explore(board.map((v, k) => (k === i ? 'O' : v)), 'X')
      } else {
        board.forEach((v, i) => { if (!v) explore(board.map((w, k) => (k === i ? 'X' : w)), 'O') })
      }
    }
    explore(Array(9).fill(null), 'X')
    expect(games).toBeGreaterThan(50)
  })

  it('fácil: joga sempre numa casa livre e às vezes deixa ganhar', () => {
    const rand = seeded(5)
    let blocked = 0
    for (let t = 0; t < 200; t++) {
      const i = galoMove(b('XX..O....'), 'O', 'facil', rand)
      expect([2, 3, 5, 6, 7, 8]).toContain(i)
      if (i === 2) blocked++
    }
    expect(blocked).toBeGreaterThan(40)
    expect(blocked).toBeLessThan(200)
  })
})

describe('Forca', () => {
  it('acentos e cedilha contam como a letra simples', () => {
    expect(plainLetter('Ã')).toBe('A')
    expect(plainLetter('Ç')).toBe('C')
    expect([...forcaLetters('NATAÇÃO')].sort()).toEqual(['A', 'C', 'N', 'O', 'T'])
  })

  it('mostra as letras certas (com o acento original) e deixa o hífen à vista', () => {
    expect(forcaShown('CAFÉ', new Set(['E', 'C']))).toEqual(['C', null, null, 'É'])
    expect(forcaShown('ARCO-ÍRIS', new Set())).toEqual([null, null, null, null, '-', null, null, null, null])
  })

  it('ganha com todas as letras; perde ao 6.º erro', () => {
    expect(forcaState('LEÃO', new Set(['L', 'E', 'A', 'O']))).toMatchObject({ won: true, lost: false, errors: 0 })
    const wrong = new Set(['B', 'C', 'D', 'F', 'G', 'H'])
    expect(forcaState('LEÃO', wrong)).toMatchObject({ won: false, lost: true, errors: FORCA_ERRORS })
  })

  it('todas as palavras têm letras para adivinhar e só usam letras, acentos e hífen', () => {
    for (const { word, hint } of FORCA_WORDS) {
      expect(word).toMatch(/^[A-ZÀ-Ü-]+$/)
      expect(forcaLetters(word).size).toBeGreaterThan(2)
      expect(hint.length).toBeGreaterThan(2)
    }
    expect(new Set(FORCA_WORDS.map(w => w.word)).size).toBe(FORCA_WORDS.length)
  })
})

describe('Sudoku', () => {
  it('a solução gerada é válida (sem repetidos em linhas, colunas e blocos)', () => {
    for (let s = 1; s <= 20; s++) {
      const sol = sudokuSolution(seeded(s))
      expect(sol.every(v => v >= 1 && v <= 9)).toBe(true)
      expect(sudokuConflicts(sol).size).toBe(0)
    }
  })

  it('os puzzles têm uma só solução, e é a gerada', () => {
    for (const [level, holes] of [['facil', 38], ['medio', 48]] as const) {
      const { puzzle, solution } = sudokuPuzzle(level, seeded(holes))
      expect(puzzle.filter(v => v === 0).length).toBeGreaterThanOrEqual(holes - 6)
      expect(sudokuCount(puzzle)).toBe(1)
      puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]) })
    }
  })

  it('assinala os números repetidos', () => {
    const grid = Array(81).fill(0)
    grid[0] = 5; grid[8] = 5 // mesma linha
    grid[40] = 3
    expect([...sudokuConflicts(grid)].sort((a, b) => a - b)).toEqual([0, 8])
  })

  it('uma grelha sem solução tem 0 soluções', () => {
    const grid = Array(81).fill(0)
    for (let c = 0; c < 8; c++) grid[c] = c + 1 // 1..8 na primeira linha
    grid[9 + 8] = 9 // 9 na coluna da casa que falta
    expect(sudokuCount(grid)).toBe(0)
  })
})

describe('Deslizar', () => {
  it('baralhado tem sempre solução e não vem resolvido', () => {
    for (let s = 1; s <= 30; s++) {
      const t = slideScramble(4, 120, seeded(s))
      expect([...t].sort((a, b) => a - b)).toEqual([...Array(16).keys()])
      expect(slideDone(t)).toBe(false)
      // paridade: com o espaço, as inversões + a linha do espaço (de baixo) têm de ser ímpares
      const nums = t.filter(Boolean)
      let inv = 0
      for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) inv++
      const rowFromBottom = 4 - Math.floor(t.indexOf(0) / 4)
      expect((inv + rowFromBottom) % 2).toBe(1)
    }
  })

  it('mexe uma peça ao lado do espaço, ou uma fila inteira; recusa as outras', () => {
    const solved = slideSolved()
    expect(slideMove(solved, 14)).toEqual([...solved.slice(0, 14), 0, 15])
    // a peça 13 (índice 12) empurra 13, 14 e 15 de uma vez
    expect(slideMove(solved, 12)).toEqual([...solved.slice(0, 12), 0, 13, 14, 15])
    expect(slideMove(solved, 0)).toBeNull()
    expect(slideMove(solved, 15)).toBeNull()
  })

  it('reconhece a solução', () => {
    expect(slideDone(slideSolved())).toBe(true)
  })
})

describe('textos dos jogos', () => {
  it('cada jogo tem ficha, regras e 3 etapas de como ajuda a descontrair', () => {
    expect(GAMES.map(g => g.id).sort()).toEqual([...GAME_IDS].sort())
    for (const g of GAMES) {
      expect(g.howTo.length).toBeGreaterThan(20)
      expect(g.relax).toHaveLength(3)
      for (const r of g.relax) expect(r.text.length).toBeGreaterThan(20)
    }
  })

  it('resultados com unidade no singular e plural, e tempo como relógio', () => {
    expect(formatScore('deslizar', 1)).toBe('1 jogada')
    expect(formatScore('galo', 3)).toBe('3 vitórias seguidas')
    expect(formatScore('sudoku', 245)).toBe('4:05')
    expect(formatScore('respirar', 60)).toBe('1:00')
  })
})
