import { handle, requireMember } from '../../../../lib/server/api'
import { read } from '../../../../lib/server/store'
import { bookingView } from '../../../../lib/server/events'

const DAY = 24 * 3600 * 1000

/**
 * As reservas das salas do mapa (por omissão, hoje e amanhã), para toda a empresa. Quem não
 * participa numa reunião vê só a sala e o horário (sem título nem pessoas).
 */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const now = Date.now()
  const from = Number(url.searchParams.get('from')) || now - DAY / 2
  const to = Number(url.searchParams.get('to')) || now + 1.5 * DAY
  const [{ me }, db] = await Promise.all([
    requireMember(orgId),
    read(async l => l.load('events', { org_id: orgId, start_at: { gte: from - DAY, lte: to } })),
  ])
  const bookings = db.events
    .filter(e => e.orgId === orgId && e.roomId && e.end > from && e.start < to)
    .sort((a, b) => a.start - b.start)
    .map(e => bookingView(e, me.id))
  return { bookings }
})
