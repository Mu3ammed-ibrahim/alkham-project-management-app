import { describe, expect, it } from 'vitest'
import { createTaskSchema, deleteTasksSchema, updateTaskStatusSchema } from './schemas.js'

const firstError = (result) => result.error.issues[0].message

const validTask = {
    projectId: 'p1',
    title: 'Fix login button',
    type: 'BUG',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeId: 'user_1',
    due_date: '2026-06-01',
}

describe('createTaskSchema', () => {
    it('accepts a valid task and turns the due date into a Date', () => {
        const result = createTaskSchema.parse(validTask)
        expect(result.due_date).toBeInstanceOf(Date)
        expect(result.description).toBe('')
    })

    // Unlike project dates, due_date is required, so "" must be an error rather than null
    it('rejects an empty due date', () => {
        expect(firstError(createTaskSchema.safeParse({ ...validTask, due_date: '' }))).toBe('Pick a due date')
    })

    it('rejects a missing assignee', () => {
        expect(firstError(createTaskSchema.safeParse({ ...validTask, assigneeId: '' }))).toBe('Pick an assignee')
    })

    it('rejects a title longer than 200 characters', () => {
        expect(createTaskSchema.safeParse({ ...validTask, title: 'a'.repeat(201) }).success).toBe(false)
    })
})

describe('updateTaskStatusSchema', () => {
    it('keeps only the status, so the status route cannot edit anything else', () => {
        const result = updateTaskStatusSchema.parse({ status: 'DONE', title: 'Hacked', assigneeId: 'user_9' })
        expect(result).toEqual({ status: 'DONE' })
    })

    it('rejects a status outside TODO / IN_PROGRESS / DONE', () => {
        expect(updateTaskStatusSchema.safeParse({ status: 'BLOCKED' }).success).toBe(false)
    })
})

describe('deleteTasksSchema', () => {
    const ids = (count) => Array.from({ length: count }, (_, i) => `t${i}`)

    it('rejects an empty selection', () => {
        expect(firstError(deleteTasksSchema.safeParse({ ids: [] }))).toBe('Select at least one task')
    })

    it.each([
        [1, true],
        [100, true],
        [101, false],
    ])('%s ids → valid: %s', (count, valid) => {
        expect(deleteTasksSchema.safeParse({ ids: ids(count) }).success).toBe(valid)
    })
})
