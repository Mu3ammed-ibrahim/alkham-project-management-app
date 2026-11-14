import { describe, expect, it } from 'vitest'
import { activeWorkspaceId } from './active-workspace.js'

describe('activeWorkspaceId', () => {
    it('returns the orgId from the verified token', () => {
        expect(activeWorkspaceId({ userId: 'user_1', orgId: 'org_1' })).toBe('org_1')
    })

    it('throws a 400 when the user has no active workspace', () => {
        expect(() => activeWorkspaceId({ userId: 'user_1', orgId: null })).toThrow(
            expect.objectContaining({ status: 400, message: 'Select a workspace first' }),
        )
    })
})