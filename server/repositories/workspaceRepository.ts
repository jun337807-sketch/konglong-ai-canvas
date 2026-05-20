import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

export interface DbGroup {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkspaceProject {
  id: string;
  group_id: string;
  name: string;
  type: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function listGroups(): DbGroup[] {
  return getSqliteDb().prepare(`SELECT * FROM groups ORDER BY updated_at DESC`).all() as DbGroup[];
}

export function findGroupById(id: string): DbGroup | undefined {
  return getSqliteDb().prepare(`SELECT * FROM groups WHERE id = ?`).get(id) as DbGroup | undefined;
}

export function ensureGroup(input: {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
}): DbGroup {
  const existing = findGroupById(input.id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const group: DbGroup = {
    id: input.id,
    name: input.name,
    description: input.description || '',
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };

  getSqliteDb().prepare(`
    INSERT INTO groups (id, name, description, created_by, created_at, updated_at)
    VALUES (@id, @name, @description, @created_by, @created_at, @updated_at)
  `).run(group);

  return group;
}

export function createGroup(input: { name: string; description?: string; createdBy: string }): DbGroup {
  const now = new Date().toISOString();
  const group: DbGroup = {
    id: randomUUID(),
    name: input.name,
    description: input.description || '',
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };
  getSqliteDb().prepare(`
    INSERT INTO groups (id, name, description, created_by, created_at, updated_at)
    VALUES (@id, @name, @description, @created_by, @created_at, @updated_at)
  `).run(group);
  return group;
}

export function updateGroup(id: string, updates: Partial<Pick<DbGroup, 'name' | 'description'>>): DbGroup | undefined {
  const db = getSqliteDb();
  const existing = db.prepare(`SELECT * FROM groups WHERE id = ?`).get(id) as DbGroup | undefined;
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  db.prepare(`
    UPDATE groups
    SET name = @name,
        description = @description,
        updated_at = @updated_at
    WHERE id = @id
  `).run(updated);
  return updated;
}

export function deleteGroup(id: string) {
  return getSqliteDb().prepare(`DELETE FROM groups WHERE id = ?`).run(id).changes > 0;
}

export function listProjectsByGroup(groupId: string): DbWorkspaceProject[] {
  return getSqliteDb().prepare(`
    SELECT * FROM workspace_projects
    WHERE group_id = ?
    ORDER BY updated_at DESC
  `).all(groupId) as DbWorkspaceProject[];
}

export function createWorkspaceProject(input: {
  groupId: string;
  name: string;
  type?: string;
  description?: string;
  createdBy: string;
}): DbWorkspaceProject {
  const now = new Date().toISOString();
  const project: DbWorkspaceProject = {
    id: randomUUID(),
    group_id: input.groupId,
    name: input.name,
    type: input.type || 'canvas',
    description: input.description || '',
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };
  getSqliteDb().prepare(`
    INSERT INTO workspace_projects (id, group_id, name, type, description, created_by, created_at, updated_at)
    VALUES (@id, @group_id, @name, @type, @description, @created_by, @created_at, @updated_at)
  `).run(project);
  return project;
}

export function updateWorkspaceProject(
  id: string,
  updates: Partial<Pick<DbWorkspaceProject, 'name' | 'group_id' | 'type' | 'description'>>
): DbWorkspaceProject | undefined {
  const db = getSqliteDb();
  const existing = db.prepare(`SELECT * FROM workspace_projects WHERE id = ?`).get(id) as DbWorkspaceProject | undefined;
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  db.prepare(`
    UPDATE workspace_projects
    SET group_id = @group_id,
        name = @name,
        type = @type,
        description = @description,
        updated_at = @updated_at
    WHERE id = @id
  `).run(updated);
  return updated;
}

export function deleteWorkspaceProject(id: string) {
  return getSqliteDb().prepare(`DELETE FROM workspace_projects WHERE id = ?`).run(id).changes > 0;
}
