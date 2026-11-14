import { vi } from 'vitest'
import { projects, tasks, users } from './fixtures.js'

// Prisma ignores a filter that is undefined, and this fake does the same on purpose: if a service forgot
// to scope a query by workspace, the fake would return another workspace's row and the 404 tests would fail.
const matches = (value, filter) => filter === undefined || value === filter
const idMatches = (id, filter) => (typeof filter === 'object' ? filter.in.includes(id) : matches(id, filter))
const taskMatches = (task, where) => idMatches(task.id, where.id) && matches(task.project.workspaceId, where.project?.workspaceId)

// Reads answer from the fixtures; writes just echo their input so tests can check what would have been saved.
// Tests override any of these with mockResolvedValueOnce, and mockReset puts these defaults back after each test.
export const fakePrisma = {
    project: {
        findFirst: vi.fn(async ({ where }) =>
            projects.find((p) => idMatches(p.id, where.id) && matches(p.workspaceId, where.workspaceId)) ?? null,
        ),
        findUnique: vi.fn(async ({ where }) => projects.find((p) => p.id === where.id) ?? null),
        create: vi.fn(async ({ data }) => ({ id: 'p_new', ...data })),
        update: vi.fn(async ({ where, data }) => ({ ...projects.find((p) => p.id === where.id), ...data })),
    },
    projectMember: {
        count: vi.fn(async () => 1),
        create: vi.fn(async ({ data }) => data),
    },
    task: {
        findFirst: vi.fn(async ({ where }) => tasks.find((t) => taskMatches(t, where)) ?? null),
        findMany: vi.fn(async ({ where }) => tasks.filter((t) => taskMatches(t, where))),
        create: vi.fn(async ({ data }) => ({ id: 't_new', ...data, assignee: users[data.assigneeId] })),
        update: vi.fn(async ({ where, data }) => ({ ...tasks.find((t) => t.id === where.id), ...data })),
        deleteMany: vi.fn(async ({ where }) => ({ count: tasks.filter((t) => taskMatches(t, where)).length })),
    },
    comment: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({ data }) => ({ id: 'c_new', ...data, user: users[data.userId] })),
    },
    workspaceMember: {
        count: vi.fn(async () => 0),
        upsert: vi.fn(async ({ create }) => create),
    },
    workspace: {
        upsert: vi.fn(async ({ create }) => create),
    },
}
