import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { defaultContent, validateContent } from '../shared/content.ts'

function onePagePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream'
  ]
  let source = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(source))
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = Buffer.byteLength(source)
  source += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(source)
}

test('content rejects unsafe values and duplicate IDs', () => {
  assert.deepEqual(validateContent(defaultContent), defaultContent)
  for (const mutate of [
    c => { c.settings.mapsUrl = 'javascript:alert(1)' },
    c => { c.settings.logo = '/media/../../admin.json' },
    c => { c.settings.primaryColor = 'red;display:none' },
    c => { c.menus[1].id = c.menus[0].id },
    c => { c.menus[0].pages = 0 }
  ]) {
    const content = structuredClone(defaultContent)
    mutate(content)
    assert.throws(() => validateContent(content))
  }
})

test('built admin: authentication, publishing, uploads and password rotation', async t => {
  await mkdir('tmp', { recursive: true })
  const directory = await mkdtemp(resolve('tmp', 'admin-test-'))
  const port = 3099
  const base = `http://127.0.0.1:${port}`
  const password = 'Gilla-test-password-2026'
  const env = { ...process.env, GILLA_DATA_DIR: directory, GILLA_ADMIN_PASSWORD: password,
    NODE_ENV: 'test', NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port) }
  const created = spawnSync(process.execPath, ['scripts/create-admin.mjs'], { env, encoding: 'utf8' })
  assert.equal(created.status, 0, created.stderr)
  assert.equal(spawnSync(process.execPath, ['scripts/create-admin.mjs'], { env }).status, 1, 'existing account cannot be overwritten')
  const server = spawn(process.execPath, ['.output/server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  server.stdout.on('data', data => { logs += data })
  server.stderr.on('data', data => { logs += data })
  t.after(async () => {
    server.kill()
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve) })
    await rm(directory, { recursive: true, force: true })
  })
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(`${base}/api/site`)).ok) { ready = true; break } } catch {}
    if (server.exitCode !== null) break
    await delay(200)
  }
  assert.ok(ready, logs)
  let cookie = ''
  async function request(path, options = {}) {
    const { json, headers = {}, ...rest } = options
    return fetch(base + path, { ...rest, headers: { origin: base, ...(cookie ? { cookie } : {}),
      ...(json ? { 'content-type': 'application/json' } : {}), ...headers },
      ...(json ? { body: JSON.stringify(json) } : {}) })
  }
  const remember = response => { cookie = response.headers.get('set-cookie').split(';')[0] }
  let content
  await t.test('public defaults and protected APIs', async () => {
    assert.equal((await request('/api/admin/content')).status, 401)
    assert.equal((await request('/api/admin/content', { method: 'PUT', json: defaultContent })).status, 401)
    assert.equal((await request('/api/admin/upload', { method: 'POST', body: 'data', headers: { 'x-file-kind': 'pdf' } })).status, 401)
    const crossOrigin = await request('/api/admin/login', { method: 'POST', json: { username: 'admin', password }, headers: { origin: 'https://attacker.example' } })
    assert.equal(crossOrigin.status, 403)
    assert.equal((await request('/api/admin/login', { method: 'POST', body: 'null' })).status, 400)
    assert.match(await (await request('/')).text(), /Our menus/)
    const admin = await request('/admin')
    assert.equal(admin.status, 200)
    assert.equal(admin.headers.get('x-robots-tag'), 'noindex, nofollow')
    assert.match(await admin.text(), /Բարի գալուստ/)
    const login = await request('/api/admin/login', { method: 'POST', json: { username: 'admin', password } })
    assert.equal(login.status, 200)
    assert.match(login.headers.get('set-cookie'), /HttpOnly/)
    assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i)
    remember(login)
    assert.equal((await request('/api/admin/session')).status, 200)
    content = await (await request('/api/admin/content')).json()
  })
  await t.test('edits persist, drafts stay hidden, stale writes are rejected', async () => {
    const stale = structuredClone(content)
    content.settings.heading = 'Updated restaurant menus'
    content.menus[1].published = false
    let response = await request('/api/admin/content', { method: 'PUT', json: content })
    assert.equal(response.status, 200, await response.clone().text())
    content = await response.json()
    const live = await (await request('/api/site')).json()
    assert.equal(live.settings.heading, content.settings.heading)
    assert.equal(live.menus.length, 1)
    assert.match(await (await request('/')).text(), /Updated restaurant menus/)
    assert.equal((await request('/api/admin/content', { method: 'PUT', json: stale })).status, 409)
    const bad = structuredClone(content); bad.settings.mapsUrl = 'javascript:bad'
    assert.equal((await request('/api/admin/content', { method: 'PUT', json: bad })).status, 400)
    assert.equal((await readdir(join(directory, 'history'))).length, 1)
    assert.equal(JSON.parse(await readFile(join(directory, 'content.json'), 'utf8')).settings.heading, content.settings.heading)
  })
  await t.test('images and PDF page previews, restricted media and byte ranges', async () => {
    assert.equal((await request('/api/admin/upload', { method: 'POST', headers: { 'x-file-kind': 'image' }, body: '<svg></svg>' })).status, 400)
    assert.equal((await request('/api/admin/upload', { method: 'POST', headers: { 'x-file-kind': 'pdf' }, body: 'fake PDF' })).status, 400)
    let response = await request('/api/admin/upload', { method: 'POST', headers: { 'x-file-kind': 'image' }, body: await readFile('public/images/logo.png') })
    assert.equal(response.status, 200, await response.clone().text())
    const image = await response.json()
    content.settings.logo = image.url
    assert.equal((await request(image.url)).headers.get('content-type'), 'image/png')
    response = await request('/api/admin/upload', { method: 'POST', headers: { 'x-file-kind': 'pdf' }, body: onePagePdf() })
    assert.equal(response.status, 200, await response.clone().text())
    const pdf = await response.json()
    assert.equal(pdf.pages, 1)
    assert.equal((await request(`${pdf.pageBase}/page-01.jpg`)).headers.get('content-type'), 'image/jpeg')
    const range = await request(pdf.href, { headers: { range: 'bytes=0-7' } })
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 8)
    assert.equal((await request(pdf.href, { headers: { range: 'bytes=9999999-' } })).status, 416)
    assert.equal((await request(pdf.href, { method: 'HEAD' })).status, 200)
    assert.equal((await request(`${pdf.pageBase}/admin.json`)).status, 404)
    content.menus.push({ ...pdf, id: 'uploaded-menu', title: 'Uploaded menu', description: '', eyebrow: 'New', published: true })
    response = await request('/api/admin/content', { method: 'PUT', json: content })
    assert.equal(response.status, 200, await response.clone().text())
    content = await response.json()
    assert.equal((await (await request('/api/site')).json()).menus.length, 2)
    assert.match(await (await request('/admin')).text(), /Uploaded menu/)
  })
  await t.test('password rotation revokes old sessions and logout clears cookie', async () => {
    const oldCookie = cookie
    const newPassword = 'Changed-gilla-password-2026'
    let response = await request('/api/admin/password', { method: 'POST', json: { currentPassword: password, password: newPassword } })
    assert.equal(response.status, 200, await response.clone().text())
    remember(response)
    assert.equal((await request('/api/admin/session', { headers: { cookie: oldCookie } })).status, 401)
    assert.equal((await request('/api/admin/session')).status, 200)
    assert.equal((await request('/api/admin/login', { method: 'POST', json: { username: 'admin', password } })).status, 401)
    response = await request('/api/admin/login', { method: 'POST', json: { username: 'admin', password: newPassword } })
    assert.equal(response.status, 200); remember(response)
    response = await request('/api/admin/logout', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
    cookie = ''
    assert.equal((await request('/api/admin/content')).status, 401)
  })
  await t.test('request limits and failed-login throttling', async () => {
    assert.equal((await request('/api/admin/login', { method: 'POST', body: 'x'.repeat(140000) })).status, 413)
    for (let index = 0; index < 8; index++) {
      assert.equal((await request('/api/admin/login', { method: 'POST', json: { username: 'admin', password: 'incorrect' }, headers: { 'x-real-ip': '192.0.2.99' } })).status, 401)
    }
    const throttled = await request('/api/admin/login', { method: 'POST', json: { username: 'admin', password }, headers: { 'x-real-ip': '192.0.2.99' } })
    assert.equal(throttled.status, 429)
    assert.ok(Number(throttled.headers.get('retry-after')) > 0)
  })
})
