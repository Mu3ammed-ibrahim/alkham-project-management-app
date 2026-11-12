import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import reducer, {
    addProject,
    addTask,
    addWorkspace,
    deleteTask,
    deleteWorkspace,
    fetchWorkspaces,
    setCurrentWorkspace,
    updateProject,
    updateTask,
    updateWorkspace,
} from './workspaceSlice'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))

// Built fresh per call: reducers must never see a fixture another test already changed
const makeState = () => {
    const ws = {
        id: 'ws1',
        name: 'Alkham',
        projects: [
            { id: 'p1', name: 'Website', tasks: [{ id: 't1', projectId: 'p1', title: 'Fix login', status: 'TODO' }] },
            { id: 'p2', name: 'App', tasks: [{ id: 't2', projectId: 'p2', title: 'Ship', status: 'TODO' }] },
        ],
    }
    const other = { id: 'ws2', name: 'Other', projects: [] }
    return { workspaces: [ws, other], currentWorkspace: ws, loading: false, error: null }
}

// Both copies of the workspace (the list and currentWorkspace) must stay in step after every change
const bothCopies = (state) => [state.currentWorkspace, state.workspaces.find((w) => w.id === state.currentWorkspace.id)]

describe('initial state', () => {
    it('starts loading, so the first render shows a spinner rather than "no workspaces"', () => {
        expect(reducer(undefined, { type: '@@init' })).toEqual({ workspaces: [], currentWorkspace: null, loading: true, error: null })
    })
})

describe('workspace reducers', () => {
    it('setCurrentWorkspace picks by id, or null for an unknown id', () => {
        expect(reducer(makeState(), setCurrentWorkspace('ws2')).currentWorkspace.id).toBe('ws2')
        expect(reducer(makeState(), setCurrentWorkspace('nope')).currentWorkspace).toBeNull()
    })

    it('addWorkspace appends it and makes it current', () => {
        const state = reducer(makeState(), addWorkspace({ id: 'ws3', projects: [] }))
        expect(state.workspaces.map((w) => w.id)).toEqual(['ws1', 'ws2', 'ws3'])
        expect(state.currentWorkspace.id).toBe('ws3')
    })

    it('updateWorkspace replaces it in the list and as current', () => {
        const state = reducer(makeState(), updateWorkspace({ id: 'ws1', name: 'Renamed', projects: [] }))
        expect(bothCopies(state).map((w) => w.name)).toEqual(['Renamed', 'Renamed'])
    })

    it('deleteWorkspace removes it from the list', () => {
        expect(reducer(makeState(), deleteWorkspace('ws2')).workspaces.map((w) => w.id)).toEqual(['ws1'])
    })
})

describe('project and task reducers', () => {
    it('addProject adds to both copies', () => {
        const state = reducer(makeState(), addProject({ id: 'p3', tasks: [] }))
        bothCopies(state).forEach((w) => expect(w.projects.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']))
    })

    it('updateProject replaces the matching project in both copies', () => {
        const state = reducer(makeState(), updateProject({ id: 'p1', name: 'Website v2', tasks: [] }))
        bothCopies(state).forEach((w) => expect(w.projects[0].name).toBe('Website v2'))
    })

    it('addTask adds to the right project in both copies', () => {
        const state = reducer(makeState(), addTask({ id: 't9', projectId: 'p2', title: 'New' }))
        bothCopies(state).forEach((w) => expect(w.projects[1].tasks.map((t) => t.id)).toEqual(['t2', 't9']))
    })

    it('updateTask replaces the task in both copies', () => {
        const state = reducer(makeState(), updateTask({ id: 't1', projectId: 'p1', title: 'Fix login', status: 'DONE' }))
        bothCopies(state).forEach((w) => expect(w.projects[0].tasks[0].status).toBe('DONE'))
    })

    // Bulk delete sends ids from any project, so every project has to be filtered
    it('deleteTask removes ids that span projects, from both copies', () => {
        const state = reducer(makeState(), deleteTask(['t1', 't2']))
        bothCopies(state).forEach((w) => expect(w.projects.flatMap((p) => p.tasks)).toEqual([]))
    })
})

describe('fetchWorkspaces', () => {
    const fulfilled = (state, workspaces, activeOrgId) =>
        reducer(state, fetchWorkspaces.fulfilled(workspaces, 'request-id', activeOrgId))
    const list = [{ id: 'ws1' }, { id: 'ws2' }]

    it.each([
        ["Clerk's active organization first", { currentWorkspace: { id: 'ws1' } }, 'ws2', 'ws2'],
        ['then the previous current workspace', { currentWorkspace: { id: 'ws2' } }, 'gone', 'ws2'],
        ['then the first workspace', { currentWorkspace: null }, undefined, 'ws1'],
    ])('picks %s', (_label, before, activeOrgId, expected) => {
        const state = fulfilled({ ...makeState(), ...before, loading: true }, list, activeOrgId)
        expect(state.currentWorkspace.id).toBe(expected)
        expect(state.loading).toBe(false)
    })

    it('sets current to null when the user has no workspaces', () => {
        expect(fulfilled(makeState(), [], 'ws1').currentWorkspace).toBeNull()
    })

    it("stores the API's message when the request fails", async () => {
        api.get.mockRejectedValue({ message: 'Request failed', response: { data: { message: 'Not signed in' } } })
        const store = configureStore({ reducer: { workspace: reducer } })

        await store.dispatch(fetchWorkspaces('ws1'))

        expect(store.getState().workspace).toMatchObject({ loading: false, error: 'Not signed in' })
    })
})
