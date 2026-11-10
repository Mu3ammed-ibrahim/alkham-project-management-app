import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { HttpError } from '../http-error.js'
import { validate } from './validate.js'

const schema = z.object({
    name: z.string().min(1, { error: 'Name is required' }),
    age: z.coerce.number({ error: 'Age must be a number' }),
})

// Middleware is just a function of (req, res, next): call it and inspect what it passed to next
const run = (body) => {
    const req = { body }
    const next = vi.fn()
    validate(schema)(req, {}, next)
    return { req, next }
}

describe('validate middleware', () => {
    it('passes a valid body through and calls next() with no error', () => {
        const { next } = run({ name: 'Sara', age: 30 })
        expect(next).toHaveBeenCalledWith()
    })

    it('replaces req.body with the parsed data: unknown fields stripped, values coerced', () => {
        const { req } = run({ name: 'Sara', age: '30', isAdmin: true })
        expect(req.body).toEqual({ name: 'Sara', age: 30 })
    })

    it('rejects an invalid body with a 400 HttpError', () => {
        const { next } = run({ name: '', age: 30 })
        const err = next.mock.calls[0][0]
        expect(err).toBeInstanceOf(HttpError)
        expect(err.status).toBe(400)
        expect(err.message).toBe('Name is required')
    })

    it('reports only the first issue when several fields are wrong', () => {
        const { next } = run({ name: '', age: 'abc' })
        expect(next.mock.calls[0][0].message).toBe('Name is required')
    })

    it('treats a missing body as {} instead of crashing', () => {
        const { next } = run(undefined)
        expect(next.mock.calls[0][0].status).toBe(400)
    })
})
