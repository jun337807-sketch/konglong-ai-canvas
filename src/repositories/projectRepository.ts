import { WorkspaceProject } from '../types/workspace';
import { projectService } from '../services/projectService';

export interface ProjectRepository {
  listByGroup(groupId: string): Promise<WorkspaceProject[]>;
  create(input: Partial<WorkspaceProject> & { group_id: string }): Promise<WorkspaceProject>;
  update(projectId: string, updates: Partial<WorkspaceProject>): Promise<WorkspaceProject | null>;
}

class LocalProjectRepository implements ProjectRepository {
  listByGroup(groupId: string) {
    return projectService.getProjectsByGroup(groupId);
  }

  create(input: Partial<WorkspaceProject> & { group_id: string }) {
    return projectService.createProject(input);
  }

  update(projectId: string, updates: Partial<WorkspaceProject>) {
    return projectService.updateProject(projectId, updates);
  }
}

export const projectRepository: ProjectRepository = new LocalProjectRepository();
