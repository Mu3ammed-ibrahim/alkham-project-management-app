import { beforeEach, describe, expect, it } from 'vitest'
import { as } from '../../test/api.js'
import { seedDatabase } from '../../test/db.js'
import { actors, OTHER_WS, WS } from '../../test/fixtures.js'

beforeEach(seedDatabase)

describe('GET /api/workspaces', () => {
    it('returns only the workspaces the caller belongs to, with projects and tasks nested', async () => {
        const res = await as(actors.lead).get('/api/workspaces')
        expect(res.status).toBe(200)
        expect(res.body.map((w) => w.id)).toEqual([WS])
        const website = res.body[0].projects.find((p) => p.id === 'p1')
        expect(website.tasks.map((t) => t.id).sort()).toEqual(['t1', 't2'])
        expect(website.tasks[0].assignee).toHaveProperty('name')
    })

    it("never leaks another workspace's data", async () => {
        const res = await as(actors.outsider).get('/api/workspaces')
        expect(res.body.map((w) => w.id)).toEqual([OTHER_WS])
        expect(JSON.stringify(res.body)).not.toContain('Fix login')
    })

    it('returns an empty list for a user with no memberships', async () => {
        const res = await as({ userId: 'u_nobody', orgId: null }).get('/api/workspaces')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })
})
