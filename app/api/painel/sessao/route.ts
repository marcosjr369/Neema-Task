import { cookies } from 'next/headers'
import { body, handle } from '../../../lib/server/api'
import { confirmLogin, createToken, hasPanelSession, PANEL_COOKIE, PANEL_COOKIE_PATH, PANEL_TTL, panelEmail } from '../../../lib/server/panel'

const COOKIE = { httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: PANEL_COOKIE_PATH }

export const GET = handle(async () => {
  const ok = await hasPanelSession()
  return { ok, email: ok ? panelEmail() : undefined }
})

export const POST = handle(async req => {
  const { email, password } = await body<{ email?: string; password?: string }>(req)
  await confirmLogin(req, email, password)
  ;(await cookies()).set(PANEL_COOKIE, createToken(), { ...COOKIE, maxAge: PANEL_TTL / 1000 })
  return { ok: true }
})

export const DELETE = handle(async () => {
  ;(await cookies()).set(PANEL_COOKIE, '', { ...COOKIE, maxAge: 0 })
  return { ok: true }
})
