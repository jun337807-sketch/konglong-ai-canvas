export interface MediaHistoryItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  createdAt: string; // ISO string
}

const STORAGE_KEY = 'dino_media_history';
const MAX_HISTORY_ITEMS = 80;
const MAX_DATA_URL_LENGTH = 750_000;

export class MediaHistoryService {
  static getHistory(): MediaHistoryItem[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Return some mock data to populate the UI initially if empty
      const mockData: MediaHistoryItem[] = [
        { id: crypto.randomUUID(), type: 'image', url: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80&w=600', createdAt: new Date().toISOString() },
        { id: crypto.randomUUID(), type: 'image', url: 'https://images.unsplash.com/photo-1506744626753-eda81829ad30?auto=format&fit=crop&q=80&w=600', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: crypto.randomUUID(), type: 'image', url: 'https://images.unsplash.com/photo-1532453288672-3a27e9be2efd?auto=format&fit=crop&q=80&w=600', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: crypto.randomUUID(), type: 'image', url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&q=80&w=600', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: crypto.randomUUID(), type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', createdAt: new Date().toISOString() }
      ];
      this.saveHistory(mockData);
      return mockData;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  static addHistory(item: Omit<MediaHistoryItem, 'id' | 'createdAt'>) {
    if (item.url.startsWith('data:') && item.url.length > MAX_DATA_URL_LENGTH) {
      console.warn('Skip oversized media history item to keep canvas responsive.');
      return;
    }
    const history = this.getHistory();
    const nextItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const deduped = history.filter(h => h.url !== item.url);
    this.saveHistory([nextItem, ...deduped].slice(0, MAX_HISTORY_ITEMS));
  }

  static removeHistory(id: string) {
    const history = this.getHistory();
    const updated = history.filter(h => h.id !== id);
    this.saveHistory(updated);
  }

  private static saveHistory(history: MediaHistoryItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  static async getProjectHistory(projectId?: string): Promise<MediaHistoryItem[]> {
    const local = this.getHistory();
    if (!projectId) return local;

    try {
      const res = await fetch(`/api/workspace-projects/${encodeURIComponent(projectId)}/assets`);
      if (!res.ok) throw new Error(`assets request failed: ${res.status}`);
      const data = await res.json();
      const serverItems: MediaHistoryItem[] = (data.assets || [])
        .filter((asset: any) => ['image', 'video', 'audio'].includes(asset.type) && asset.url)
        .map((asset: any) => ({
          id: asset.id || asset.asset_id || asset.url,
          type: asset.type,
          url: asset.url,
          createdAt: asset.created_at || new Date().toISOString()
        }));

      const seen = new Set<string>();
      return [...serverItems, ...local]
        .filter(item => {
          const key = `${item.type}:${item.url}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_HISTORY_ITEMS);
    } catch (err) {
      console.warn('Use local media history fallback:', err);
      return local;
    }
  }
}
