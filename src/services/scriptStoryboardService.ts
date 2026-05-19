import { Episode } from '../types/workspace';

const EPISODES_KEY = 'workspace_episodes';

const db = {
  getEpisodes: (): Episode[] => JSON.parse(localStorage.getItem(EPISODES_KEY) || '[]'),
  saveEpisodes: (eps: Episode[]) => localStorage.setItem(EPISODES_KEY, JSON.stringify(eps)),
};

class ScriptStoryboardService {
  async getEpisodesByProject(projectId: string): Promise<Episode[]> {
    return Promise.resolve(db.getEpisodes().filter(e => e.project_id === projectId));
  }

  async createEpisode(epData: Partial<Episode> & { project_id: string }): Promise<Episode> {
    const eps = db.getEpisodes();
    const newEp: Episode = {
      episode_id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      project_id: epData.project_id,
      episode_number: epData.episode_number || (eps.filter(e => e.project_id === epData.project_id).length + 1),
      title: epData.title || `Episode ${eps.length + 1}`,
      summary: epData.summary || '',
      script_text: epData.script_text || '',
      storyboard_text: epData.storyboard_text || '',
      required_asset_ids: epData.required_asset_ids || [],
      annotations: epData.annotations || [],
      status: epData.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    eps.push(newEp);
    db.saveEpisodes(eps);
    return Promise.resolve(newEp);
  }

  async updateEpisode(episodeId: string, updates: Partial<Episode>): Promise<Episode | null> {
    const eps = db.getEpisodes();
    const idx = eps.findIndex(e => e.episode_id === episodeId);
    if (idx === -1) return Promise.resolve(null);
    eps[idx] = { ...eps[idx], ...updates, updated_at: new Date().toISOString() };
    db.saveEpisodes(eps);
    return Promise.resolve(eps[idx]);
  }

  async deleteEpisode(episodeId: string): Promise<boolean> {
    const eps = db.getEpisodes();
    const len = eps.length;
    const filtered = eps.filter(e => e.episode_id !== episodeId);
    if (filtered.length !== len) {
      db.saveEpisodes(filtered);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}

export const scriptStoryboardService = new ScriptStoryboardService();
