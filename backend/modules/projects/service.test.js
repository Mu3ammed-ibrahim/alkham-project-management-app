import { describe, expect, it, vi } from 'vitest'
import { actors, outcome, WS } from '../../test/fixtures.js'
import { prisma } from '../../shared/db/prisma.js'
import { areWorkspaceMembers } from '../workspaces/index.js'
import { addProjectMember, createProject, isProjectMember, updateProject } from './service.js'

// vi.mock is hoisted above the imports, so every import above (and inside service.js) gets these fakes
vi.mock('../../shared/db/prisma.js', async () => ({ prisma: (await import('../../test/fake-prisma.js')).fakePrisma }))
vi.mock('../workspaces/index.js', () => ({ areWorkspaceMembers: vi.fn(async () => true) }))

const newProject = { name: 'Launch', status: 'PLANNING', priority: 'LOW', team_members: [] }
const changes = { name: 'Website v2', status: 'ACTIVE', priority: 'HIGH', progress: 40 }

describe('createProject', () => {
    it.each([
        ['admin', 'ok'],
        ['lead', 403],
        ['assignee', 403],
        ['member', 403],
    ])('%s → %s', async (actor, expected) => {
        expect(await outcome(createProject(actors[actor], newProject))).toBe(expected)
    })

    it('saves nothing when the caller is not an admin', async () => {
        await outcome(createProject(actors.member, newProject))
        expect(prisma.project.create).not.toHaveBeenCalled()
    })

    it('rejects a caller with no active workspace (400)', async () => {
        expect(await outcome(createProject({ ...actors.admin, orgId: null }, newProject))).toBe(400)
    })

    it('always uses the workspace from the token, never one from the input', async () => {
        await createProject(actors.admin, { ...newProject, workspaceId: 'org_someone_else' })
        expect(prisma.project.create.mock.calls[0][0].data.workspaceId).toBe(WS)
    })

    it('makes the creator the lead when none is picked', async () => {
        await createProject(actors.admin, newProject)
        const { data } = prisma.project.create.mock.calls[0][0]
        expect(data.team_lead).toBe('u_admin')
        expect(data.members.create).toEqual([{ userId: 'u_admin' }])
    })

    it('adds the lead to the members and drops duplicates', async () => {
        await createProject(actors.admin, { ...newProject, team_lead: 'u_lead', team_members: ['u_member', 'u_lead', 'u_member'] })
        expect(prisma.project.create.mock.calls[0][0].data.members.create).toEqual([{ userId: 'u_lead' }, { userId: 'u_member' }])
        expect(areWorkspaceMembers).toHaveBeenCalledWith(['u_lead', 'u_member'], WS)
    })

    it('rejects people who are not in the workspace (400) and saves nothing', async () => {
        areWorkspaceMembers.mockResolvedValueOnce(false)
        expect(await outcome(createProject(actors.admin, { ...newProject, team_members: ['u_stranger'] }))).toBe(400)
        expect(prisma.project.create).not.toHaveBeenCalled()
    })
})

// Both routes go through findManageableProject, so they share one role matrix
describe.each([
    ['updateProject', (auth, projectId = 'p1') => updateProject(auth, projectId, changes)],
    ['addProjectMember', (auth, projectId = 'p1') => addProjectMember(auth, projectId, { userId: 'u_member' })],
])('%s', (_name, call) => {
    it.each([
        ['admin', 'ok'],
        ['lead', 'ok'],
        ['assignee', 403],
        ['member', 403],
        // 404, not 403: a 403 would confirm the project exists in someone else's workspace
        ['outsider', 404],
    ])('%s → %s', async (actor, expected) => {
        expect(await outcome(call(actors[actor]))).toBe(expected)
    })

    it('returns 404 for a project id that does not exist', async () => {
        expect(await outcome(call(actors.admin, 'p_missing'))).toBe(404)
    })

    it('lets the lead manage only the project they lead', async () => {
        // u_lead leads p1, but p2 is led by the admin
        expect(await outcome(call(actors.lead, 'p2'))).toBe(403)
    })

    it('refuses an outsider even when they know the project id', async () => {
        await outcome(call(actors.outsider))
        expect(prisma.project.update).not.toHaveBeenCalled()
        expect(prisma.projectMember.create).not.toHaveBeenCalled()
    })
})

describe('addProjectMember rules', () => {
    it('rejects someone who is not in the workspace (400)', async () => {
        areWorkspaceMembers.mockResolvedValueOnce(false)
        expect(await outcome(addProjectMember(actors.admin, 'p1', { userId: 'u_stranger' }))).toBe(400)
        expect(prisma.projectMember.create).not.toHaveBeenCalled()
    })

    it("checks membership in the project's workspace", async () => {
        await addProjectMember(actors.admin, 'p1', { userId: 'u_member' })
        expect(areWorkspaceMembers).toHaveBeenCalledWith(['u_member'], WS)
    })

    it('turns a duplicate member (Prisma P2002) into 409', async () => {
        prisma.projectMember.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }))
        expect(await outcome(addProjectMember(actors.admin, 'p1', { userId: 'u_lead' }))).toBe(409)
    })

    it('passes any other database error through unchanged', async () => {
        const dbDown = new Error('Connection lost')
        prisma.projectMember.create.mockRejectedValueOnce(dbDown)
        expect(await outcome(addProjectMember(actors.admin, 'p1', { userId: 'u_member' }))).toBe(dbDown)
    })
})

describe('isProjectMember', () => {
    it.each([
        [1, true],
        [0, false],
    ])('count %s → %s', async (count, expected) => {
        prisma.projectMember.count.mockResolvedValueOnce(count)
        expect(await isProjectMember('u_member', 'p1')).toBe(expected)
    })
})
