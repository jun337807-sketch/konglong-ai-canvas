import { Episode } from '../types/workspace';

const EPISODES_KEY = 'workspace_episodes';

const db = {
  getEpisodes: (): Episode[] => JSON.parse(localStorage.getItem(EPISODES_KEY) || '[]'),
  saveEpisodes: (eps: Episode[]) => localStorage.setItem(EPISODES_KEY, JSON.stringify(eps)),
};

class ScriptStoryboardService {
  async getEpisodesByProject(projectId: string): Promise<Episode[]> {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/episodes`);
      if (!res.ok) throw new Error(`episodes request failed: ${res.status}`);
      const data = await res.json();
      return data.episodes || [];
    } catch (err) {
      console.warn('Use local episodes fallback:', err);
      return Promise.resolve(db.getEpisodes().filter(e => e.project_id === projectId));
    }
  }

  async createEpisode(epData: Partial<Episode> & { project_id: string }): Promise<Episode> {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(epData.project_id)}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(epData)
      });
      if (!res.ok) throw new Error(`create episode failed: ${res.status}`);
      const data = await res.json();
      return data.episode;
    } catch (err) {
      console.warn('Create local episode fallback:', err);
    }
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
    try {
      const res = await fetch(`/api/episodes/${encodeURIComponent(episodeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`update episode failed: ${res.status}`);
      const data = await res.json();
      return data.episode;
    } catch (err) {
      console.warn('Update local episode fallback:', err);
    }
    const eps = db.getEpisodes();
    const idx = eps.findIndex(e => e.episode_id === episodeId);
    if (idx === -1) return Promise.resolve(null);
    eps[idx] = { ...eps[idx], ...updates, updated_at: new Date().toISOString() };
    db.saveEpisodes(eps);
    return Promise.resolve(eps[idx]);
  }

  async deleteEpisode(episodeId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/episodes/${encodeURIComponent(episodeId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`delete episode failed: ${res.status}`);
      const data = await res.json();
      return Boolean(data.deleted);
    } catch (err) {
      console.warn('Delete local episode fallback:', err);
    }
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
