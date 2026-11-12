import { describe, expect, it } from 'vitest'
import { clerkErrorMessage } from './clerk-error'

describe('clerkErrorMessage', () => {
    it.each([
        ['longMessage first', { errors: [{ longMessage: 'Long', message: 'Short' }], message: 'Generic' }, 'Long'],
        ['then message', { errors: [{ message: 'Short' }], message: 'Generic' }, 'Short'],
        ['then the plain Error message', new Error('Network down'), 'Network down'],
        ['empty errors array', { errors: [] }, 'Something went wrong'],
        ['undefined', undefined, 'Something went wrong'],
    ])('%s', (_label, error, expected) => {
        expect(clerkErrorMessage(error)).toBe(expected)
    })
})
