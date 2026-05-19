import { Router } from 'express';
import {
  createOperationLog,
  listOperationLogsByProject
} from '../repositories/operationLogRepository.js';

const router = Router();

router.get('/workspace-projects/:projectId/logs', (req, res) => {
  const logs = listOperationLogsByProject(req.params.projectId).map(log => ({
    ...log,
    metadata: JSON.parse(log.metadata_json || '{}')
  }));
  res.json({ success: true, logs });
});

router.post('/workspace-projects/:projectId/logs', (req, res) => {
  const { actorUserId, action, targetType, targetId, metadata } = req.body || {};
  if (!action) {
    return res.status(400).json({ success: false, error: 'action is required' });
  }

  const log = createOperationLog({
    workspaceProjectId: req.params.projectId,
    actorUserId,
    action,
    targetType,
    targetId,
    metadata
  });

  res.status(201).json({
    success: true,
    log: {
      ...log,
      metadata: JSON.parse(log.metadata_json || '{}')
    }
  });
});

export default router;
