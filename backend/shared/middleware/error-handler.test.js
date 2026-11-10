import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../http-error.js'
import { errorHandler } from './error-handler.js'

// Minimal stand-in for Express's res: status() must return res so .json() can chain
const fakeRes = () => {
    const res = { status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)
    return res
}

describe('errorHandler', () => {
    it('shows the status and message of our own HttpError', () => {
        const res = fakeRes()
        errorHandler(new HttpError(403, 'Only admins can create projects'), {}, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({ message: 'Only admins can create projects' })
    })

    it("shows Express's own exposable errors, e.g. malformed JSON", () => {
        const res = fakeRes()
        const err = Object.assign(new SyntaxError('Unexpected token } in JSON'), { status: 400, expose: true })
        errorHandler(err, {}, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ message: 'Unexpected token } in JSON' })
    })

    it('hides unexpected errors behind a generic 500 and logs the real one', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const res = fakeRes()
        const err = new Error('connect ECONNREFUSED db.internal:5432')
        errorHandler(err, {}, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({ message: 'Something went wrong' })
        expect(log).toHaveBeenCalledWith(err)
    })
})
