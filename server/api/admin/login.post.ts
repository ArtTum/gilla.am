import { requireSameOrigin, limitLogin, readLimitedJson, readAuth, passwordMatches, adminSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const resetLimit = limitLogin(event)
  const body = await readLimitedJson(event)
  if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.password.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Enter your username and password.' })
  }
  const auth = await readAuth()
  const matches = await passwordMatches(body.password, auth)
  if (!matches || body.username !== auth.username) throw createError({ statusCode: 401, statusMessage: 'Username or password is incorrect.' })
  const session = await adminSession(event, auth)
  await session.update({ username: auth.username, version: auth.version })
  resetLimit()
  return { username: auth.username }
})
