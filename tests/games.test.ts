import { rmSync } from 'fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '../app/types'
import {
  BREATH_CYCLE, COLOR_NAMES, GAME_IDS, GAME_RULES, PAIRS, SUGGEST_AFTER_SECONDS, breathAt, colorRound, isBetter, mathLevel,
  mathOptions, mathQuestion, pairsDeck, pairsStars, recordScore, seeded, shuffle, suggestedGame, validScore,
} from '../app/lib/games'
import { LESSONS } from '../app/lib/tutorial'
import { navGroups } from '../app/lib/nav'

process.env.NEEMA_DATA_DIR = '.data-test/games'

describe('Pares', () => {
  it('o baralho tem cada face exactamente duas vezes, ids únicos', () => {
    const deck = pairsDeck(seeded(1))
    expect(deck).toHaveLength(PAIRS * 2)
    expect(new Set(deck.map(c => c.id)).size).toBe(PAIRS * 2)
    for (let f = 0; f < PAIRS; f++) expect(deck.filter(c => c.face === f)).toHaveLength(2)
  })

  it('baralha de verdade (sementes diferentes, ordens diferentes) e repete com a mesma semente', () => {
    const order = (s: number) => pairsDeck(seeded(s)).map(c => c.face).join()
    expect(order(1)).toBe(order(1))
    expect(new Set([1, 2, 3, 4, 5].map(order)).size).toBeGreaterThan(1)
  })

  it('estrelas: perfeito é 3, muitas jogadas é 1', () => {
    expect(pairsStars(PAIRS)).toBe(3)
    expect(pairsStars(PAIRS * 2)).toBe(2)
    expect(pairsStars(PAIRS * 4)).toBe(1)
  })
})

describe('Contas rápidas', () => {
  it('a resposta está certa e é sempre uma das 4 opções, sem repetidas nem negativas', () => {
    const rand = seeded(7)
    for (let level = 0; level <= 3; level++) {
      for (let i = 0; i < 300; i++) {
        const q = mathQuestion(level, rand)
        const [a, op, b] = q.text.split(' ')
        const x = Number(a), y = Number(b)
        const expected = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y
        expect(q.answer).toBe(expected)
        expect(Number.isInteger(q.answer)).toBe(true)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options).size).toBe(4)
        expect(q.options).toContain(q.answer)
        expect(q.options.every(n => n >= 0)).toBe(true)
      }
    }
  })

  it('o nível 0 só tem somas pequenas; os seguintes trazem outras contas', () => {
    const rand = seeded(3)
    const ops = (level: number) => new Set(Array.from({ length: 200 }, () => mathQuestion(level, rand).text.split(' ')[1]))
    expect([...ops(0)]).toEqual(['+'])
    expect(ops(1).has('−')).toBe(true)
    expect(ops(3).has('÷')).toBe(true)
  })

  it('o nível sobe a cada 4 certas seguidas, até ao 3', () => {
    expect([0, 3, 4, 8, 12, 40].map(mathLevel)).toEqual([0, 0, 1, 2, 3, 3])
  })

  it('opções para respostas pequenas (0, 1) continuam a ser 4 diferentes', () => {
    for (const a of [0, 1, 2]) {
      const o = mathOptions(a, seeded(a))
      expect(new Set(o).size).toBe(4)
      expect(o).toContain(a)
    }
  })
})

describe('Cores', () => {
  it('cores válidas, às vezes iguais (para não dar para adivinhar) e nunca a mesma ronda seguida', () => {
    const rand = seeded(11)
    let prev = colorRound(rand)
    let same = 0
    for (let i = 0; i < 1000; i++) {
      const r = colorRound(rand, prev)
      expect(r.word).toBeGreaterThanOrEqual(0)
      expect(r.ink).toBeLessThan(COLOR_NAMES.length)
      expect(r.word === prev.word && r.ink === prev.ink).toBe(false)
      if (r.word === r.ink) same++
      prev = r
    }
    // a maioria das rondas não bate certo (é aí que o cérebro trabalha)
    expect(same).toBeGreaterThan(100)
    expect(same).toBeLessThan(400)
  })
})

describe('Respirar', () => {
  it('fases pela ordem certa e o ciclo recomeça', () => {
    expect(breathAt(0).phase.label).toBe('Inspira')
    expect(breathAt(4.5).phase.label).toBe('Segura')
    expect(breathAt(9).phase.label).toBe('Expira')
    expect(breathAt(BREATH_CYCLE).phase.label).toBe('Inspira')
    expect(breathAt(0.2).left).toBe(4)
  })
})

describe('recordes', () => {
  it('"mais é melhor" e "menos é melhor"', () => {
    expect(isBetter('contas', 10, 9)).toBe(true)
    expect(isBetter('contas', 9, 9)).toBe(false)
    expect(isBetter('pares', 12, 14)).toBe(true)
    expect(isBetter('pares', 16, 14)).toBe(false)
    expect(isBetter('cores', 0, undefined)).toBe(true)
  })

  it('guarda o melhor e conta as vezes', () => {
    let s = recordScore(undefined, 'pares', 14, 1)
    s = recordScore(s, 'pares', 20, 2)
    s = recordScore(s, 'pares', 11, 3)
    expect(s).toEqual({ best: 11, plays: 3, lastAt: 3 })
  })

  it('só aceita resultados possíveis', () => {
    expect(validScore('pares', PAIRS - 1)).toBe(false) // menos jogadas do que pares é impossível
    expect(validScore('pares', PAIRS)).toBe(true)
    expect(validScore('contas', 1.5)).toBe(false)
    expect(validScore('contas', -1)).toBe(false)
    expect(validScore('contas', '10')).toBe(false)
    expect(validScore('respirar', 5)).toBe(false)
    expect(validScore('respirar', 60)).toBe(true)
    for (const id of GAME_IDS) expect(GAME_RULES[id].min).toBeLessThanOrEqual(GAME_RULES[id].max)
  })
})

describe('sugestão de pausa', () => {
  it('com muito foco sugere respirar; senão roda os jogos de cérebro por dia', () => {
    expect(suggestedGame(4 * 3600)).toBe('respirar')
    const day = 86_400_000
    const picks = new Set([0, 1, 2, 3, 4].map(d => suggestedGame(SUGGEST_AFTER_SECONDS, d * day)))
    expect(picks).toEqual(new Set(['pares', 'contas', 'cores', 'galo', 'forca']))
  })

  it('baralhar não perde nem repete elementos', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    expect(shuffle(items, seeded(9)).sort((a, b) => a - b)).toEqual(items)
  })
})

describe('menu e tutorial', () => {
  it('"Jogos" aparece para pessoas, não para a conta da empresa', () => {
    const has = (mode: Parameters<typeof navGroups>[0]) => navGroups(mode).some(g => g.items.some(i => i.href === '/jogos'))
    expect(has('person')).toBe(true)
    expect(has('admin')).toBe(true)
    expect(has('company')).toBe(false)
  })

  it('os jogos têm lição no tutorial, com 4 fases', () => {
    const lesson = LESSONS.find(l => l.id === 'jogos')
    expect(lesson?.steps).toHaveLength(4)
    expect(lesson?.href).toBe('/jogos')
  })
})

/* ─── Guardar resultados (rota de verdade) ─────────────────────────────── */

const ana: User = { id: 'u-ana', email: 'ana@x.pt', name: 'Ana', createdAt: 0, rankingVisibility: 'nome' }
let as: User | null = ana
vi.mock('../app/lib/server/auth', () => ({ currentUser: async () => as }))
vi.mock('../app/lib/server/push', () => ({ sendToUser: async () => 0, pushConfigured: () => false }))

const post = async (body: unknown) => {
  const { POST } = await import('../app/api/jogos/route')
  const res = await POST(new Request('http://t/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({}) })
  return { status: res.status, json: await res.json() }
}

describe('API dos jogos', () => {
  beforeAll(async () => {
    rmSync('.data-test/games', { recursive: true, force: true })
    const { mutate } = await import('../app/lib/server/store')
    await mutate('all', db => { db.users.push(ana) })
  })

  it('guarda o recorde e as vezes jogadas na conta', async () => {
    expect((await post({ game: 'contas', score: 12 })).json.games.contas).toMatchObject({ best: 12, plays: 1 })
    expect((await post({ game: 'contas', score: 9 })).json.games.contas).toMatchObject({ best: 12, plays: 2 })
    const res = await post({ game: 'pares', score: 10 })
    expect(res.json.games).toMatchObject({ contas: { best: 12 }, pares: { best: 10, plays: 1 } })
    const { read } = await import('../app/lib/server/store')
    expect((await read()).users.find(u => u.id === 'u-ana')!.games?.contas?.best).toBe(12)
  })

  it('recusa jogos que não existem e resultados impossíveis', async () => {
    expect((await post({ game: 'xadrez', score: 1 })).status).toBe(400)
    expect((await post({ game: 'contas', score: 99999 })).status).toBe(400)
    expect((await post({ game: 'pares', score: 2 })).status).toBe(400)
    expect((await post({ game: 'contas' })).status).toBe(400)
  })

  it('sem sessão: 401', async () => {
    as = null
    expect((await post({ game: 'contas', score: 3 })).status).toBe(401)
    as = ana
  })
})
