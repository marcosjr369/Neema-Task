import { body, handle, requireUser } from '../../lib/server/api'
import { currentUser } from '../../lib/server/auth'
import { userScope } from '../../lib/server/scopes'
import { mutate, read } from '../../lib/server/store'
import { domainSuggestions, membershipsOf } from '../../lib/server/views'
import { DEFAULT_SETTINGS, type RankingVisibility, type Settings, type Workspace } from '../../types'

export const GET = handle(async () => {
  const user = await currentUser()
  if (!user) return { user: null, memberships: [], suggestions: [] }
  const db = await read(userScope(user.id, { memberships: true, domainOrgs: true }))
  return { user, memberships: membershipsOf(db, user), suggestions: domainSuggestions(db, user) }
})

type Patch = {
  name?: string
  rankingVisibility?: RankingVisibility
  settings?: Partial<Settings>
  workspace?: Workspace
}

/** limites [mín, máx] de cada definição numérica */
const NUMERIC: Partial<Record<keyof Settings, [number, number]>> = {
  workMinutes: [1, 600],
  shortBreakMinutes: [1, 120],
  longBreakMinutes: [1, 240],
  longBreakEvery: [1, 20],
  dailyGoalMinutes: [5, 1440],
  idleReminderMinutes: [0, 480],
  reminderStartHour: [0, 23],
  reminderEndHour: [1, 24],
}

export const PATCH = handle(async req => {
  const me = await requireUser()
  const patch = await body<Patch>(req)
  return mutate(userScope(me.id, { memberships: true }), db => {
    const user = db.users.find(u => u.id === me.id)!
    if (patch.name?.trim()) {
      user.name = patch.name.trim().slice(0, 60)
      db.members.forEach(m => { if (m.userId === user.id) m.name = user.name })
    }
    if (patch.rankingVisibility && ['nome', 'iniciais', 'oculto'].includes(patch.rankingVisibility)) {
      user.rankingVisibility = patch.rankingVisibility
    }
    if (patch.settings) {
      const next: Partial<Settings> = { ...user.settings }
      for (const [k, [min, max]] of Object.entries(NUMERIC) as [keyof Settings, [number, number]][]) {
        const v = Number(patch.settings[k])
        if (patch.settings[k] === undefined) continue
        const value = Number.isFinite(v) ? Math.round(v) : (DEFAULT_SETTINGS[k] as number)
        ;(next as Record<string, unknown>)[k] = Math.min(max, Math.max(min, value))
      }
      if (patch.settings.sound !== undefined) next.sound = !!patch.settings.sound
      if (patch.settings.breakAlerts !== undefined) next.breakAlerts = !!patch.settings.breakAlerts
      user.settings = next
    }
    if (patch.workspace) {
      const ws = patch.workspace
      const valid = ws.kind === 'personal' || db.members.some(m => m.id === ws.memberId && m.orgId === ws.orgId && m.userId === user.id)
      if (valid) user.workspace = ws.kind === 'personal' ? { kind: 'personal' } : { kind: 'org', orgId: ws.orgId, memberId: ws.memberId }
    }
    return { user }
  })
})
