import { describe, expect, it, vi } from 'vitest'
import { requireCronSecret } from './require-cron-secret.js'

const run = (authorization) => {
    const req = { get: (header) => (header === 'authorization' ? authorization : undefined) }
    const next = vi.fn()
    requireCronSecret(req, {}, next)
    // next() means "allowed"; next(err) means "rejected"
    return next.mock.calls[0][0]
}

describe('requireCronSecret', () => {
    it('lets the request through with the right secret', () => {
        vi.stubEnv('CRON_SECRET', 's3cret')
        expect(run('Bearer s3cret')).toBeUndefined()
    })

    it.each([
        ['a wrong secret', 'Bearer wrong!'],
        ['a wrong secret of a different length', 'Bearer x'],
        ['the secret without "Bearer "', 's3cret'],
        ['no header at all', undefined],
    ])('rejects %s with 401', (_label, header) => {
        vi.stubEnv('CRON_SECRET', 's3cret')
        expect(run(header)?.status).toBe(401)
    })

    // The dangerous case: if the env var is missing, the expected value becomes "Bearer undefined".
    // Failing closed means even that exact string is refused.
    it.each([
        ['unset', undefined],
        ['empty', ''],
    ])('rejects everything when CRON_SECRET is %s', (_label, value) => {
        vi.stubEnv('CRON_SECRET', value)
        expect(run('Bearer undefined')?.status).toBe(401)
        expect(run('Bearer ')?.status).toBe(401)
    })
})
