import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { userScope } from '../../../lib/server/scopes'
import { mutate } from '../../../lib/server/store'
import type { ActiveTimer } from '../../../types'

/** Guarda o cronómetro activo de um espaço ('personal' ou id da empresa); null apaga */
export const PUT = handle(async req => {
  const me = await requireUser()
  const { key, timer } = await body<{ key: string; timer: ActiveTimer | null }>(req)
  if (!key || !/^[\w-]{1,64}$/.test(key)) fail(400, 'Espaço inválido')
  await mutate(userScope(me.id), db => {
    const user = db.users.find(u => u.id === me.id)!
    const timers = { ...user.timers }
    if (timer && typeof timer.taskId === 'string') {
      timers[key] = {
        taskId: timer.taskId,
        phase: timer.phase === 'break' ? 'break' : 'focus',
        segmentStart: timer.segmentStart ? Number(timer.segmentStart) : null,
        accumulated: Math.max(0, Number(timer.accumulated) || 0),
        blockSeconds: Math.max(60, Number(timer.blockSeconds) || 1500),
        breakSeconds: Math.max(60, Number(timer.breakSeconds) || 300),
        alerted: !!timer.alerted,
        pomodoros: Math.max(0, Number(timer.pomodoros) || 0),
      }
    } else delete timers[key]
    user.timers = timers
  })
})
