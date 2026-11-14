import { prisma } from '../shared/db/prisma.js'
import { OTHER_WS, projects, tasks, users, WS } from './fixtures.js'

// The same cast as the service tests, now as real rows. u_member is in the workspace but on no project.
const workspaceMembers = [
    { userId: 'u_admin', workspaceId: WS, role: 'ADMIN' },
    { userId: 'u_lead', workspaceId: WS, role: 'MEMBER' },
    { userId: 'u_assignee', workspaceId: WS, role: 'MEMBER' },
    { userId: 'u_member', workspaceId: WS, role: 'MEMBER' },
    { userId: 'u_outsider', workspaceId: OTHER_WS, role: 'ADMIN' },
]

const projectMembers = [
    { userId: 'u_lead', projectId: 'p1' },
    { userId: 'u_assignee', projectId: 'p1' },
    { userId: 'u_admin', projectId: 'p2' },
    { userId: 'u_assignee', projectId: 'p2' },
    { userId: 'u_outsider', projectId: 'p_other' },
]

const FAR_FUTURE = new Date('2030-01-01T00:00:00Z')

// Wipes the test branch and rebuilds the same small world, so every test starts from a known state.
// Each round trip to Neon costs ~300 ms from a home connection, so rows that don't depend on each other
// are inserted in parallel: 5 round trips instead of 7. Each level waits for the rows its foreign keys need.
export const seedDatabase = async () => {
    await prisma.$executeRawUnsafe(
        'TRUNCATE "Comment", "Task", "ProjectMember", "Project", "WorkspaceMember", "Workspace", "User" CASCADE',
    )
    await prisma.user.createMany({ data: Object.values(users) })
    await prisma.workspace.createMany({
        data: [
            { id: WS, name: 'Alkham', slug: 'alkham', ownerId: 'u_admin' },
            { id: OTHER_WS, name: 'Other Co', slug: 'other-co', ownerId: 'u_outsider' },
        ],
    })
    await Promise.all([
        prisma.workspaceMember.createMany({ data: workspaceMembers }),
        prisma.project.createMany({ data: projects }),
    ])
    await Promise.all([
        prisma.projectMember.createMany({ data: projectMembers }),
        prisma.task.createMany({ data: tasks.map(({ project, ...task }) => ({ ...task, due_date: FAR_FUTURE })) }),
    ])
}

export { prisma }
