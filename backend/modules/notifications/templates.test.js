import { describe, expect, it, vi } from 'vitest'
import { commentsEmail, taskAssignedEmail, taskDueEmail } from './templates.js'

const task = {
    assignee: { name: 'Sara' },
    title: 'Fix login',
    projectName: 'Website',
    dueDate: new Date('2026-03-05T00:00:00.000Z'),
    projectId: 'p1',
    taskId: 't1',
}

describe('task emails', () => {
    // The same rules apply to both task emails, so one table covers both
    describe.each([
        ['taskAssignedEmail', taskAssignedEmail, "You've been assigned: Fix login"],
        ['taskDueEmail', taskDueEmail, 'Due tomorrow: Fix login'],
    ])('%s', (_name, build, subject) => {
        it('has the expected subject', () => {
            expect(build(task).subject).toBe(subject)
        })

        it('escapes user-written text in the HTML, but not in the plain-text version', () => {
            const email = build({ ...task, title: '<script>alert(1)</script>', assignee: { name: 'Tom & "Jerry"' } })
            expect(email.html).not.toContain('<script>')
            expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
            expect(email.html).toContain('Tom &amp; &quot;Jerry&quot;')
            expect(email.text).toContain('<script>alert(1)</script>')
        })

        // Stored as UTC midnight: formatting in the server's local zone could show 4 Mar
        it('formats the due date in UTC so it shows the day the user picked', () => {
            expect(build(task).text).toContain('5 Mar 2026')
        })

        it('links to the task when FRONTEND_URL is set, ignoring a trailing slash', () => {
            vi.stubEnv('FRONTEND_URL', 'https://app.example.com/')
            const email = build(task)
            expect(email.text).toContain('https://app.example.com/taskDetails?projectId=p1&taskId=t1')
            // "&" in an href must be escaped as &amp;
            expect(email.html).toContain('href="https://app.example.com/taskDetails?projectId=p1&amp;taskId=t1"')
        })

        it('has no link when FRONTEND_URL is not set', () => {
            vi.stubEnv('FRONTEND_URL', '')
            const email = build(task)
            expect(email.html).not.toContain('Open task')
            expect(email.text).not.toContain('Open the task:')
        })

        it('has no link when the task id is missing', () => {
            vi.stubEnv('FRONTEND_URL', 'https://app.example.com')
            expect(build({ ...task, taskId: undefined }).html).not.toContain('Open task')
        })
    })
})

describe('commentsEmail', () => {
    const comment = {
        recipient: { name: 'Sara' },
        taskTitle: 'Fix login',
        authorName: 'Omar',
        preview: 'Can you check <b>this</b>?',
        projectId: 'p1',
        taskId: 't1',
    }

    it('names the author and task in the subject', () => {
        expect(commentsEmail(comment).subject).toBe('Omar commented on Fix login')
    })

    it('escapes the comment preview in the HTML', () => {
        const { html } = commentsEmail(comment)
        expect(html).toContain('Can you check &lt;b&gt;this&lt;/b&gt;?')
        expect(html).not.toContain('<b>this</b>')
    })
})
