import { requireAdmin } from '../../utils/auth'
export default defineEventHandler(async event => {
  const { auth } = await requireAdmin(event)
  return { username: auth.username }
})
