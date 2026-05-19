import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

export interface DbCanvasDocument {
  id: string;
  workspace_project_id: string;
  nodes_json: string;
  edges_json: string;
  viewport_json: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export function getCanvasDocumentByProjectId(workspaceProjectId: string): DbCanvasDocument | undefined {
  return getSqliteDb().prepare(`
    SELECT * FROM canvas_documents
    WHERE workspace_project_id = ?
  `).get(workspaceProjectId) as DbCanvasDocument | undefined;
}

export function upsertCanvasDocument(input: {
  workspaceProjectId: string;
  nodes: unknown[];
  edges: unknown[];
  viewport?: unknown;
}): DbCanvasDocument {
  const db = getSqliteDb();
  const existing = getCanvasDocumentByProjectId(input.workspaceProjectId);
  const now = new Date().toISOString();

  if (existing) {
    const updated: DbCanvasDocument = {
      ...existing,
      nodes_json: JSON.stringify(input.nodes || []),
      edges_json: JSON.stringify(input.edges || []),
      viewport_json: input.viewport ? JSON.stringify(input.viewport) : null,
      version: existing.version + 1,
      updated_at: now
    };
    db.prepare(`
      UPDATE canvas_documents
      SET nodes_json = @nodes_json,
          edges_json = @edges_json,
          viewport_json = @viewport_json,
          version = @version,
          updated_at = @updated_at
      WHERE id = @id
    `).run(updated);
    return updated;
  }

  const created: DbCanvasDocument = {
    id: randomUUID(),
    workspace_project_id: input.workspaceProjectId,
    nodes_json: JSON.stringify(input.nodes || []),
    edges_json: JSON.stringify(input.edges || []),
    viewport_json: input.viewport ? JSON.stringify(input.viewport) : null,
    version: 1,
    created_at: now,
    updated_at: now
  };
  db.prepare(`
    INSERT INTO canvas_documents (
      id, workspace_project_id, nodes_json, edges_json, viewport_json, version, created_at, updated_at
    ) VALUES (
      @id, @workspace_project_id, @nodes_json, @edges_json, @viewport_json, @version, @created_at, @updated_at
    )
  `).run(created);
  return created;
}
