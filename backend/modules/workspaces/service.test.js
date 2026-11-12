import { describe, expect, it, vi } from 'vitest'
import { WS } from '../../test/fixtures.js'
import { prisma } from '../../shared/db/prisma.js'
import { ensureUser } from '../users/index.js'
import { areWorkspaceMembers, upsertMember, upsertWorkspace } from './service.js'

vi.mock('../../shared/db/prisma.js', async () => ({ prisma: (await import('../../test/fake-prisma.js')).fakePrisma }))
vi.mock('../users/index.js', () => ({ ensureUser: vi.fn(async () => {}) }))

describe('areWorkspaceMembers', () => {
    it('is true when every user is a member', async () => {
        prisma.workspaceMember.count.mockResolvedValueOnce(2)
        expect(await areWorkspaceMembers(['u_lead', 'u_member'], WS)).toBe(true)
    })

    it('is false when anyone is missing', async () => {
        prisma.workspaceMember.count.mockResolvedValueOnce(1)
        expect(await areWorkspaceMembers(['u_lead', 'u_stranger'], WS)).toBe(false)
    })

    it('counts a repeated user once', async () => {
        prisma.workspaceMember.count.mockResolvedValueOnce(1)
        expect(await areWorkspaceMembers(['u_lead', 'u_lead'], WS)).toBe(true)
        expect(prisma.workspaceMember.count).toHaveBeenCalledWith({ where: { workspaceId: WS, userId: { in: ['u_lead'] } } })
    })

    // KNOWN QUIRK: 0 members found === 0 asked for. No caller can pass [] today (a project always has its lead),
    // but a new caller must not treat this as "everyone checks out".
    it('KNOWN QUIRK: returns true for an empty list', async () => {
        expect(await areWorkspaceMembers([], WS)).toBe(true)
    })
})

// Clerk webhooks (via Inngest) can arrive out of order, so these rules keep old events from overwriting new data
describe('workspace sync', () => {
    const org = { id: 'org_new', name: 'New Co', slug: null, image_url: null, created_by: 'u_admin' }
    const membership = (role) => ({ organization: org, public_user_data: { user_id: 'u_member' }, role })

    it('uses the org id as the slug when Clerk has slugs turned off', async () => {
        await upsertWorkspace(org)
        expect(prisma.workspace.upsert.mock.calls[0][0].create).toMatchObject({ slug: 'org_new', image_url: '' })
    })

    it('waits for the membership event when the org has no known owner', async () => {
        expect(await upsertWorkspace({ ...org, created_by: undefined })).toBeNull()
        expect(prisma.workspace.upsert).not.toHaveBeenCalled()
    })

    it('a membership event creates a missing workspace but never overwrites an existing one', async () => {
        await upsertMember(membership('org:member'))
        expect(prisma.workspace.upsert.mock.calls[0][0].update).toEqual({})
    })

    it('makes sure both the owner and the member exist as users', async () => {
        await upsertMember(membership('org:member'))
        expect(ensureUser).toHaveBeenCalledWith('u_admin')
        expect(ensureUser).toHaveBeenCalledWith('u_member')
    })

    it.each([
        ['org:admin', 'ADMIN'],
        ['org:member', 'MEMBER'],
        ['org:billing_manager', 'MEMBER'],
    ])('maps Clerk role %s to %s', async (clerkRole, role) => {
        await upsertMember(membership(clerkRole))
        expect(prisma.workspaceMember.upsert.mock.calls[0][0].create.role).toBe(role)
    })
})
