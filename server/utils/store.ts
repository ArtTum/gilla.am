import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { defaultContent, type SiteContent } from '../../shared/content'

export const dataRoot = resolve(process.env.GILLA_DATA_DIR || '.data')

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(join(dataRoot, file), 'utf8'))
}

export async function atomicJson(file: string, data: unknown) {
  const destination = join(dataRoot, file)
  await mkdir(resolve(destination, '..'), { recursive: true, mode: 0o700 })
  const temporary = `${destination}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, destination)
}

export async function readContent(): Promise<SiteContent> {
  try { return await readJson<SiteContent>('content.json') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return structuredClone(defaultContent)
  }
}

let pending: Promise<unknown> = Promise.resolve()
export function withStoreLock<T>(action: () => Promise<T>): Promise<T> {
  const next = pending.then(action, action)
  pending = next.catch(() => undefined)
  return next
}

export async function verifyUploadedAssets(content: SiteContent) {
  const paths = [content.settings.logo, content.settings.background,
    ...content.menus.flatMap(menu => [menu.href, `${menu.pageBase}/page-${String(menu.pages).padStart(2, '0')}.jpg`])]
  for (const path of paths.filter(path => path.startsWith('/media/'))) {
    try { await access(join(dataRoot, path.slice(1))) }
    catch { throw createError({ statusCode: 400, statusMessage: 'Uploaded file is missing. Upload it again.' }) }
  }
}
