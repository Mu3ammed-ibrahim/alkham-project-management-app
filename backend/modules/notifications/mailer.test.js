import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmails } from './mailer.js'

// vi.hoisted creates `send` early enough for the hoisted vi.mock factory below to use it
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { batch = { send } } }))

const emails = (count) => Array.from({ length: count }, (_, i) => ({ to: `person${i}@alkham.test`, subject: 'Hi', html: '', text: '' }))
const ok = (chunk) => ({ data: { data: chunk.map((_, i) => ({ id: `m${i}` })) }, error: null })

beforeEach(() => {
    vi.stubEnv('MAIL_FROM', 'Alkham <noreply@alkham.test>')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    send.mockImplementation(async (chunk) => ok(chunk))
})

describe('sendEmails', () => {
    it('sends in batches of at most 100 (Resend limit)', async () => {
        expect(await sendEmails(emails(250))).toEqual({ sent: 250, failed: 0 })
        expect(send.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 50])
    })

    it('adds the sender and asks Resend to report bad addresses one by one', async () => {
        await sendEmails(emails(1))
        const [chunk, options] = send.mock.calls[0]
        expect(chunk[0].from).toBe('Alkham <noreply@alkham.test>')
        expect(options).toEqual({ batchValidation: 'permissive' })
    })

    it('makes no calls for an empty list', async () => {
        expect(await sendEmails([])).toEqual({ sent: 0, failed: 0 })
        expect(send).not.toHaveBeenCalled()
    })

    it('counts a whole failed batch as failed and still sends the next ones', async () => {
        send.mockImplementationOnce(async (chunk) => ok(chunk))
            .mockImplementationOnce(async () => ({ data: null, error: { name: 'rate_limit_exceeded', message: 'Too many requests' } }))
        expect(await sendEmails(emails(250))).toEqual({ sent: 150, failed: 100 })
        expect(send).toHaveBeenCalledTimes(3)
    })

    it('counts single rejected addresses without failing the rest', async () => {
        send.mockResolvedValueOnce({ data: { data: [], errors: [{ index: 1, message: 'Invalid `to` field' }] }, error: null })
        expect(await sendEmails(emails(3))).toEqual({ sent: 2, failed: 1 })
        expect(console.error).toHaveBeenCalledWith('Resend rejected the email to person1@alkham.test:', 'Invalid `to` field')
    })

    it('throws when MAIL_FROM is not set (notifications/service turns this into a logged failure)', async () => {
        vi.stubEnv('MAIL_FROM', '')
        await expect(sendEmails(emails(1))).rejects.toThrow('MAIL_FROM is not set')
    })
})
