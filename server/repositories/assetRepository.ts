import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

export interface DbAsset {
  id: string;
  workspace_project_id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
  tos_key: string;
  url: string;
  thumbnail_url: string | null;
  metadata_json: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function listAssetsByProject(projectId: string): DbAsset[] {
  return getSqliteDb().prepare(`
    SELECT * FROM assets
    WHERE workspace_project_id = ?
    ORDER BY created_at DESC
  `).all(projectId) as DbAsset[];
}

export function createAsset(input: {
  workspaceProjectId: string;
  type: DbAsset['type'];
  name: string;
  tosKey: string;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}): DbAsset {
  const now = new Date().toISOString();
  const asset: DbAsset = {
    id: randomUUID(),
    workspace_project_id: input.workspaceProjectId,
    type: input.type,
    name: input.name,
    tos_key: input.tosKey,
    url: input.url,
    thumbnail_url: input.thumbnailUrl || null,
    metadata_json: JSON.stringify(input.metadata || {}),
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };
  getSqliteDb().prepare(`
    INSERT INTO assets (
      id, workspace_project_id, type, name, tos_key, url, thumbnail_url,
      metadata_json, created_by, created_at, updated_at
    ) VALUES (
      @id, @workspace_project_id, @type, @name, @tos_key, @url, @thumbnail_url,
      @metadata_json, @created_by, @created_at, @updated_at
    )
  `).run(asset);
  return asset;
}
