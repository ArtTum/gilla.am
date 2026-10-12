import { requireSameOrigin, requireAdmin, readLimitedJson, changeAdminPassword, adminSession, limitLogin } from '../../utils/auth'
export default defineEventHandler(async event => {
  requireSameOrigin(event)
  await requireAdmin(event)
  const resetLimit = limitLogin(event)
  const body = await readLimitedJson(event)
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 200 ||
      typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'New password must contain 12–200 characters.' })
  }
  const auth = await changeAdminPassword(body.currentPassword, body.password)
  const session = await adminSession(event, auth)
  await session.update({ username: auth.username, version: auth.version })
  resetLimit()
  return { ok: true }
})
