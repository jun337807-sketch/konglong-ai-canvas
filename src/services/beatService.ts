import { Beat } from '../types/workspace';

const BEATS_KEY = 'workspace_beats';

const db = {
  getBeats: (): Beat[] => JSON.parse(localStorage.getItem(BEATS_KEY) || '[]'),
  saveBeats: (beats: Beat[]) => localStorage.setItem(BEATS_KEY, JSON.stringify(beats)),
};

class BeatService {
  async getBeatsByEpisode(episodeId: string): Promise<Beat[]> {
    return Promise.resolve(db.getBeats().filter(b => b.episode_id === episodeId));
  }

  async createBeat(beatData: Partial<Beat> & { episode_id: string }): Promise<Beat> {
    const beats = db.getBeats();
    const newBeat: Beat = {
      beat_id: `beat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      episode_id: beatData.episode_id,
      beat_number: beatData.beat_number || (beats.filter(b => b.episode_id === beatData.episode_id).length + 1),
      title: beatData.title || `Beat`,
      script_text: beatData.script_text || '',
      storyboard_text: beatData.storyboard_text || '',
      required_asset_ids: beatData.required_asset_ids || [],
      linked_canvas_node_ids: beatData.linked_canvas_node_ids || [],
      annotations: beatData.annotations || [],
      status: beatData.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    beats.push(newBeat);
    db.saveBeats(beats);
    return Promise.resolve(newBeat);
  }

  async updateBeat(beatId: string, updates: Partial<Beat>): Promise<Beat | null> {
    const beats = db.getBeats();
    const idx = beats.findIndex(b => b.beat_id === beatId);
    if (idx === -1) return Promise.resolve(null);
    beats[idx] = { ...beats[idx], ...updates, updated_at: new Date().toISOString() };
    db.saveBeats(beats);
    return Promise.resolve(beats[idx]);
  }

  async deleteBeat(beatId: string): Promise<boolean> {
    const beats = db.getBeats();
    const len = beats.length;
    const filtered = beats.filter(b => b.beat_id !== beatId);
    if (filtered.length !== len) {
      db.saveBeats(filtered);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}

export const beatService = new BeatService();
