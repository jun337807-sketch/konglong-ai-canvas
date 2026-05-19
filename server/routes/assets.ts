import { Router } from 'express';
import { createAsset, listAssetsByProject } from '../repositories/assetRepository.js';
import { resolveActorUserId } from '../repositories/userRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = Router();

router.get('/workspace-projects/:projectId/assets', (req, res) => {
  const assets = listAssetsByProject(req.params.projectId).map(asset => ({
    ...asset,
    metadata: JSON.parse(asset.metadata_json || '{}')
  }));
  res.json({ success: true, assets });
});

router.post('/workspace-projects/:projectId/assets', (req, res) => {
  const { type, name, tosKey, url, thumbnailUrl, metadata, createdBy } = req.body || {};
  if (!type || !name || !tosKey || !url || !createdBy) {
    return res.status(400).json({ success: false, error: 'missing required asset fields' });
  }
  const actorUserId = resolveActorUserId(createdBy);
  const asset = createAsset({
    workspaceProjectId: req.params.projectId,
    type,
    name,
    tosKey,
    url,
    thumbnailUrl,
    metadata,
    createdBy: actorUserId
  });
  writeAuditLog({
    workspaceProjectId: req.params.projectId,
    actorUserId,
    action: 'asset.created',
    targetType: 'asset',
    targetId: asset.id,
    metadata: { type, name, tosKey }
  });
  res.status(201).json({
    success: true,
    asset: {
      ...asset,
      metadata: JSON.parse(asset.metadata_json || '{}')
    }
  });
});

export default router;
