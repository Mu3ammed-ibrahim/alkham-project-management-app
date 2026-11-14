import { describe, expect, it } from 'vitest'
import { canChangeStatus, canManageProject, isAdminRole } from './permissions'

// Same actors and expectations as the backend's role matrix (backend/test/fixtures.js).
// If a rule changes on one side only, one of the two suites goes red and the drift is visible.
const viewers = {
    admin: { userId: 'u_admin', isAdmin: true },
    lead: { userId: 'u_lead', isAdmin: false },
    assignee: { userId: 'u_assignee', isAdmin: false },
    member: { userId: 'u_member', isAdmin: false },
}
const project = { id: 'p1', team_lead: 'u_lead' }
const task = { id: 't1', projectId: 'p1', assigneeId: 'u_assignee' }

describe('isAdminRole', () => {
    it.each([
        ['org:admin', true],
        ['org:member', false],
        [undefined, false],
    ])('%s → %s', (role, expected) => {
        expect(isAdminRole(role)).toBe(expected)
    })
})

describe('role matrix', () => {
    it.each([
        // viewer,     manage project, change status
        ['admin', true, true],
        ['lead', true, true],
        ['assignee', false, true],
        ['member', false, false],
    ])('%s: manage %s, change status %s', (name, manage, status) => {
        expect(canManageProject(viewers[name], project)).toBe(manage)
        expect(canChangeStatus(viewers[name], task, project)).toBe(status)
    })
})

describe('missing data never grants access', () => {
    const signedOut = { userId: undefined, isAdmin: false }

    // Without the Boolean(userId) guard, undefined === undefined would make a signed-out viewer the "lead"
    it('a signed-out viewer is not the lead of a project with no lead', () => {
        expect(canManageProject(signedOut, { team_lead: undefined })).toBe(false)
    })

    it('a signed-out viewer is not the assignee of an unassigned task', () => {
        expect(canChangeStatus(signedOut, { assigneeId: undefined }, project)).toBe(false)
    })

    it('a missing project only blocks non-admins', () => {
        expect(canManageProject(viewers.lead, undefined)).toBe(false)
        expect(canManageProject(viewers.admin, undefined)).toBe(true)
    })
})
