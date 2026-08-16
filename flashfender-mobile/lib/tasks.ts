import { apiFetch } from '@/lib/api';
import { asString, isRecord, listPayload, unwrapData } from '@/lib/parse';
import type { Task, TaskListResult } from '@/lib/types';

export function parseTask(value: unknown): Task | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  return {
    id: value.id,
    title: asString(value.title),
    status: asString(value.status),
    priority: asString(value.priority),
    due_date: asString(value.due_date),
    description: asString(value.description),
  };
}

export function parseTaskList(body: unknown): TaskListResult {
  const { raw, count } = listPayload(body);
  const tasks: Task[] = [];
  for (const item of raw) {
    const task = parseTask(item);
    if (task) tasks.push(task);
  }
  return { tasks, count };
}

export type ListTasksParams = {
  limit?: number;
  myTasks?: boolean;
};

export async function listTasks(params: ListTasksParams = {}): Promise<TaskListResult> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 50));
  if (params.myTasks) search.set('my_tasks', 'true');
  const body = await apiFetch(`/api/tasks?${search.toString()}`);
  return parseTaskList(body);
}

export function taskTitle(task: Task): string {
  return task.title ?? 'Task';
}

export async function patchTaskStatus(
  id: string,
  status: 'Completed' | 'Open' | 'In Progress',
): Promise<Task> {
  const body = await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
  });
  const task = parseTask(unwrapData(body));
  if (!task) throw new Error('Invalid task update response');
  return task;
}
