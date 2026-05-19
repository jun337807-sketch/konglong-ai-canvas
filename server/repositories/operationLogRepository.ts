import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

export interface DbOperationLog {
  id: string;
  workspace_project_id: string | null;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: string;
  created_at: string;
}

export function listOperationLogsByProject(projectId: string): DbOperationLog[] {
  return getSqliteDb().prepare(`
    SELECT * FROM operation_logs
    WHERE workspace_project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as DbOperationLog[];
}

export function createOperationLog(input: {
  workspaceProjectId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): DbOperationLog {
  const log: DbOperationLog = {
    id: randomUUID(),
    workspace_project_id: input.workspaceProjectId || null,
    actor_user_id: input.actorUserId || null,
    action: input.action,
    target_type: input.targetType || null,
    target_id: input.targetId || null,
    metadata_json: JSON.stringify(input.metadata || {}),
    created_at: new Date().toISOString()
  };

  getSqliteDb().prepare(`
    INSERT INTO operation_logs (
      id, workspace_project_id, actor_user_id, action, target_type, target_id, metadata_json, created_at
    ) VALUES (
      @id, @workspace_project_id, @actor_user_id, @action, @target_type, @target_id, @metadata_json, @created_at
    )
  `).run(log);

  return log;
}
