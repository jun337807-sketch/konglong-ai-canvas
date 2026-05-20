import { Group, WorkspaceProject } from '../types/workspace';
import { groupRepository } from './groupRepository';
import { projectRepository } from './projectRepository';

function mapApiGroup(group: any): Group {
  return {
    group_id: group.id,
    group_name: group.name,
    description: group.description,
    created_by: group.created_by,
    created_at: group.created_at,
    updated_at: group.updated_at
  };
}

function mapApiProject(project: any): WorkspaceProject {
  return {
    project_id: project.id,
    group_id: project.group_id,
    project_name: project.name,
    project_type: project.type,
    description: project.description,
    canvas_ids: [],
    created_at: project.created_at,
    updated_at: project.updated_at
  };
}

export const workspaceRepository = {
  async listGroups() {
    try {
      const res = await fetch('/api/groups').then(r => r.json());
      if (res.success) return (res.groups || []).map(mapApiGroup);
    } catch (e) {
      console.warn('Failed to load groups from API, falling back to local storage', e);
    }
    return groupRepository.list();
  },

  async createGroup(input: Partial<Group>) {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.group_name,
          description: input.description,
          createdBy: input.created_by || 'system'
        })
      }).then(r => r.json());
      if (res.success && res.group) return mapApiGroup(res.group);
      throw new Error(res.error || 'Failed to create group');
    } catch (e) {
      console.warn('Failed to create group via API, falling back to local storage', e);
      return groupRepository.create(input);
    }
  },

  async updateGroup(groupId: string, updates: Partial<Group>) {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updates.group_name,
          description: updates.description
        })
      }).then(r => r.json());
      if (res.success && res.group) return mapApiGroup(res.group);
      throw new Error(res.error || 'Failed to update group');
    } catch (e) {
      console.warn('Failed to update group via API, falling back to local storage', e);
      return groupRepository.update(groupId, updates);
    }
  },

  async removeGroup(groupId: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) return true;
      throw new Error(res.error || 'Failed to delete group');
    } catch (e) {
      console.warn('Failed to delete group via API, falling back to local storage', e);
      return groupRepository.remove(groupId);
    }
  },

  async listProjectsByGroup(groupId: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}/projects`).then(r => r.json());
      if (res.success) {
        const apiProjects = (res.projects || []).map(mapApiProject);
        await Promise.all(apiProjects.map((project: WorkspaceProject) => projectRepository.create({
          project_id: project.project_id,
          group_id: project.group_id || groupId,
          project_name: project.project_name,
          project_type: project.project_type,
          description: project.description,
          canvas_ids: project.canvas_ids
        }).catch(() => null)));
        return apiProjects.sort((a: WorkspaceProject, b: WorkspaceProject) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      }
    } catch (e) {
      console.warn('Failed to load projects from API, falling back to local storage', e);
    }
    const localProjects = await projectRepository.listByGroup(groupId);
    return localProjects;
  },

  async createProject(groupId: string, projectName: string, createdBy?: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          createdBy: createdBy || 'system'
        })
      }).then(r => r.json());
      if (res.success && res.project) {
        const project = mapApiProject(res.project);
        await projectRepository.create({
          project_id: project.project_id,
          group_id: project.group_id || groupId,
          project_name: project.project_name,
          project_type: project.project_type,
          description: project.description,
          canvas_ids: project.canvas_ids
        });
        return project;
      }
      throw new Error(res.error || 'Failed to create project');
    } catch (e) {
      console.warn('Failed to create project via API, falling back to local storage', e);
      return projectRepository.create({ group_id: groupId, project_name: projectName });
    }
  },

  async renameProject(projectId: string, projectName: string) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName })
      }).then(r => r.json());
      if (res.success && res.project) return mapApiProject(res.project);
      throw new Error(res.error || 'Failed to rename project');
    } catch (e) {
      console.warn('Failed to rename project via API, falling back to local storage', e);
      return projectRepository.update(projectId, { project_name: projectName });
    }
  },

  async moveProject(projectId: string, groupId: string) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId })
      }).then(r => r.json());
      if (res.success && res.project) return mapApiProject(res.project);
      throw new Error(res.error || 'Failed to move project');
    } catch (e) {
      console.warn('Failed to move project via API, falling back to local storage', e);
      return projectRepository.update(projectId, { group_id: groupId });
    }
  },

  async removeProject(projectId: string) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) {
        await projectRepository.remove(projectId);
        return true;
      }
      throw new Error(res.error || 'Failed to remove project');
    } catch (e) {
      console.warn('Failed to remove project via API, falling back to local storage', e);
      return projectRepository.remove(projectId);
    }
  }
};
