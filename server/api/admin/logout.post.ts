import { requireSameOrigin, requireAdmin } from '../../utils/auth'
export default defineEventHandler(async event => {
  requireSameOrigin(event)
  const { session } = await requireAdmin(event)
  await session.clear()
  deleteCookie(event, 'gilla-admin', { path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
  return { ok: true }
})
