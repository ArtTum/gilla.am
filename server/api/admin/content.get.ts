import { requireAdmin } from '../../utils/auth'
import { readContent } from '../../utils/store'
export default defineEventHandler(async event => {
  await requireAdmin(event)
  return readContent()
})
