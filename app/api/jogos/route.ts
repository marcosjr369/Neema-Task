import { body, fail, handle, requireUser } from '../../lib/server/api'
import { mutate } from '../../lib/server/store'
import { isGameId, recordScore, validScore } from '../../lib/games'

/** Guardar o resultado de um minijogo: { game, score } → as estatísticas de todos os jogos */
export const POST = handle(async req => {
  const me = await requireUser()
  const input = await body<{ game?: unknown; score?: unknown }>(req)
  if (!isGameId(input.game)) fail(400, 'Jogo desconhecido')
  const game = input.game as Parameters<typeof recordScore>[1]
  if (!validScore(game, input.score)) fail(400, 'Resultado inválido')
  return mutate(async l => { await l.load('users', { id: me.id }) }, db => {
    const user = db.users.find(u => u.id === me.id) ?? fail(404, 'Conta não encontrada')
    user.games = { ...user.games, [game]: recordScore(user.games?.[game], game, input.score as number) }
    return { games: user.games }
  })
})
