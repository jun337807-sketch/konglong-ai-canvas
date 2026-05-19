import { Router } from 'express';
import {
  getCanvasDocumentByProjectId,
  upsertCanvasDocument
} from '../repositories/canvasDocumentRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = Router();

router.get('/:workspaceProjectId', (req, res) => {
  const doc = getCanvasDocumentByProjectId(req.params.workspaceProjectId);
  if (!doc) return res.status(404).json({ success: false, error: 'canvas document not found' });

  res.json({
    success: true,
    document: {
      id: doc.id,
      workspaceProjectId: doc.workspace_project_id,
      nodes: JSON.parse(doc.nodes_json || '[]'),
      edges: JSON.parse(doc.edges_json || '[]'),
      viewport: doc.viewport_json ? JSON.parse(doc.viewport_json) : null,
      version: doc.version,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at
    }
  });
});

router.put('/:workspaceProjectId', (req, res) => {
  const { nodes, edges, viewport } = req.body || {};
  const doc = upsertCanvasDocument({
    workspaceProjectId: req.params.workspaceProjectId,
    nodes: nodes || [],
    edges: edges || [],
    viewport
  });
  writeAuditLog({
    workspaceProjectId: req.params.workspaceProjectId,
    action: 'canvas_document.saved',
    targetType: 'canvas_document',
    targetId: doc.id,
    metadata: {
      nodesCount: Array.isArray(nodes) ? nodes.length : 0,
      edgesCount: Array.isArray(edges) ? edges.length : 0,
      version: doc.version
    }
  });

  res.json({
    success: true,
    document: {
      id: doc.id,
      workspaceProjectId: doc.workspace_project_id,
      nodes: JSON.parse(doc.nodes_json || '[]'),
      edges: JSON.parse(doc.edges_json || '[]'),
      viewport: doc.viewport_json ? JSON.parse(doc.viewport_json) : null,
      version: doc.version,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at
    }
  });
});

export default router;
