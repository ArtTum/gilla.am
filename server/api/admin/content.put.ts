import { randomUUID } from 'node:crypto'
import { validateContent } from '../../../shared/content'
import { requireSameOrigin, requireAdmin, readLimitedJson } from '../../utils/auth'
import { readContent, atomicJson, withStoreLock, verifyUploadedAssets } from '../../utils/store'
export default defineEventHandler(async event => {
  requireSameOrigin(event)
  await requireAdmin(event)
  let content
  try { content = validateContent(await readLimitedJson(event)) }
  catch (error) {
    if ('statusCode' in (error as object)) throw error
    throw createError({ statusCode: 400, statusMessage: (error as Error).message })
  }
  await verifyUploadedAssets(content)
  return withStoreLock(async () => {
    const previous = await readContent()
    if (previous.revision !== content.revision) throw createError({ statusCode: 409, statusMessage: 'Another tab saved changes. Reload before saving.' })
    await atomicJson(`history/${Date.now()}-${randomUUID()}.json`, previous)
    content.revision = randomUUID()
    await atomicJson('content.json', content)
    return content
  })
})
