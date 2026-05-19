export interface Asset {
  id: string;
  projectId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  name: string;
  size?: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY_PREFIX = 'canvas_assets_';

class AssetManager {
  async getAssets(projectId: string): Promise<Asset[]> {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load assets:', e);
    }
    return [];
  }

  async saveAssets(projectId: string, assets: Asset[]): Promise<boolean> {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify(assets));
      return true;
    } catch (e) {
      console.warn('Failed to save assets:', e);
      return false;
    }
  }

  async registerAsset(projectId: string, asset: Omit<Asset, 'id' | 'createdAt' | 'projectId'>): Promise<Asset> {
    const assets = await this.getAssets(projectId);
    const newAsset: Asset = {
      ...asset,
      projectId,
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    await this.saveAssets(projectId, [newAsset, ...assets]);
    return newAsset;
  }
}

export const assetManager = new AssetManager();
