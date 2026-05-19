import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

export interface DbTask {
  id: string;
  workspace_project_id: string;
  created_by: string;
  capability: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  input_json: string;
  output_json: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function listTasksByProject(projectId: string): DbTask[] {
  return getSqliteDb().prepare(`
    SELECT * FROM tasks
    WHERE workspace_project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as DbTask[];
}

export function findTaskById(id: string): DbTask | undefined {
  return getSqliteDb().prepare(`
    SELECT * FROM tasks
    WHERE id = ?
  `).get(id) as DbTask | undefined;
}

export function createTask(input: {
  workspaceProjectId: string;
  createdBy: string;
  capability: string;
  provider: string;
  payload?: Record<string, unknown>;
}): DbTask {
  const now = new Date().toISOString();
  const task: DbTask = {
    id: randomUUID(),
    workspace_project_id: input.workspaceProjectId,
    created_by: input.createdBy,
    capability: input.capability,
    provider: input.provider,
    status: 'pending',
    input_json: JSON.stringify(input.payload || {}),
    output_json: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now
  };
  getSqliteDb().prepare(`
    INSERT INTO tasks (
      id, workspace_project_id, created_by, capability, provider, status,
      input_json, output_json, error_message, started_at, completed_at, created_at, updated_at
    ) VALUES (
      @id, @workspace_project_id, @created_by, @capability, @provider, @status,
      @input_json, @output_json, @error_message, @started_at, @completed_at, @created_at, @updated_at
    )
  `).run(task);
  return task;
}

export function updateTask(
  id: string,
  updates: Partial<Pick<DbTask, 'status' | 'output_json' | 'error_message' | 'started_at' | 'completed_at'>>
): DbTask | undefined {
  const db = getSqliteDb();
  const existing = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as DbTask | undefined;
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  db.prepare(`
    UPDATE tasks
    SET status = @status,
        output_json = @output_json,
        error_message = @error_message,
        started_at = @started_at,
        completed_at = @completed_at,
        updated_at = @updated_at
    WHERE id = @id
  `).run(updated);
  return updated;
}
