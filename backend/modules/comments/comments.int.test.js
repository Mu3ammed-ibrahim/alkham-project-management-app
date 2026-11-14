import { beforeEach, describe, expect, it } from 'vitest'
import { as } from '../../test/api.js'
import { prisma, seedDatabase } from '../../test/db.js'
import { actors, users } from '../../test/fixtures.js'
import { sendEmails } from '../notifications/mailer.js'

beforeEach(seedDatabase)

const url = '/api/tasks/t1/comments'

describe('comments on a task', () => {
    it('lets any workspace member comment and read the discussion, without exposing emails', async () => {
        const posted = await as(actors.member).post(url, { content: '  Looks good  ' })
        expect(posted.status).toBe(201)
        expect(posted.body.content).toBe('Looks good')

        const list = await as(actors.lead).get(url)
        expect(list.status).toBe(200)
        expect(list.body).toHaveLength(1)
        expect(list.body[0].user).toEqual({ id: 'u_member', name: users.u_member.name, image: '' })
    })

    it.each(['get', 'post'])('%s returns 404 for a task in another workspace', async (method) => {
        const res = await as(actors.outsider)[method](url, { content: 'Hi' })
        expect(res.status).toBe(404)
    })

    it('rejects an empty comment (400)', async () => {
        const res = await as(actors.lead).post(url, { content: '   ' })
        expect(res.status).toBe(400)
        expect(res.body.message).toBe('Write a comment first')
    })

    // Uses the real createdAt the database writes, so a clock mismatch between server and DB would show up here
    it('emails the assignee once for two quick comments in a row', async () => {
        await as(actors.lead).post(url, { content: 'First' })
        await as(actors.lead).post(url, { content: 'Second' })
        expect(sendEmails).toHaveBeenCalledTimes(1)
        expect(sendEmails.mock.calls[0][0].map((email) => email.to)).toEqual([users.u_assignee.email])
        expect(await prisma.comment.count({ where: { taskId: 't1' } })).toBe(2)
    })
})
