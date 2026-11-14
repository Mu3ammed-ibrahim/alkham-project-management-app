import { describe, expect, it, vi } from 'vitest'
import { actors, outcome, users, WS } from '../../test/fixtures.js'
import { prisma } from '../../shared/db/prisma.js'
import { sendDueReminders, sendTaskAssignedEmail } from '../notifications/index.js'
import {
    createTask,
    deleteTasks,
    findTaskInWorkspace,
    findTasksDueTomorrow,
    sendDueTomorrowReminders,
    updateTaskStatus,
} from './service.js'

// The real projects service stays in, so createTask is checked through the real findManageableProject rules
vi.mock('../../shared/db/prisma.js', async () => ({ prisma: (await import('../../test/fake-prisma.js')).fakePrisma }))
vi.mock('../workspaces/index.js', () => ({ areWorkspaceMembers: vi.fn(async () => true) }))
vi.mock('../notifications/index.js', () => ({
    sendTaskAssignedEmail: vi.fn(async () => ({ sent: 1, failed: 0 })),
    sendDueReminders: vi.fn(async () => ({ sent: 0, failed: 0 })),
}))

const newTask = {
    projectId: 'p1',
    title: 'Add footer',
    type: 'TASK',
    status: 'TODO',
    priority: 'LOW',
    assigneeId: 'u_assignee',
    due_date: new Date('2026-06-01'),
}

describe('createTask', () => {
    it.each([
        ['admin', 'ok'],
        ['lead', 'ok'],
        ['assignee', 403],
        ['member', 403],
        ['outsider', 404],
    ])('%s → %s', async (actor, expected) => {
        expect(await outcome(createTask(actors[actor], newTask))).toBe(expected)
    })

    it('rejects an assignee who is not on the project (400), saving and emailing nothing', async () => {
        prisma.projectMember.count.mockResolvedValueOnce(0)
        expect(await outcome(createTask(actors.admin, newTask))).toBe(400)
        expect(prisma.task.create).not.toHaveBeenCalled()
        expect(sendTaskAssignedEmail).not.toHaveBeenCalled()
    })

    it('emails the assignee after saving, saying who assigned it', async () => {
        await createTask(actors.lead, newTask)
        expect(sendTaskAssignedEmail).toHaveBeenCalledWith(
            expect.objectContaining({ taskId: 't_new', projectName: 'Website', assignee: users.u_assignee, assignedBy: 'u_lead' }),
        )
    })
})

describe('updateTaskStatus', () => {
    it.each([
        ['admin', 'ok'],
        ['lead', 'ok'],
        ['assignee', 'ok'],
        ['member', 403],
        ['outsider', 404],
    ])('%s → %s', async (actor, expected) => {
        expect(await outcome(updateTaskStatus(actors[actor], 't1', { status: 'DONE' }))).toBe(expected)
    })

    it('lets an assignee change only their own task', async () => {
        // u_lead is assigned t2, not t1, and doesn't lead p2, so t3 is off limits
        expect(await outcome(updateTaskStatus(actors.lead, 't3', { status: 'DONE' }))).toBe(403)
    })

    it('saves only the status', async () => {
        await updateTaskStatus(actors.admin, 't1', { status: 'DONE', title: 'Hacked' })
        expect(prisma.task.update.mock.calls[0][0].data).toEqual({ status: 'DONE' })
    })

    it('returns 404 for a task id that does not exist', async () => {
        expect(await outcome(updateTaskStatus(actors.admin, 't_missing', { status: 'DONE' }))).toBe(404)
    })
})

describe('deleteTasks', () => {
    it.each([
        ['admin deletes across projects', 'ok', 'admin', ['t1', 't3']],
        ['lead deletes in the project they lead', 'ok', 'lead', ['t1', 't2']],
        ['lead includes a task from a project they do not lead', 403, 'lead', ['t1', 't3']],
        ['assignee deletes their own task', 403, 'assignee', ['t1']],
        ['plain member', 403, 'member', ['t1']],
        ['admin includes a task from another workspace', 404, 'admin', ['t1', 't_other']],
        ['admin of another workspace', 404, 'outsider', ['t1']],
        ['a task id that does not exist', 404, 'admin', ['t1', 't_missing']],
    ])('%s → %s', async (_label, expected, actor, ids) => {
        expect(await outcome(deleteTasks(actors[actor], { ids }))).toBe(expected)
    })

    // All or nothing: a rejected selection must not delete the tasks that *were* allowed
    it.each([
        ['lead', ['t1', 't3']],
        ['admin', ['t1', 't_other']],
    ])('deletes nothing when %s sends a partly invalid selection', async (actor, ids) => {
        await outcome(deleteTasks(actors[actor], { ids }))
        expect(prisma.task.deleteMany).not.toHaveBeenCalled()
    })

    it('counts a repeated id once', async () => {
        expect(await deleteTasks(actors.admin, { ids: ['t1', 't1'] })).toEqual({ deleted: 1 })
        expect(prisma.task.findMany.mock.calls[0][0].where.id).toEqual({ in: ['t1'] })
    })

    it('scopes the delete query itself to the workspace too', async () => {
        await deleteTasks(actors.admin, { ids: ['t1'] })
        expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['t1'] }, project: { workspaceId: WS } } })
    })
})

describe('findTaskInWorkspace', () => {
    it('finds a task in the caller workspace whatever their role', async () => {
        expect(await outcome(findTaskInWorkspace(actors.member, 't1'))).toBe('ok')
    })

    it('returns 404 for a task in another workspace', async () => {
        expect(await outcome(findTaskInWorkspace(actors.outsider, 't1'))).toBe(404)
    })
})

describe('findTasksDueTomorrow', () => {
    const windowFor = async (now) => {
        await findTasksDueTomorrow(new Date(now))
        const { due_date } = prisma.task.findMany.mock.calls[0][0].where
        return [due_date.gte.toISOString(), due_date.lt.toISOString()]
    }

    it.each([
        ['early morning', '2026-03-04T00:00:00Z', '2026-03-05T00:00:00.000Z', '2026-03-06T00:00:00.000Z'],
        ['one second before midnight', '2026-03-04T23:59:59Z', '2026-03-05T00:00:00.000Z', '2026-03-06T00:00:00.000Z'],
        ['the last day of a month', '2026-02-28T06:00:00Z', '2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'],
        ['new year eve', '2026-12-31T06:00:00Z', '2027-01-01T00:00:00.000Z', '2027-01-02T00:00:00.000Z'],
    ])('on %s, looks at all of tomorrow in UTC', async (_label, now, from, to) => {
        expect(await windowFor(now)).toEqual([from, to])
    })

    it('skips tasks that are already done', async () => {
        await findTasksDueTomorrow(new Date('2026-03-04T06:00:00Z'))
        expect(prisma.task.findMany.mock.calls[0][0].where.status).toEqual({ not: 'DONE' })
    })

    it('returns each task in the shape the reminder email needs', async () => {
        const dueDate = new Date('2026-03-05T00:00:00Z')
        prisma.task.findMany.mockResolvedValueOnce([
            { id: 't1', projectId: 'p1', title: 'Fix login', due_date: dueDate, assignee: users.u_assignee, project: { name: 'Website' } },
        ])
        expect(await findTasksDueTomorrow(new Date('2026-03-04T06:00:00Z'))).toEqual([
            { taskId: 't1', projectId: 'p1', title: 'Fix login', dueDate, projectName: 'Website', assignee: users.u_assignee },
        ])
    })

    it('hands what it found to the reminder sender', async () => {
        prisma.task.findMany.mockResolvedValueOnce([])
        await sendDueTomorrowReminders()
        expect(sendDueReminders).toHaveBeenCalledWith([])
    })
})
