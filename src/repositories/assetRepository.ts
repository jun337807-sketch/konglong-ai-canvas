import { Asset, assetManager } from '../services/assetManager';

function mapApiAsset(asset: any): Asset {
  return {
    id: asset.id,
    projectId: asset.workspace_project_id,
    type: asset.type,
    url: asset.url,
    name: asset.name,
    createdAt: asset.created_at,
    metadata: asset.metadata || {}
  };
}

export const assetRepository = {
  async listByProject(projectId: string) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}/assets`).then(r => r.json());
      if (res.success) return (res.assets || []).map(mapApiAsset);
    } catch (e) {
      console.warn('Failed to load assets from API, falling back to local storage', e);
    }
    return assetManager.getAssets(projectId);
  },

  async create(projectId: string, asset: Omit<Asset, 'id' | 'createdAt' | 'projectId'> & { tosKey?: string; createdBy?: string }) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: asset.type,
          name: asset.name,
          tosKey: asset.tosKey || asset.url,
          url: asset.url,
          metadata: asset.metadata || {},
          createdBy: asset.createdBy || 'system'
        })
      }).then(r => r.json());
      if (res.success && res.asset) return mapApiAsset(res.asset);
      throw new Error(res.error || 'Failed to create asset');
    } catch (e) {
      console.warn('Failed to create asset via API, falling back to local storage', e);
      return assetManager.registerAsset(projectId, asset);
    }
  }
};
