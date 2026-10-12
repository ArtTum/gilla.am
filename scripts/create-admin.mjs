import { mkdir, writeFile, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'

const directory = resolve(process.env.GILLA_DATA_DIR || '.data')
const authFile = join(directory, 'admin.json')
try {
  await access(authFile)
  console.error('An admin account already exists. Change the password in /admin.')
  process.exit(1)
} catch (error) { if (error.code !== 'ENOENT') throw error }
const username = process.env.GILLA_ADMIN_USERNAME || 'admin'
const password = process.env.GILLA_ADMIN_PASSWORD || randomBytes(18).toString('base64url')
if (password.length < 12 || password.length > 200) throw new Error('Password must contain 12–200 characters.')
const salt = randomBytes(32).toString('hex')
await mkdir(directory, { recursive: true, mode: 0o700 })
await writeFile(authFile, JSON.stringify({ username, salt,
  hash: scryptSync(password, salt, 64).toString('hex'),
  sessionSecret: randomBytes(48).toString('hex'), version: randomBytes(16).toString('hex')
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
await writeFile(join(directory, 'admin-access.txt'),
  `Gilla admin\nURL: https://gilla.am/admin\nUsername: ${username}\nTemporary password: ${password}\nChange this password in the admin Account tab after signing in.\n`,
  { flag: 'wx', mode: 0o600 })
console.log(`Admin account created. Credentials are saved privately in ${join(directory, 'admin-access.txt')}`)
