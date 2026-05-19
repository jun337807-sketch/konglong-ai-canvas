export interface MediaHistoryItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  createdAt: string; // ISO string
}

const STORAGE_KEY = 'dino_media_history';

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
    const history = this.getHistory();
    history.unshift({
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    });
    this.saveHistory(history);
  }

  static removeHistory(id: string) {
    const history = this.getHistory();
    const updated = history.filter(h => h.id !== id);
    this.saveHistory(updated);
  }

  private static saveHistory(history: MediaHistoryItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
}
