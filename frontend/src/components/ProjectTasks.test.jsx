import { useOrganization, useUser } from '@clerk/react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { renderWithStore } from '../test/render-with-store'
import ProjectTasks from './ProjectTasks'

// Clerk needs a real session, so the two hooks usePermissions reads are faked per test
vi.mock('@clerk/react', () => ({ useOrganization: vi.fn(), useUser: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { put: vi.fn(), delete: vi.fn() } }))

const project = { id: 'p1', name: 'Website', team_lead: 'u_lead' }
const tasks = [
    { id: 't1', projectId: 'p1', title: 'Fix login', type: 'BUG', priority: 'HIGH', status: 'TODO', assigneeId: 'u_assignee', assignee: { id: 'u_assignee', name: 'Sara' }, due_date: '2026-06-01T00:00:00.000Z' },
    { id: 't2', projectId: 'p1', title: 'Write docs', type: 'TASK', priority: 'LOW', status: 'TODO', assigneeId: 'u_lead', assignee: { id: 'u_lead', name: 'Omar' }, due_date: '2026-06-02T00:00:00.000Z' },
]
const viewers = {
    admin: { userId: 'u_admin', role: 'org:admin' },
    lead: { userId: 'u_lead', role: 'org:member' },
    assignee: { userId: 'u_assignee', role: 'org:member' },
    member: { userId: 'u_member', role: 'org:member' },
}

const signInAs = ({ userId, role }) => {
    useUser.mockReturnValue({ user: { id: userId } })
    useOrganization.mockReturnValue({ membership: { role } })
}

const renderTasks = () => {
    const workspace = { id: 'ws1', projects: [{ ...project, tasks }] }
    return renderWithStore(<ProjectTasks tasks={tasks} project={project} />, {
        preloadedState: { workspace: { workspaces: [workspace], currentWorkspace: workspace, loading: false, error: null } },
    })
}

// jsdom loads no CSS, so both layouts render: the desktop table rows, then the mobile cards.
// That gives [row t1, row t2, card t1, card t2], which also proves the two layouts agree.
const statusDropdownsEnabled = () =>
    screen.getAllByRole('combobox', { name: 'Status' }).map((select) => !select.disabled)

describe('ProjectTasks permissions', () => {
    it.each([
        // viewer,  can edit status of [t1, t2] in both layouts
        ['admin', [true, true, true, true]],
        ['lead', [true, true, true, true]],
        ['assignee', [true, false, true, false]],
        ['member', [false, false, false, false]],
    ])('%s: status dropdowns enabled → %j', (name, expected) => {
        signInAs(viewers[name])
        renderTasks()
        expect(statusDropdownsEnabled()).toEqual(expected)
    })

    it.each(['admin', 'lead'])('%s can select tasks for deletion', (name) => {
        signInAs(viewers[name])
        renderTasks()
        expect(screen.getByRole('checkbox', { name: 'Select all visible tasks' })).toBeInTheDocument()
        expect(screen.getAllByRole('checkbox', { name: 'Select Fix login' })).toHaveLength(2)
    })

    it.each(['assignee', 'member'])('%s sees no selection checkboxes', (name) => {
        signInAs(viewers[name])
        renderTasks()
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    })
})

describe('ProjectTasks actions', () => {
    beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true))

    it('the assignee changes a status: the API is called and the store is updated', async () => {
        signInAs(viewers.assignee)
        api.put.mockResolvedValue({ data: { ...tasks[0], status: 'DONE' } })
        const { store } = renderTasks()

        await userEvent.selectOptions(screen.getAllByRole('combobox', { name: 'Status' })[0], 'DONE')

        expect(api.put).toHaveBeenCalledWith('/api/tasks/t1', { status: 'DONE' })
        expect(store.getState().workspace.currentWorkspace.projects[0].tasks[0].status).toBe('DONE')
    })

    it('the lead deletes a selected task: the API gets its id and it leaves the store', async () => {
        signInAs(viewers.lead)
        api.delete.mockResolvedValue({ data: { deleted: 1 } })
        const { store } = renderTasks()

        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
        await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select Fix login' })[0])
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

        expect(api.delete).toHaveBeenCalledWith('/api/tasks', { data: { ids: ['t1'] } })
        const remaining = store.getState().workspace.currentWorkspace.projects[0].tasks.map((t) => t.id)
        expect(remaining).toEqual(['t2'])
    })
})
