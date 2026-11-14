import { describe, expect, it } from 'vitest'
import { as } from './api.js'
import { actors } from './fixtures.js'

// Every request here is rejected before any query runs, so this file needs no seeded rows
describe('the app', () => {
    it('answers the health check', async () => {
        const res = await as(null).get('/')
        expect(res.status).toBe(200)
        expect(res.text).toBe('server is live')
    })

    // Every route behind requireAuth, called with no identity at all
    it.each([
        ['get', '/api/workspaces'],
        ['post', '/api/projects'],
        ['put', '/api/projects/p1'],
        ['post', '/api/projects/p1/members'],
        ['post', '/api/tasks'],
        ['put', '/api/tasks/t1'],
        ['delete', '/api/tasks'],
        ['get', '/api/tasks/t1/comments'],
        ['post', '/api/tasks/t1/comments'],
    ])('%s %s without a signed-in user → 401', async (method, url) => {
        const res = await as(null)[method](url, {})
        expect(res.status).toBe(401)
        expect(res.body).toEqual({ message: 'Please sign in' })
    })

    it('answers malformed JSON with a 400, not a 500', async () => {
        const res = await as(actors.admin).post('/api/projects').set('Content-Type', 'application/json').send('{"name": ')
        expect(res.status).toBe(400)
    })

    it('rejects a signed-in user with no active workspace (400)', async () => {
        const res = await as({ ...actors.admin, orgId: null }).put('/api/tasks/t1', { status: 'DONE' })
        expect(res.status).toBe(400)
        expect(res.body.message).toBe('Select a workspace first')
    })
})
