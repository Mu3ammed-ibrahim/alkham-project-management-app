import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { actors, outcome, users } from '../../test/fixtures.js'
import { HttpError } from '../../shared/http-error.js'
import { prisma } from '../../shared/db/prisma.js'
import { findTaskInWorkspace } from '../tasks/index.js'
import { sendCommentEmails } from '../notifications/index.js'
import { createComment, listComments } from './service.js'

// The workspace check itself is tested in tasks/service.test.js; here it's faked so each test can pick the answer
vi.mock('../../shared/db/prisma.js', async () => ({ prisma: (await import('../../test/fake-prisma.js')).fakePrisma }))
vi.mock('../tasks/index.js', async () => {
    const { users } = await import('../../test/fixtures.js')
    return {
        findTaskInWorkspace: vi.fn(async () => ({ id: 't1', title: 'Fix login', projectId: 'p1', assignee: users.u_assignee })),
    }
})
vi.mock('../notifications/index.js', () => ({ sendCommentEmails: vi.fn(async () => ({ sent: 1, failed: 0 })) }))

const NOW = new Date('2026-03-04T12:00:00Z')
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000)
const commenters = (...ids) => ids.map((id) => ({ user: users[id] }))
const recipientsOf = () => sendCommentEmails.mock.calls[0][0].recipients

// isFollowUp reads Date.now(), so the clock is frozen to make "5 minutes ago" exact
beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('workspace check', () => {
    it.each([
        ['listComments', (auth) => listComments(auth, 't1')],
        ['createComment', (auth) => createComment(auth, 't1', { content: 'Hi' })],
    ])('%s returns 404 and touches no comments when the task is not in the workspace', async (_name, call) => {
        findTaskInWorkspace.mockRejectedValueOnce(new HttpError(404, 'Task not found'))
        expect(await outcome(call(actors.outsider))).toBe(404)
        expect(prisma.comment.findMany).not.toHaveBeenCalled()
        expect(prisma.comment.create).not.toHaveBeenCalled()
    })

    // Intentional: any workspace member may join the discussion, even if they're not on the project
    it('lets a plain member who is not on the project comment', async () => {
        expect(await outcome(createComment(actors.member, 't1', { content: 'Hi' }))).toBe('ok')
    })
})

describe('createComment', () => {
    it('saves the comment as the signed-in user', async () => {
        await createComment(actors.member, 't1', { content: 'Looks good' })
        expect(prisma.comment.create.mock.calls[0][0].data).toEqual({ content: 'Looks good', taskId: 't1', userId: 'u_member' })
    })

    it('emails the assignee and earlier commenters, but not the author', async () => {
        prisma.comment.findMany.mockResolvedValueOnce(commenters('u_lead', 'u_member'))
        await createComment(actors.member, 't1', { content: 'Done?' })
        expect(recipientsOf()).toEqual([
            { email: users.u_assignee.email, name: users.u_assignee.name },
            { email: users.u_lead.email, name: users.u_lead.name },
        ])
    })

    it('emails the assignee once even if they also commented', async () => {
        prisma.comment.findMany.mockResolvedValueOnce(commenters('u_assignee'))
        await createComment(actors.lead, 't1', { content: 'Any update?' })
        expect(recipientsOf()).toHaveLength(1)
    })

    it('sends no email when the author is the only person involved', async () => {
        await createComment(actors.assignee, 't1', { content: 'Note to self' })
        expect(sendCommentEmails).not.toHaveBeenCalled()
    })

    it('cuts the preview to 300 characters', async () => {
        await createComment(actors.lead, 't1', { content: 'a'.repeat(500) })
        expect(sendCommentEmails.mock.calls[0][0].preview).toHaveLength(300)
    })

    describe('follow-up grouping', () => {
        it.each([
            ['the same author, 4 minutes ago', false, 'u_lead', 4],
            ['the same author, 6 minutes ago', true, 'u_lead', 6],
            ['someone else, 1 minute ago', true, 'u_member', 1],
        ])('latest comment by %s → email sent: %s', async (_label, emailed, lastAuthor, minutes) => {
            prisma.comment.findFirst.mockResolvedValueOnce({ userId: lastAuthor, createdAt: minutesAgo(minutes) })
            await createComment(actors.lead, 't1', { content: 'One more thing' })
            expect(sendCommentEmails).toHaveBeenCalledTimes(emailed ? 1 : 0)
        })

        it('still saves a follow-up comment that sends no email', async () => {
            prisma.comment.findFirst.mockResolvedValueOnce({ userId: 'u_lead', createdAt: minutesAgo(1) })
            await createComment(actors.lead, 't1', { content: 'Typo fix' })
            expect(prisma.comment.create).toHaveBeenCalled()
        })
    })
})

describe('listComments', () => {
    it("lists the task's comments oldest first", async () => {
        await listComments(actors.member, 't1')
        expect(prisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { taskId: 't1' }, orderBy: { createdAt: 'asc' } }),
        )
    })

    it("never selects the authors' email addresses", async () => {
        await listComments(actors.member, 't1')
        expect(prisma.comment.findMany.mock.calls[0][0].include.user.select).not.toHaveProperty('email')
    })
})
