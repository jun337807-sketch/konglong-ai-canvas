import { Router } from 'express';
import {
  createGroup,
  createWorkspaceProject,
  deleteGroup,
  listGroups,
  listProjectsByGroup,
  updateGroup,
  updateWorkspaceProject
} from '../repositories/workspaceRepository.js';
import { resolveActorUserId } from '../repositories/userRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = Router();

router.get('/groups', (_req, res) => {
  res.json({ success: true, groups: listGroups() });
});

router.post('/groups', (req, res) => {
  const { name, description, createdBy } = req.body || {};
  if (!name || !createdBy) {
    return res.status(400).json({ success: false, error: 'name and createdBy are required' });
  }
  const actorUserId = resolveActorUserId(createdBy);
  const group = createGroup({ name, description, createdBy: actorUserId });
  writeAuditLog({
    actorUserId,
    action: 'group.created',
    targetType: 'group',
    targetId: group.id,
    metadata: { name }
  });
  res.status(201).json({ success: true, group });
});

router.patch('/groups/:id', (req, res) => {
  const updated = updateGroup(req.params.id, {
    name: req.body?.name,
    description: req.body?.description
  });
  if (!updated) return res.status(404).json({ success: false, error: 'group not found' });
  res.json({ success: true, group: updated });
});

router.delete('/groups/:id', (req, res) => {
  const deleted = deleteGroup(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'group not found' });
  res.json({ success: true });
});

router.get('/groups/:groupId/projects', (req, res) => {
  res.json({ success: true, projects: listProjectsByGroup(req.params.groupId) });
});

router.post('/groups/:groupId/projects', (req, res) => {
  const { name, type, description, createdBy } = req.body || {};
  if (!name || !createdBy) {
    return res.status(400).json({ success: false, error: 'name and createdBy are required' });
  }
  const actorUserId = resolveActorUserId(createdBy);
  const project = createWorkspaceProject({
    groupId: req.params.groupId,
    name,
    type,
    description,
    createdBy: actorUserId
  });
  writeAuditLog({
    workspaceProjectId: project.id,
    actorUserId,
    action: 'workspace_project.created',
    targetType: 'workspace_project',
    targetId: project.id,
    metadata: { groupId: req.params.groupId, name }
  });
  res.status(201).json({ success: true, project });
});

router.patch('/workspace-projects/:id', (req, res) => {
  const updated = updateWorkspaceProject(req.params.id, {
    name: req.body?.name,
    group_id: req.body?.groupId,
    type: req.body?.type,
    description: req.body?.description
  });
  if (!updated) return res.status(404).json({ success: false, error: 'project not found' });
  res.json({ success: true, project: updated });
});

export default router;
