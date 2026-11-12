import { describe, expect, it } from 'vitest'
import { isOverdue, localDay } from './dates'

// Shaped like the API sends it: the backend stores the picked calendar day as UTC midnight
const dueOn = (day, status = 'TODO') => ({ due_date: `${day}T00:00:00.000Z`, status })
// Built from local clock time, so each case means the same thing in any timezone the tests run in
const at = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute)

describe('isOverdue', () => {
    it('is overdue as soon as the due day is over', () => {
        expect(isOverdue(dueOn('2026-06-01'), at(2026, 6, 2, 0, 1))).toBe(true)
    })

    it('is not overdue before the due day', () => {
        expect(isOverdue(dueOn('2026-06-02'), at(2026, 6, 1, 9))).toBe(false)
    })

    it('a finished task is never overdue', () => {
        expect(isOverdue(dueOn('2026-06-01', 'DONE'), at(2026, 6, 10, 9))).toBe(false)
    })

    it('a task without a due date is not overdue', () => {
        expect(isOverdue({ due_date: null, status: 'TODO' }, at(2026, 6, 10, 9))).toBe(false)
    })

    // Regression: comparing the UTC-midnight instant to "now" used to flag a task overdue during its own due day
    it('a task due today is not overdue at any time that day', () => {
        expect(isOverdue(dueOn('2026-06-01'), at(2026, 6, 1, 9))).toBe(false)
        expect(isOverdue(dueOn('2026-06-01'), at(2026, 6, 1, 23, 59))).toBe(false)
    })
})

describe('localDay', () => {
    // toISOString() fails one of these in any timezone but UTC: just after midnight east of UTC, just before it west
    it.each([
        [at(2026, 1, 5, 0, 30)],
        [at(2026, 1, 5, 23, 30)],
    ])('is the local calendar day all day long (%s)', (date) => {
        expect(localDay(date)).toBe('2026-01-05')
    })
})
