import { ProjectSettings, projectSettingsSchema } from '../config/projectSettingsSchema';

const STORAGE_KEY_PREFIX = 'canvas_project_settings_';

class ProjectSettingsService {
  async getSettings(projectId: string): Promise<ProjectSettings> {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      if (stored) {
        return { ...projectSettingsSchema.defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load project settings:', e);
    }
    return { ...projectSettingsSchema.defaultSettings };
  }

  async saveSettings(projectId: string, settings: Partial<ProjectSettings>): Promise<boolean> {
    try {
      const current = await this.getSettings(projectId);
      const updated = { ...current, ...settings };
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.warn('Failed to save project settings:', e);
      return false;
    }
  }

  // To be implemented: backend sync
  async syncSettings(projectId: string) {
    // 预留接口，未来集成 Express 后进行后台同步
    console.log(`Syncing settings to backend for project: ${projectId}`);
  }
}

export const projectSettingsService = new ProjectSettingsService();
