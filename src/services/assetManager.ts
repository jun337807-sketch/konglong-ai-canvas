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
      const res = await fetch(`/api/workspace-projects/${encodeURIComponent(projectId)}/assets`);
      if (!res.ok) throw new Error(`assets request failed: ${res.status}`);
      const data = await res.json();
      return (data.assets || []).map((asset: any) => ({
        id: asset.id,
        projectId: asset.workspace_project_id || projectId,
        type: asset.type,
        url: asset.url,
        name: asset.name,
        createdAt: asset.created_at,
        metadata: asset.metadata || {}
      }));
    } catch (e) {
      console.warn('Use local assets fallback:', e);
    }
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
    try {
      const res = await fetch(`/api/workspace-projects/${encodeURIComponent(projectId)}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: asset.type,
          name: asset.name,
          tosKey: asset.metadata?.tosKey || asset.url,
          url: asset.url,
          thumbnailUrl: asset.metadata?.thumbnailUrl,
          metadata: asset.metadata || {},
          createdBy: asset.metadata?.createdBy || localStorage.getItem('dino_currentUser') || 'system'
        })
      });
      if (!res.ok) throw new Error(`register asset failed: ${res.status}`);
      const data = await res.json();
      const saved = data.asset;
      return {
        id: saved.id,
        projectId: saved.workspace_project_id || projectId,
        type: saved.type,
        url: saved.url,
        name: saved.name,
        createdAt: saved.created_at,
        metadata: saved.metadata || {}
      };
    } catch (e) {
      console.warn('Register local asset fallback:', e);
    }
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
