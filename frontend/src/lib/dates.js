// One overdue rule for every view (dashboard, summary, analytics, calendar), so they can't disagree
export const isOverdue = (task, now = new Date()) =>
    Boolean(task.due_date) && task.status !== "DONE" && new Date(task.due_date) < now;
