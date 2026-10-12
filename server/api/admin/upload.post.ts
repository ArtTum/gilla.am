import { mkdir, writeFile, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { requireAdmin, requireSameOrigin, readLimitedBody } from '../../utils/auth'
import { dataRoot } from '../../utils/store'

const run = promisify(execFile)
let converting = false

export default defineEventHandler(async event => {
  requireSameOrigin(event)
  await requireAdmin(event)
  const kind = getHeader(event, 'x-file-kind')
  if (kind !== 'pdf' && kind !== 'image') throw createError({ statusCode: 400, statusMessage: 'Invalid file type.' })
  if (converting && kind === 'pdf') throw createError({ statusCode: 429, statusMessage: 'A PDF is being processed. Try again shortly.' })
  const buffer = await readLimitedBody(event, (kind === 'pdf' ? 40 : 10) * 1024 * 1024)
  if (!buffer.length) throw createError({ statusCode: 400, statusMessage: 'Choose a file.' })
  const id = randomUUID()
  const directory = join(dataRoot, 'media', id)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  let ownsConversion = false
  try {
    if (kind === 'image') {
      let extension = ''
      if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) extension = 'png'
      else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) extension = 'jpg'
      else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') extension = 'webp'
      if (!extension) throw createError({ statusCode: 400, statusMessage: 'Choose a PNG, JPG or WebP image.' })
      await writeFile(join(directory, `image.${extension}`), buffer, { mode: 0o600 })
      return { url: `/media/${id}/image.${extension}` }
    }
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw createError({ statusCode: 400, statusMessage: 'Choose a valid PDF document.' })
    if (converting) throw createError({ statusCode: 429, statusMessage: 'A PDF is being processed. Try again shortly.' })
    converting = true
    ownsConversion = true
    const pdf = join(directory, 'menu.pdf')
    await writeFile(pdf, buffer, { mode: 0o600 })
    const info = await run(process.env.GILLA_PDFINFO || 'pdfinfo', [pdf], { timeout: 15000, maxBuffer: 1024 * 1024 })
    const pages = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1])
    if (!Number.isInteger(pages) || pages < 1 || pages > 150) throw createError({ statusCode: 400, statusMessage: 'PDF must contain 1–150 pages.' })
    await run(process.env.GILLA_PDFTOPPM || 'pdftoppm', [
      '-f', '1', '-l', String(pages), '-r', '120', '-scale-to', '1600',
      '-jpeg', '-jpegopt', 'quality=82', pdf, join(directory, 'render')
    ], { timeout: 180000, maxBuffer: 1024 * 1024 })
    const files = (await readdir(directory)).filter(file => /^render-\d+\.jpg$/.test(file))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    if (files.length !== pages) throw new Error('PDF rendering was incomplete')
    for (let index = 0; index < files.length; index++) {
      await rename(join(directory, files[index]!), join(directory, `page-${String(index + 1).padStart(2, '0')}.jpg`))
    }
    return { href: `/media/${id}/menu.pdf`, pageBase: `/media/${id}`, pages }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    if ((error as { statusCode?: number }).statusCode) throw error
    const missingTool = (error as NodeJS.ErrnoException).code === 'ENOENT'
    throw createError({ statusCode: missingTool ? 503 : 422, statusMessage: missingTool
      ? 'PDF converter is unavailable. Install poppler-utils on the server.'
      : 'PDF could not be processed. Use a PDF without password protection.' })
  } finally { if (ownsConversion) converting = false }
})
