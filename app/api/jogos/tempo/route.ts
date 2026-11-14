import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { mutate, newId } from '../../../lib/server/store'
import { PLAY_MAX_SECONDS, PLAY_MERGE_GAP, PLAY_MIN_SECONDS, isGameId } from '../../../lib/games'
import type { GameId, GamePlay } from '../../../types'

/**
 * Tempo passado num jogo: { game, start, end, seconds, orgId? }.
 * Jogado no espaço de uma empresa, fica ligado ao funcionário (a administração vê-o nos
 * relatórios). Visitas seguidas ao mesmo jogo juntam-se numa só linha.
 */
export const POST = handle(async req => {
  const user = await requireUser()
  const input = await body<{ game?: unknown; start?: unknown; end?: unknown; seconds?: unknown; orgId?: unknown }>(req)
  if (!isGameId(input.game)) fail(400, 'Jogo desconhecido')
  const game = input.game as GameId
  const now = Date.now()
  const start = Number(input.start), end = Number(input.end)
  const seconds = Math.round(Number(input.seconds))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) fail(400, 'Período inválido')
  if (end > now + 60_000 || start < now - 26 * 60 * 60 * 1000) fail(400, 'Período inválido')
  if (!Number.isFinite(seconds) || seconds < PLAY_MIN_SECONDS) return { ok: true, skipped: true }
  // o tempo contado não pode ser maior do que o período (com folga de alguns segundos)
  const counted = Math.min(seconds, PLAY_MAX_SECONDS, Math.ceil((end - start) / 1000) + 5)
  const orgId = typeof input.orgId === 'string' ? input.orgId : undefined

  return mutate(async l => {
    await Promise.all([
      l.load('plays', { user_id: user.id, start_at: { gte: now - 26 * 60 * 60 * 1000 } }),
      orgId ? l.load('members', { org_id: orgId, user_id: user.id }) : undefined,
    ])
  }, db => {
    // só conta para a empresa se a pessoa for mesmo funcionária activa dessa empresa
    const member = orgId ? db.members.find(m => m.orgId === orgId && m.userId === user.id && m.status === 'activo') : undefined
    const last = db.plays
      .filter(p => p.userId === user.id && p.game === game && p.orgId === member?.orgId)
      .sort((a, b) => b.end - a.end)[0]
    if (last && start - last.end <= PLAY_MERGE_GAP && start >= last.start) {
      last.end = Math.max(last.end, end)
      last.seconds = Math.min(PLAY_MAX_SECONDS, last.seconds + counted)
      return { ok: true, merged: true }
    }
    const play: GamePlay = { id: newId(), userId: user.id, game, start, end, seconds: counted }
    if (member) { play.orgId = member.orgId; play.memberId = member.id }
    db.plays.push(play)
    return { ok: true }
  })
})
