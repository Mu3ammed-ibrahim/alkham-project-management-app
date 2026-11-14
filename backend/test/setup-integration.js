// Runs before every *.int.test.js file, BEFORE the file's own imports, so prisma.js connects to the
// test branch. Order matters: env first, then the safety guard, then mocks.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { afterAll, vi } from 'vitest'

const backendFile = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url))

// Locally the test URLs come from .env.test; in CI they come from GitHub secrets (no file)
if (existsSync(backendFile('.env.test'))) {
    dotenv.config({ path: backendFile('.env.test'), override: true, quiet: true })
}

// SAFETY GUARD: these tests TRUNCATE every table. Refuse to run unless we are certainly on the test branch.
const hostOf = (url) => (url ? new URL(url).hostname : undefined)
const production = existsSync(backendFile('.env')) ? dotenv.parse(readFileSync(backendFile('.env'))) : {}

if (process.env.NEON_BRANCH !== 'test') {
    throw new Error(`Integration tests need NEON_BRANCH=test (got "${process.env.NEON_BRANCH}"). Check backend/.env.test.`)
}
if (!process.env.DATABASE_URL) {
    throw new Error('Integration tests need DATABASE_URL pointing at the Neon test branch.')
}
if (hostOf(process.env.DATABASE_URL) === hostOf(production.DATABASE_URL)) {
    throw new Error('DATABASE_URL is the same database as backend/.env (production). Refusing to wipe it.')
}

// Clerk: the real middleware verifies a signed token. Here the test says who it is in an
// x-test-auth header instead. The real requireAuth still runs, so "no header → 401" is real.
vi.mock('@clerk/express', () => ({
    clerkMiddleware: () => (req, res, next) => next(),
    getAuth: (req) => JSON.parse(req.get('x-test-auth') ?? '{}'),
    clerkClient: { users: { getUser: vi.fn() } },
}))

// Resend: never send real email from tests. Everything else (notifications/service, templates) runs for real.
vi.mock('../modules/notifications/mailer.js', () => ({
    sendEmails: vi.fn(async (emails) => ({ sent: emails.length, failed: 0 })),
}))

// Imported only now, after the guard has passed, so a wrong URL never even opens a connection.
// Closing it lets the test worker exit instead of waiting on an idle Neon socket.
afterAll(async () => {
    const { prisma } = await import('../shared/db/prisma.js')
    await prisma.$disconnect()
})
