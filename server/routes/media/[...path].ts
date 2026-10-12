import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { dataRoot } from '../../utils/store'

export default defineEventHandler(async event => {
  if (!['GET', 'HEAD'].includes(event.method)) throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  const path = getRouterParam(event, 'path') || ''
  if (!/^[a-f0-9-]{36}\/(?:menu\.pdf|image\.(?:png|jpg|webp)|page-\d{2,3}\.jpg)$/.test(path)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }
  const file = join(dataRoot, 'media', path)
  let size: number
  try { size = (await stat(file)).size }
  catch { throw createError({ statusCode: 404, statusMessage: 'File not found' }) }
  const extension = path.split('.').at(-1)!
  setHeaders(event, { 'content-type': ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as Record<string, string>)[extension]!,
    'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes' })
  let start = 0
  let end = size - 1
  const range = getHeader(event, 'range')
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (match && (match[1] || match[2])) {
      if (!match[1]) start = Math.max(0, size - Number(match[2]))
      else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), size - 1) }
    }
    if (!match || (!match[1] && !match[2]) || start > end || start >= size) {
      setHeader(event, 'content-range', `bytes */${size}`)
      throw createError({ statusCode: 416, statusMessage: 'Invalid range' })
    }
    setResponseStatus(event, 206)
    setHeader(event, 'content-range', `bytes ${start}-${end}/${size}`)
  }
  setHeader(event, 'content-length', end - start + 1)
  if (event.method === 'HEAD') return ''
  return sendStream(event, createReadStream(file, { start, end }))
})
