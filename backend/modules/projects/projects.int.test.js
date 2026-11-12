import { beforeEach, describe, expect, it } from 'vitest'
import { as } from '../../test/api.js'
import { prisma, seedDatabase } from '../../test/db.js'
import { actors, WS } from '../../test/fixtures.js'

beforeEach(seedDatabase)

const newProject = { name: 'Launch', status: 'PLANNING', priority: 'LOW', team_lead: 'u_lead', team_members: ['u_member'] }
const changes = { name: 'Website v2', status: 'ACTIVE', priority: 'HIGH', progress: 40 }
const nameOf = async (id) => (await prisma.project.findUnique({ where: { id } })).name

describe('POST /api/projects', () => {
    it('lets an admin create a project, saved with its lead and members', async () => {
        const res = await as(actors.admin).post('/api/projects', newProject)
        expect(res.status).toBe(201)
        const saved = await prisma.project.findUnique({ where: { id: res.body.id }, include: { members: true } })
        expect(saved.workspaceId).toBe(WS)
        expect(saved.members.map((m) => m.userId).sort()).toEqual(['u_lead', 'u_member'])
    })

    it('refuses a non-admin (403) and saves nothing', async () => {
        const res = await as(actors.lead).post('/api/projects', newProject)
        expect(res.status).toBe(403)
        expect(await prisma.project.count({ where: { name: 'Launch' } })).toBe(0)
    })

    it('rejects a member from another workspace (400)', async () => {
        const res = await as(actors.admin).post('/api/projects', { ...newProject, team_members: ['u_outsider'] })
        expect(res.status).toBe(400)
    })

    it('shows the validation message for bad dates (400)', async () => {
        const res = await as(actors.admin).post('/api/projects', { ...newProject, start_date: '2026-05-10', end_date: '2026-05-01' })
        expect(res.status).toBe(400)
        expect(res.body.message).toBe('End date must be on or after the start date')
    })
})

describe('PUT /api/projects/:id', () => {
    it('lets the team lead update their project', async () => {
        const res = await as(actors.lead).put('/api/projects/p1', changes)
        expect(res.status).toBe(200)
        expect(await nameOf('p1')).toBe('Website v2')
    })

    it.each([
        ['member', 403],
        ['outsider', 404],
    ])('%s → %s, and the project is unchanged', async (actor, status) => {
        const res = await as(actors[actor]).put('/api/projects/p1', changes)
        expect(res.status).toBe(status)
        expect(await nameOf('p1')).toBe('Website')
    })
})

describe('POST /api/projects/:id/members', () => {
    it('lets the lead add a workspace member', async () => {
        const res = await as(actors.lead).post('/api/projects/p1/members', { userId: 'u_member' })
        expect(res.status).toBe(201)
        expect(await prisma.projectMember.count({ where: { projectId: 'p1', userId: 'u_member' } })).toBe(1)
    })

    // Only a real database proves this: the 409 comes from the unique index on (userId, projectId)
    it('answers 409 when the person is already on the project', async () => {
        const res = await as(actors.lead).post('/api/projects/p1/members', { userId: 'u_assignee' })
        expect(res.status).toBe(409)
        expect(res.body.message).toBe('Already a member of this project')
    })

    it('rejects someone from another workspace (400)', async () => {
        const res = await as(actors.lead).post('/api/projects/p1/members', { userId: 'u_outsider' })
        expect(res.status).toBe(400)
    })
})
