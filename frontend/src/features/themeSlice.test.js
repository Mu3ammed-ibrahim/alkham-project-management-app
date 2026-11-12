import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { loadTheme, setTheme, toggleTheme } from './themeSlice'

const htmlIsDark = () => document.documentElement.classList.contains('dark')

// jsdom keeps localStorage and <html> between tests in a file, so reset both
beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
})

describe('themeSlice', () => {
    it('toggleTheme switches light ↔ dark, remembers it, and flips the <html> class', () => {
        const dark = reducer({ theme: 'light' }, toggleTheme())
        expect(dark.theme).toBe('dark')
        expect(localStorage.getItem('theme')).toBe('dark')
        expect(htmlIsDark()).toBe(true)

        const light = reducer(dark, toggleTheme())
        expect(light.theme).toBe('light')
        expect(localStorage.getItem('theme')).toBe('light')
        expect(htmlIsDark()).toBe(false)
    })

    it('loadTheme restores a saved dark theme', () => {
        localStorage.setItem('theme', 'dark')
        expect(reducer({ theme: 'light' }, loadTheme()).theme).toBe('dark')
        expect(htmlIsDark()).toBe(true)
    })

    it('loadTheme keeps light when nothing is saved', () => {
        expect(reducer({ theme: 'light' }, loadTheme()).theme).toBe('light')
        expect(htmlIsDark()).toBe(false)
    })

    it('setTheme only changes state', () => {
        expect(reducer({ theme: 'light' }, setTheme('dark')).theme).toBe('dark')
        expect(htmlIsDark()).toBe(false)
    })
})
