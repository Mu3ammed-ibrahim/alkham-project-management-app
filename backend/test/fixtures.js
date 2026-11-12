// Shared cast for the service tests: one workspace with a project led by `lead`, plus a second workspace
export const WS = 'org_alkham'
export const OTHER_WS = 'org_other'

export const users = Object.fromEntries(
    ['u_admin', 'u_lead', 'u_assignee', 'u_member', 'u_outsider'].map((id) => [
        id,
        { id, email: `${id.slice(2)}@alkham.test`, name: id.slice(2) },
    ]),
)

// The `auth` object requireAuth builds from the Clerk token
export const actors = {
    admin: { userId: 'u_admin', orgId: WS, orgRole: 'org:admin' },
    lead: { userId: 'u_lead', orgId: WS, orgRole: 'org:member' },
    assignee: { userId: 'u_assignee', orgId: WS, orgRole: 'org:member' },
    member: { userId: 'u_member', orgId: WS, orgRole: 'org:member' },
    // An admin of a *different* workspace: their role would pass every check, so only workspace scoping stops them
    outsider: { userId: 'u_outsider', orgId: OTHER_WS, orgRole: 'org:admin' },
}

export const projects = [
    { id: 'p1', name: 'Website', team_lead: 'u_lead', workspaceId: WS },
    { id: 'p2', name: 'Mobile app', team_lead: 'u_admin', workspaceId: WS },
    { id: 'p_other', name: 'Other company project', team_lead: 'u_outsider', workspaceId: OTHER_WS },
]

const inProject = (id) => projects.find((p) => p.id === id)

export const tasks = [
    { id: 't1', title: 'Fix login', projectId: 'p1', assigneeId: 'u_assignee', project: inProject('p1') },
    { id: 't2', title: 'Write copy', projectId: 'p1', assigneeId: 'u_lead', project: inProject('p1') },
    { id: 't3', title: 'App icon', projectId: 'p2', assigneeId: 'u_assignee', project: inProject('p2') },
    { id: 't_other', title: 'Other company task', projectId: 'p_other', assigneeId: 'u_outsider', project: inProject('p_other') },
]

// Turns a service call into 'ok' or the HttpError status, so a whole role matrix fits in one it.each table.
// Anything that isn't an HttpError comes back as the error itself, so the test shows what really broke.
export const outcome = (promise) => promise.then(() => 'ok', (error) => error.status ?? error)
