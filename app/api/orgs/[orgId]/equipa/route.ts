import { fail, handle, isManager, requireMember } from '../../../../lib/server/api'
import { visibleMembers } from '../../../../lib/server/org'
import { achievementProgress, levelInfo, sumSeconds, totalXp } from '../../../../lib/stats'
import type { TeamProgress } from '../../../../types'

/** Nível, XP e conquistas de cada pessoa da equipa (perfil da empresa e supervisores) */
export const GET = handle<{ orgId: string }>(async (_req, { orgId }) => {
  const { db, me } = await requireMember(orgId, { tasks: true, sessions: true })
  if (!isManager(me)) fail(403, 'Só supervisores e administradores')

  const orgTasks = db.tasks.filter(t => t.orgId === orgId)
  const people: TeamProgress[] = visibleMembers(db, me)
    .filter(m => m.status === 'activo')
    .map(m => {
      const sessions = db.sessions.filter(s => s.memberId === m.id)
      const tasks = orgTasks.filter(t => t.assigneeId === m.id)
      const xp = totalXp(sessions, tasks)
      return {
        id: m.id,
        name: m.name,
        picture: m.picture,
        jobTitle: m.jobTitle,
        departmentId: m.departmentId,
        role: m.role,
        xp,
        level: levelInfo(xp).level,
        seconds: sumSeconds(sessions),
        progress: achievementProgress(sessions, tasks),
      }
    })
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
  return { people }
})
