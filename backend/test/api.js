import request from 'supertest'
import app from '../server.js'

// Sends a real HTTP request through the real Express app (routes, validate, requireAuth, error handler)
// without opening a port. `as(actors.lead)` says who is calling; `as(null)` sends no identity at all.
export const as = (auth) => {
    const call = (method) => (url, body) => {
        let req = request(app)[method](url)
        if (auth) req = req.set('x-test-auth', JSON.stringify(auth))
        return body === undefined ? req : req.send(body)
    }
    return { get: call('get'), post: call('post'), put: call('put'), delete: call('delete') }
}
