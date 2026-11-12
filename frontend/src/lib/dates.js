import { format } from "date-fns";

// A due date is a calendar day the backend stores as UTC midnight, so its UTC date is the day that was picked
const dueDay = (dueDate) => new Date(dueDate).toISOString().slice(0, 10);

// The day on the user's own calendar, in the same YYYY-MM-DD shape; strings in this shape sort like dates
const localDay = (date) => format(date, "yyyy-MM-dd");

// One overdue rule for every view (dashboard, summary, analytics, calendar), so they can't disagree.
// Compares days, not instants: a task due today stays on time until the user's midnight.
export const isOverdue = (task, now = new Date()) =>
    Boolean(task.due_date) && task.status !== "DONE" && dueDay(task.due_date) < localDay(now);
