import { beforeEach, describe, expect, it, vi } from 'vitest'
import { as } from '../../test/api.js'
import { prisma, seedDatabase } from '../../test/db.js'
import { actors, users } from '../../test/fixtures.js'
import { sendEmails } from '../notifications/mailer.js'

beforeEach(seedDatabase)

const newTask = {
    projectId: 'p1',
    title: 'Add footer',
    type: 'TASK',
    status: 'TODO',
    priority: 'LOW',
    assigneeId: 'u_assignee',
    due_date: '2026-06-01',
}
const statusOf = async (id) => (await prisma.task.findUnique({ where: { id } })).status
const remaining = (ids) => prisma.task.count({ where: { id: { in: ids } } })

describe('POST /api/tasks', () => {
    it('lets the lead create a task and emails the assignee', async () => {
        const res = await as(actors.lead).post('/api/tasks', newTask)
        expect(res.status).toBe(201)
        expect(res.body.assignee.id).toBe('u_assignee')
        expect(sendEmails).toHaveBeenCalledWith([expect.objectContaining({ to: users.u_assignee.email })])
    })

    it('rejects an assignee who is in the workspace but not on the project (400)', async () => {
        const res = await as(actors.lead).post('/api/tasks', { ...newTask, assigneeId: 'u_member' })
        expect(res.status).toBe(400)
        expect(res.body.message).toBe('The assignee must be a member of this project')
    })

    it('returns 404 for an outsider, even an admin of their own workspace', async () => {
        const res = await as(actors.outsider).post('/api/tasks', newTask)
        expect(res.status).toBe(404)
    })
})

describe('PUT /api/tasks/:id', () => {
    it('lets the assignee change the status', async () => {
        const res = await as(actors.assignee).put('/api/tasks/t1', { status: 'DONE' })
        expect(res.status).toBe(200)
        expect(await statusOf('t1')).toBe('DONE')
    })

    it('ignores anything but the status in the body', async () => {
        await as(actors.assignee).put('/api/tasks/t1', { status: 'DONE', title: 'Hacked', assigneeId: 'u_member' })
        const task = await prisma.task.findUnique({ where: { id: 't1' } })
        expect(task).toMatchObject({ title: 'Fix login', assigneeId: 'u_assignee' })
    })

    it.each([
        ['member', 403],
        ['outsider', 404],
    ])('%s → %s, and the status is unchanged', async (actor, status) => {
        const res = await as(actors[actor]).put('/api/tasks/t1', { status: 'DONE' })
        expect(res.status).toBe(status)
        expect(await statusOf('t1')).toBe('TODO')
    })
})

describe('DELETE /api/tasks', () => {
    it('deletes the selected tasks and their comments (cascade)', async () => {
        await prisma.comment.create({ data: { content: 'Note', taskId: 't1', userId: 'u_lead' } })
        const res = await as(actors.admin).delete('/api/tasks', { ids: ['t1', 't3'] })
        expect(res.body).toEqual({ deleted: 2 })
        expect(await remaining(['t1', 't3'])).toBe(0)
        expect(await prisma.comment.count({ where: { taskId: 't1' } })).toBe(0)
    })

    // All or nothing, checked on real rows: a rejected selection leaves every task in place
    it.each([
        ['the lead includes a project they do not lead', 'lead', ['t1', 't3'], 403],
        ['an admin includes another workspace task', 'admin', ['t1', 't_other'], 404],
    ])('when %s → %s, and nothing is deleted', async (_label, actor, ids, status) => {
        const res = await as(actors[actor]).delete('/api/tasks', { ids })
        expect(res.status).toBe(status)
        expect(await remaining(ids)).toBe(ids.length)
    })

    it('rejects more than 100 ids (400)', async () => {
        const ids = Array.from({ length: 101 }, (_, i) => `t${i}`)
        expect((await as(actors.admin).delete('/api/tasks', { ids })).status).toBe(400)
    })
})

describe('GET /api/tasks/due-reminders (Vercel Cron)', () => {
    const tomorrowUtc = () => {
        const now = new Date()
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    }
    const cron = (secret) => as(null).get('/api/tasks/due-reminders').set('Authorization', `Bearer ${secret}`)

    beforeEach(() => vi.stubEnv('CRON_SECRET', 'test-cron-secret'))

    it('refuses a request without the right secret (401)', async () => {
        expect((await cron('wrong')).status).toBe(401)
    })

    it('reminds the assignee of every unfinished task due tomorrow, across workspaces', async () => {
        await prisma.task.updateMany({ where: { id: { in: ['t1', 't_other'] } }, data: { due_date: tomorrowUtc() } })
        await prisma.task.update({ where: { id: 't2' }, data: { due_date: tomorrowUtc(), status: 'DONE' } })

        const res = await cron('test-cron-secret')
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ sent: 2, failed: 0 })
        const recipients = sendEmails.mock.calls[0][0].map((email) => email.to).sort()
        expect(recipients).toEqual([users.u_assignee.email, users.u_outsider.email].sort())
    })
})
