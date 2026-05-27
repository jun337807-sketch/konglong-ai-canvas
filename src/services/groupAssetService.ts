import { SharedAsset } from '../types/workspace';

const ASSETS_KEY = 'workspace_shared_assets';

const db = {
  getAssets: (): SharedAsset[] => JSON.parse(localStorage.getItem(ASSETS_KEY) || '[]'),
  saveAssets: (assets: SharedAsset[]) => localStorage.setItem(ASSETS_KEY, JSON.stringify(assets)),
};

class GroupAssetService {
  async getAssetsByGroup(groupId: string): Promise<SharedAsset[]> {
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/shared-assets`);
      if (!res.ok) throw new Error(`shared assets request failed: ${res.status}`);
      const data = await res.json();
      return data.assets || [];
    } catch (err) {
      console.warn('Use local shared assets fallback:', err);
      return Promise.resolve(db.getAssets().filter(a => a.group_id === groupId));
    }
  }

  async createAsset(assetData: Partial<SharedAsset> & { group_id: string, url: string, name: string }): Promise<SharedAsset> {
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(assetData.group_id)}/shared-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetData)
      });
      if (!res.ok) throw new Error(`create shared asset failed: ${res.status}`);
      const data = await res.json();
      return data.asset;
    } catch (err) {
      console.warn('Create local shared asset fallback:', err);
    }
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
    try {
      const res = await fetch(`/api/shared-assets/${encodeURIComponent(assetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`update shared asset failed: ${res.status}`);
      const data = await res.json();
      return data.asset;
    } catch (err) {
      console.warn('Update local shared asset fallback:', err);
    }
    const assets = db.getAssets();
    const index = assets.findIndex(a => a.asset_id === assetId);
    if (index === -1) return Promise.resolve(null);
    assets[index] = { ...assets[index], ...updates, updated_at: new Date().toISOString() };
    db.saveAssets(assets);
    return Promise.resolve(assets[index]);
  }

  async deleteAsset(assetId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/shared-assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`delete shared asset failed: ${res.status}`);
      const data = await res.json();
      return Boolean(data.deleted);
    } catch (err) {
      console.warn('Delete local shared asset fallback:', err);
    }
    const assets = db.getAssets();
    const nextAssets = assets.filter(a => a.asset_id !== assetId);
    db.saveAssets(nextAssets);
    return Promise.resolve(nextAssets.length !== assets.length);
  }}

export const groupAssetService = new GroupAssetService();

