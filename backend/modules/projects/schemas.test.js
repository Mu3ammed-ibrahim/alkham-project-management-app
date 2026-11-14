import { describe, expect, it } from 'vitest'
import { addMemberSchema, createProjectSchema, updateProjectSchema } from './schemas.js'

const firstError = (result) => result.error.issues[0]

const validProject = { name: 'Website relaunch', status: 'ACTIVE', priority: 'HIGH' }

describe('createProjectSchema', () => {
    it('fills in defaults for optional fields', () => {
        const result = createProjectSchema.parse(validProject)
        expect(result).toMatchObject({
            description: '',
            progress: 0,
            team_members: [],
            start_date: null,
            end_date: null,
        })
    })

    it('turns an empty date input ("") into null instead of an invalid date', () => {
        const result = createProjectSchema.parse({ ...validProject, start_date: '', end_date: '' })
        expect(result.start_date).toBeNull()
        expect(result.end_date).toBeNull()
    })

    it('rejects an end date before the start date, on the end_date field', () => {
        const result = createProjectSchema.safeParse({ ...validProject, start_date: '2026-05-10', end_date: '2026-05-09' })
        expect(result.success).toBe(false)
        expect(firstError(result)).toMatchObject({
            message: 'End date must be on or after the start date',
            path: ['end_date'],
        })
    })

    it('allows a project that starts and ends on the same day', () => {
        const result = createProjectSchema.safeParse({ ...validProject, start_date: '2026-05-10', end_date: '2026-05-10' })
        expect(result.success).toBe(true)
    })

    it('allows only one of the two dates', () => {
        expect(createProjectSchema.safeParse({ ...validProject, end_date: '2026-05-10' }).success).toBe(true)
    })

    it('rejects a name that is only spaces', () => {
        const result = createProjectSchema.safeParse({ ...validProject, name: '   ' })
        expect(firstError(result).message).toBe('Project name is required')
    })

    it('rejects an unknown status', () => {
        expect(createProjectSchema.safeParse({ ...validProject, status: 'ARCHIVED' }).success).toBe(false)
    })

    it.each([
        [-1, false],
        [0, true],
        [100, true],
        [101, false],
        [50.5, false],
        ['40', true],
    ])('progress %s → valid: %s', (progress, valid) => {
        expect(createProjectSchema.safeParse({ ...validProject, progress }).success).toBe(valid)
    })

    it('strips fields the client must not control', () => {
        const result = createProjectSchema.parse({ ...validProject, workspaceId: 'org_someone_else', id: 'p1' })
        expect(result).not.toHaveProperty('workspaceId')
        expect(result).not.toHaveProperty('id')
    })
})

describe('updateProjectSchema', () => {
    it('requires progress, unlike create', () => {
        expect(updateProjectSchema.safeParse(validProject).success).toBe(false)
        expect(updateProjectSchema.safeParse({ ...validProject, progress: 10 }).success).toBe(true)
    })

    it('has no team_lead or team_members, so an update cannot change them', () => {
        const result = updateProjectSchema.parse({ ...validProject, progress: 10, team_lead: 'user_2', team_members: ['user_3'] })
        expect(result).not.toHaveProperty('team_lead')
        expect(result).not.toHaveProperty('team_members')
    })
})

describe('addMemberSchema', () => {
    it('requires a userId', () => {
        expect(firstError(addMemberSchema.safeParse({ userId: '' })).message).toBe('Pick a member to add')
    })
})
