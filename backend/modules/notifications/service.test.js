import { beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from '../../test/fixtures.js'
import { sendEmails } from './mailer.js'
import { sendCommentEmails, sendDueReminders, sendTaskAssignedEmail } from './service.js'

// Resend is never called: the mailer is replaced by a fake that reports every email as sent
vi.mock('./mailer.js', () => ({ sendEmails: vi.fn(async (emails) => ({ sent: emails.length, failed: 0 })) }))

const assignment = {
    taskId: 't1',
    projectId: 'p1',
    title: 'Fix login',
    dueDate: new Date('2026-03-05T00:00:00Z'),
    projectName: 'Website',
    assignee: users.u_assignee,
    assignedBy: 'u_lead',
}

const sentEmails = () => sendEmails.mock.calls[0][0]

beforeEach(() => {
    // deliver() logs failures; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendTaskAssignedEmail', () => {
    it('emails the assignee', async () => {
        expect(await sendTaskAssignedEmail(assignment)).toEqual({ sent: 1, failed: 0 })
        expect(sentEmails()).toEqual([expect.objectContaining({ to: users.u_assignee.email, subject: "You've been assigned: Fix login" })])
    })

    it('sends nothing when you assign a task to yourself', async () => {
        expect(await sendTaskAssignedEmail({ ...assignment, assignedBy: 'u_assignee' })).toEqual({ sent: 0, failed: 0 })
        expect(sendEmails).not.toHaveBeenCalled()
    })
})

describe('sendCommentEmails', () => {
    it('sends one email per recipient, each addressed by name', async () => {
        const recipients = [users.u_assignee, users.u_lead].map(({ email, name }) => ({ email, name }))
        await sendCommentEmails({ taskId: 't1', projectId: 'p1', taskTitle: 'Fix login', authorName: 'member', preview: 'Hi', recipients })
        expect(sentEmails().map((email) => email.to)).toEqual([users.u_assignee.email, users.u_lead.email])
        expect(sentEmails()[1].text).toContain(`Hi ${users.u_lead.name}`)
    })
})

describe('sendDueReminders', () => {
    it('sends one reminder per task', async () => {
        const task = { ...assignment, assignee: users.u_assignee }
        expect(await sendDueReminders([task, { ...task, assignee: users.u_lead }])).toEqual({ sent: 2, failed: 0 })
    })
})

// Email is a side effect of a save that already happened, so a mail failure must never fail the request
describe('never throws', () => {
    it('reports every email as failed when the mailer throws', async () => {
        sendEmails.mockRejectedValueOnce(new Error('MAIL_FROM is not set'))
        expect(await sendTaskAssignedEmail(assignment)).toEqual({ sent: 0, failed: 1 })
        expect(console.error).toHaveBeenCalledWith('Failed to send task-assigned email:', 'MAIL_FROM is not set')
    })

    it('resolves even when building the email itself fails', async () => {
        await expect(sendDueReminders([{ ...assignment, assignee: undefined }])).resolves.toEqual({ sent: 0, failed: 0 })
        expect(sendEmails).not.toHaveBeenCalled()
    })
})
