import { describe, expect, it } from 'vitest'
import { createCommentSchema } from './schemas.js'

const firstError = (result) => result.error.issues[0].message

describe('createCommentSchema', () => {
    it('trims surrounding whitespace', () => {
        expect(createCommentSchema.parse({ content: '  Looks good  ' })).toEqual({ content: 'Looks good' })
    })

    it('rejects a comment that is only whitespace', () => {
        expect(firstError(createCommentSchema.safeParse({ content: '   \n ' }))).toBe('Write a comment first')
    })

    it('allows exactly 2000 characters and rejects 2001', () => {
        expect(createCommentSchema.safeParse({ content: 'a'.repeat(2000) }).success).toBe(true)
        expect(firstError(createCommentSchema.safeParse({ content: 'a'.repeat(2001) }))).toBe(
            'Comments can be at most 2000 characters',
        )
    })
})
