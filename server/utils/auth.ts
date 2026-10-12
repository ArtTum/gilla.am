import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { H3Event } from 'h3'
import { readJson, atomicJson, withStoreLock } from './store'

export interface AdminAuth {
  username: string
  salt: string
  hash: string
  sessionSecret: string
  version: string
}
const deriveKey = promisify(scrypt)

export async function readAuth() {
  try { return await readJson<AdminAuth>('admin.json') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    throw createError({ statusCode: 503, statusMessage: 'Admin account has not been configured.' })
  }
}

export async function passwordMatches(password: string, auth: AdminAuth) {
  const actual = await deriveKey(password, auth.salt, 64) as Buffer
  const expected = Buffer.from(auth.hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function adminSession(event: H3Event, existingAuth?: AdminAuth) {
  const auth = existingAuth || await readAuth()
  return useSession<{ username: string; version: string }>(event, {
    name: 'gilla-admin', password: auth.sessionSecret, maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' }
  })
}

export async function requireAdmin(event: H3Event) {
  const auth = await readAuth()
  const session = await adminSession(event, auth)
  if (session.data.username !== auth.username || session.data.version !== auth.version) {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in.' })
  }
  return { auth, session }
}

export function requireSameOrigin(event: H3Event) {
  const origin = getHeader(event, 'origin')
  const host = getHeader(event, 'host')
  try {
    const url = new URL(origin || '')
    if (url.host !== host || !['http:', 'https:'].includes(url.protocol)) throw new Error()
  } catch { throw createError({ statusCode: 403, statusMessage: 'Invalid request origin.' }) }
}

// Limits actual bytes, including chunked requests with no Content-Length.
export async function readLimitedBody(event: H3Event, limit: number): Promise<Buffer> {
  if (Number(getHeader(event, 'content-length') || 0) > limit) {
    throw createError({ statusCode: 413, statusMessage: 'File is too large.' })
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw createError({ statusCode: 413, statusMessage: 'File is too large.' })
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

export async function readLimitedJson(event: H3Event) {
  const body = await readLimitedBody(event, 128 * 1024)
  try {
    const parsed = JSON.parse(body.toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed
  }
  catch { throw createError({ statusCode: 400, statusMessage: 'Invalid request.' }) }
}

const attempts = new Map<string, { count: number; until: number }>()
export function limitLogin(event: H3Event) {
  const now = Date.now()
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key)
  const ip = getHeader(event, 'x-real-ip') || getRequestIP(event) || 'unknown'
  const current = attempts.get(ip) || { count: 0, until: now + 15 * 60 * 1000 }
  if (current.count >= 8 || attempts.size > 10000) {
    setHeader(event, 'retry-after', String(Math.ceil((current.until - now) / 1000)))
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again in 15 minutes.' })
  }
  current.count++
  attempts.set(ip, current)
  return () => attempts.delete(ip)
}

export async function changeAdminPassword(currentPassword: string, password: string) {
  return withStoreLock(async () => {
    const auth = await readAuth()
    if (!await passwordMatches(currentPassword, auth)) throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect.' })
    const salt = randomBytes(32).toString('hex')
    const hash = (await deriveKey(password, salt, 64) as Buffer).toString('hex')
    const updated = { ...auth, salt, hash, sessionSecret: randomBytes(48).toString('hex'), version: randomBytes(16).toString('hex') }
    await atomicJson('admin.json', updated)
    return updated
  })
}
