import { WorkspaceProject } from '../types/workspace';

const PROJECTS_KEY = 'workspace_projects';

const db = {
  getProjects: (): WorkspaceProject[] => JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'),
  saveProjects: (projects: WorkspaceProject[]) => localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)),
};

class ProjectService {
  async getProjectsByGroup(groupId: string): Promise<WorkspaceProject[]> {
    return Promise.resolve(db.getProjects().filter(p => p.group_id === groupId));
  }

  async getProjectById(projectId: string): Promise<WorkspaceProject | undefined> {
    return Promise.resolve(db.getProjects().find(p => p.project_id === projectId));
  }

  async createProject(projectData: Partial<WorkspaceProject> & { group_id: string }): Promise<WorkspaceProject> {
    const projects = db.getProjects();
    const existingIndex = projectData.project_id
      ? projects.findIndex(project => project.project_id === projectData.project_id)
      : -1;
    if (existingIndex !== -1) {
      projects[existingIndex] = {
        ...projects[existingIndex],
        ...projectData,
        updated_at: projectData.updated_at || projects[existingIndex].updated_at || new Date().toISOString()
      } as WorkspaceProject;
      db.saveProjects(projects);
      return Promise.resolve(projects[existingIndex]);
    }

    const newProject: WorkspaceProject = {
      project_id: projectData.project_id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      group_id: projectData.group_id,
      project_name: projectData.project_name || 'New Project',
      project_type: projectData.project_type || 'canvas',
      description: projectData.description || '',
      canvas_ids: projectData.canvas_ids || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.push(newProject);
    db.saveProjects(projects);
    return Promise.resolve(newProject);
  }

  async updateProject(projectId: string, updates: Partial<WorkspaceProject>): Promise<WorkspaceProject | null> {
    const projects = db.getProjects();
    const index = projects.findIndex(p => p.project_id === projectId);
    if (index === -1) return Promise.resolve(null);
    projects[index] = { ...projects[index], ...updates, updated_at: new Date().toISOString() };
    db.saveProjects(projects);
    return Promise.resolve(projects[index]);
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const projects = db.getProjects();
    const nextProjects = projects.filter(p => p.project_id !== projectId);
    db.saveProjects(nextProjects);
    localStorage.removeItem(`infinite-canvas-project-${projectId}`);
    return Promise.resolve(nextProjects.length !== projects.length);
  }
}

export const projectService = new ProjectService();
