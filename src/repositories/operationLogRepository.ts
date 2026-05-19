export interface OperationLog {
  id: string;
  workspaceProjectId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function mapApiLog(log: any): OperationLog {
  return {
    id: log.id,
    workspaceProjectId: log.workspace_project_id,
    actorUserId: log.actor_user_id,
    action: log.action,
    targetType: log.target_type,
    targetId: log.target_id,
    metadata: log.metadata || {},
    createdAt: log.created_at
  };
}

export const operationLogRepository = {
  async listByProject(projectId: string): Promise<OperationLog[]> {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}/logs`).then(r => r.json());
      if (res.success) return (res.logs || []).map(mapApiLog);
    } catch (e) {
      console.warn('Failed to load operation logs from API', e);
    }
    return [];
  },

  async create(projectId: string, input: {
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<OperationLog | null> {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }).then(r => r.json());
      if (res.success && res.log) return mapApiLog(res.log);
    } catch (e) {
      console.warn('Failed to create operation log via API', e);
    }
    return null;
  }
};
