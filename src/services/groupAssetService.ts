import { SharedAsset } from '../types/workspace';

const ASSETS_KEY = 'workspace_shared_assets';

const db = {
  getAssets: (): SharedAsset[] => JSON.parse(localStorage.getItem(ASSETS_KEY) || '[]'),
  saveAssets: (assets: SharedAsset[]) => localStorage.setItem(ASSETS_KEY, JSON.stringify(assets)),
};

class GroupAssetService {
  async getAssetsByGroup(groupId: string): Promise<SharedAsset[]> {
    return Promise.resolve(db.getAssets().filter(a => a.group_id === groupId));
  }

  async createAsset(assetData: Partial<SharedAsset> & { group_id: string, url: string, name: string }): Promise<SharedAsset> {
    const assets = db.getAssets();
    const newAsset: SharedAsset = {
      asset_id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      group_id: assetData.group_id,
      project_id: assetData.project_id,
      type: assetData.type || 'reference',
      name: assetData.name,
      url: assetData.url,
      thumbnail_url: assetData.thumbnail_url,
      tags: assetData.tags || [],
      linked_episode_ids: assetData.linked_episode_ids || [],
      linked_beat_ids: assetData.linked_beat_ids || [],
      created_by: assetData.created_by || 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    assets.push(newAsset);
    db.saveAssets(assets);
    return Promise.resolve(newAsset);
  }

  async updateAsset(assetId: string, updates: Partial<SharedAsset>): Promise<SharedAsset | null> {
    const assets = db.getAssets();
    const index = assets.findIndex(a => a.asset_id === assetId);
    if (index === -1) return Promise.resolve(null);
    assets[index] = { ...assets[index], ...updates, updated_at: new Date().toISOString() };
    db.saveAssets(assets);
    return Promise.resolve(assets[index]);
  }
}

export const groupAssetService = new GroupAssetService();
