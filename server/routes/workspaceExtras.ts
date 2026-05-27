import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

const router = Router();

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function sharedAssetFromRow(row: any) {
  return {
    asset_id: row.asset_id,
    group_id: row.group_id,
    project_id: row.project_id || undefined,
    type: row.type,
    name: row.name,
    url: row.url,
    thumbnail_url: row.thumbnail_url || undefined,
    tags: parseJsonArray(row.tags_json),
    linked_episode_ids: parseJsonArray(row.linked_episode_ids_json),
    linked_beat_ids: parseJsonArray(row.linked_beat_ids_json),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function episodeFromRow(row: any) {
  return {
    episode_id: row.episode_id,
    project_id: row.project_id,
    episode_number: row.episode_number,
    title: row.title,
    summary: row.summary,
    script_text: row.script_text,
    storyboard_text: row.storyboard_text,
    required_asset_ids: parseJsonArray(row.required_asset_ids_json),
    annotations: parseJsonArray(row.annotations_json),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function beatFromRow(row: any) {
  return {
    beat_id: row.beat_id,
    episode_id: row.episode_id,
    beat_number: row.beat_number,
    title: row.title,
    script_text: row.script_text,
    storyboard_text: row.storyboard_text,
    required_asset_ids: parseJsonArray(row.required_asset_ids_json),
    linked_canvas_node_ids: parseJsonArray(row.linked_canvas_node_ids_json),
    annotations: parseJsonArray(row.annotations_json),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function annotationFromRow(row: any) {
  return {
    annotation_id: row.annotation_id,
    group_id: row.group_id,
    project_id: row.project_id,
    target_type: row.target_type,
    target_id: row.target_id,
    content: row.content,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/groups/:groupId/shared-assets', (req, res) => {
  const rows = getSqliteDb().prepare(`
    SELECT * FROM shared_assets WHERE group_id = ? ORDER BY created_at DESC
  `).all(req.params.groupId);
  res.json({ success: true, assets: rows.map(sharedAssetFromRow) });
});

router.post('/groups/:groupId/shared-assets', (req, res) => {
  const now = new Date().toISOString();
  const input = req.body || {};
  const asset = {
    asset_id: input.asset_id || `asset_${Date.now()}_${randomUUID().slice(0, 8)}`,
    group_id: req.params.groupId,
    project_id: input.project_id || null,
    type: input.type || 'reference',
    name: input.name || 'Asset',
    url: input.url,
    thumbnail_url: input.thumbnail_url || null,
    tags_json: JSON.stringify(input.tags || []),
    linked_episode_ids_json: JSON.stringify(input.linked_episode_ids || []),
    linked_beat_ids_json: JSON.stringify(input.linked_beat_ids || []),
    created_by: input.created_by || 'system',
    created_at: input.created_at || now,
    updated_at: now
  };
  if (!asset.url) return res.status(400).json({ success: false, error: 'url is required' });
  getSqliteDb().prepare(`
    INSERT INTO shared_assets (
      asset_id, group_id, project_id, type, name, url, thumbnail_url,
      tags_json, linked_episode_ids_json, linked_beat_ids_json,
      created_by, created_at, updated_at
    ) VALUES (
      @asset_id, @group_id, @project_id, @type, @name, @url, @thumbnail_url,
      @tags_json, @linked_episode_ids_json, @linked_beat_ids_json,
      @created_by, @created_at, @updated_at
    )
  `).run(asset);
  res.status(201).json({ success: true, asset: sharedAssetFromRow(asset) });
});

router.patch('/shared-assets/:assetId', (req, res) => {
  const existing = getSqliteDb().prepare(`SELECT * FROM shared_assets WHERE asset_id = ?`).get(req.params.assetId) as any;
  if (!existing) return res.status(404).json({ success: false, error: 'asset not found' });
  const input = req.body || {};
  const next = {
    ...existing,
    project_id: input.project_id ?? existing.project_id,
    type: input.type ?? existing.type,
    name: input.name ?? existing.name,
    url: input.url ?? existing.url,
    thumbnail_url: input.thumbnail_url ?? existing.thumbnail_url,
    tags_json: input.tags ? JSON.stringify(input.tags) : existing.tags_json,
    linked_episode_ids_json: input.linked_episode_ids ? JSON.stringify(input.linked_episode_ids) : existing.linked_episode_ids_json,
    linked_beat_ids_json: input.linked_beat_ids ? JSON.stringify(input.linked_beat_ids) : existing.linked_beat_ids_json,
    updated_at: new Date().toISOString()
  };
  getSqliteDb().prepare(`
    UPDATE shared_assets SET
      project_id=@project_id, type=@type, name=@name, url=@url, thumbnail_url=@thumbnail_url,
      tags_json=@tags_json, linked_episode_ids_json=@linked_episode_ids_json,
      linked_beat_ids_json=@linked_beat_ids_json, updated_at=@updated_at
    WHERE asset_id=@asset_id
  `).run(next);
  res.json({ success: true, asset: sharedAssetFromRow(next) });
});

router.delete('/shared-assets/:assetId', (req, res) => {
  const result = getSqliteDb().prepare(`DELETE FROM shared_assets WHERE asset_id = ?`).run(req.params.assetId);
  res.json({ success: true, deleted: result.changes > 0 });
});

router.get('/projects/:projectId/episodes', (req, res) => {
  const rows = getSqliteDb().prepare(`
    SELECT * FROM script_episodes WHERE project_id = ? ORDER BY episode_number ASC, created_at ASC
  `).all(req.params.projectId);
  res.json({ success: true, episodes: rows.map(episodeFromRow) });
});

router.post('/projects/:projectId/episodes', (req, res) => {
  const now = new Date().toISOString();
  const input = req.body || {};
  const count = getSqliteDb().prepare(`SELECT COUNT(*) as count FROM script_episodes WHERE project_id = ?`).get(req.params.projectId) as any;
  const episode = {
    episode_id: input.episode_id || `ep_${Date.now()}_${randomUUID().slice(0, 8)}`,
    project_id: req.params.projectId,
    episode_number: input.episode_number || Number(count?.count || 0) + 1,
    title: input.title || `Episode ${Number(count?.count || 0) + 1}`,
    summary: input.summary || '',
    script_text: input.script_text || '',
    storyboard_text: input.storyboard_text || '',
    required_asset_ids_json: JSON.stringify(input.required_asset_ids || []),
    annotations_json: JSON.stringify(input.annotations || []),
    status: input.status || 'draft',
    created_at: input.created_at || now,
    updated_at: now
  };
  getSqliteDb().prepare(`
    INSERT INTO script_episodes (
      episode_id, project_id, episode_number, title, summary, script_text, storyboard_text,
      required_asset_ids_json, annotations_json, status, created_at, updated_at
    ) VALUES (
      @episode_id, @project_id, @episode_number, @title, @summary, @script_text, @storyboard_text,
      @required_asset_ids_json, @annotations_json, @status, @created_at, @updated_at
    )
  `).run(episode);
  res.status(201).json({ success: true, episode: episodeFromRow(episode) });
});

router.patch('/episodes/:episodeId', (req, res) => {
  const existing = getSqliteDb().prepare(`SELECT * FROM script_episodes WHERE episode_id = ?`).get(req.params.episodeId) as any;
  if (!existing) return res.status(404).json({ success: false, error: 'episode not found' });
  const input = req.body || {};
  const next = {
    ...existing,
    episode_number: input.episode_number ?? existing.episode_number,
    title: input.title ?? existing.title,
    summary: input.summary ?? existing.summary,
    script_text: input.script_text ?? existing.script_text,
    storyboard_text: input.storyboard_text ?? existing.storyboard_text,
    required_asset_ids_json: input.required_asset_ids ? JSON.stringify(input.required_asset_ids) : existing.required_asset_ids_json,
    annotations_json: input.annotations ? JSON.stringify(input.annotations) : existing.annotations_json,
    status: input.status ?? existing.status,
    updated_at: new Date().toISOString()
  };
  getSqliteDb().prepare(`
    UPDATE script_episodes SET episode_number=@episode_number, title=@title, summary=@summary,
      script_text=@script_text, storyboard_text=@storyboard_text, required_asset_ids_json=@required_asset_ids_json,
      annotations_json=@annotations_json, status=@status, updated_at=@updated_at
    WHERE episode_id=@episode_id
  `).run(next);
  res.json({ success: true, episode: episodeFromRow(next) });
});

router.delete('/episodes/:episodeId', (req, res) => {
  const db = getSqliteDb();
  db.prepare(`DELETE FROM script_beats WHERE episode_id = ?`).run(req.params.episodeId);
  const result = db.prepare(`DELETE FROM script_episodes WHERE episode_id = ?`).run(req.params.episodeId);
  res.json({ success: true, deleted: result.changes > 0 });
});

router.get('/episodes/:episodeId/beats', (req, res) => {
  const rows = getSqliteDb().prepare(`
    SELECT * FROM script_beats WHERE episode_id = ? ORDER BY beat_number ASC, created_at ASC
  `).all(req.params.episodeId);
  res.json({ success: true, beats: rows.map(beatFromRow) });
});

router.post('/episodes/:episodeId/beats', (req, res) => {
  const now = new Date().toISOString();
  const input = req.body || {};
  const count = getSqliteDb().prepare(`SELECT COUNT(*) as count FROM script_beats WHERE episode_id = ?`).get(req.params.episodeId) as any;
  const beat = {
    beat_id: input.beat_id || `beat_${Date.now()}_${randomUUID().slice(0, 8)}`,
    episode_id: req.params.episodeId,
    beat_number: input.beat_number || Number(count?.count || 0) + 1,
    title: input.title || 'Beat',
    script_text: input.script_text || '',
    storyboard_text: input.storyboard_text || '',
    required_asset_ids_json: JSON.stringify(input.required_asset_ids || []),
    linked_canvas_node_ids_json: JSON.stringify(input.linked_canvas_node_ids || []),
    annotations_json: JSON.stringify(input.annotations || []),
    status: input.status || 'draft',
    created_at: input.created_at || now,
    updated_at: now
  };
  getSqliteDb().prepare(`
    INSERT INTO script_beats (
      beat_id, episode_id, beat_number, title, script_text, storyboard_text,
      required_asset_ids_json, linked_canvas_node_ids_json, annotations_json,
      status, created_at, updated_at
    ) VALUES (
      @beat_id, @episode_id, @beat_number, @title, @script_text, @storyboard_text,
      @required_asset_ids_json, @linked_canvas_node_ids_json, @annotations_json,
      @status, @created_at, @updated_at
    )
  `).run(beat);
  res.status(201).json({ success: true, beat: beatFromRow(beat) });
});

router.patch('/beats/:beatId', (req, res) => {
  const existing = getSqliteDb().prepare(`SELECT * FROM script_beats WHERE beat_id = ?`).get(req.params.beatId) as any;
  if (!existing) return res.status(404).json({ success: false, error: 'beat not found' });
  const input = req.body || {};
  const next = {
    ...existing,
    beat_number: input.beat_number ?? existing.beat_number,
    title: input.title ?? existing.title,
    script_text: input.script_text ?? existing.script_text,
    storyboard_text: input.storyboard_text ?? existing.storyboard_text,
    required_asset_ids_json: input.required_asset_ids ? JSON.stringify(input.required_asset_ids) : existing.required_asset_ids_json,
    linked_canvas_node_ids_json: input.linked_canvas_node_ids ? JSON.stringify(input.linked_canvas_node_ids) : existing.linked_canvas_node_ids_json,
    annotations_json: input.annotations ? JSON.stringify(input.annotations) : existing.annotations_json,
    status: input.status ?? existing.status,
    updated_at: new Date().toISOString()
  };
  getSqliteDb().prepare(`
    UPDATE script_beats SET beat_number=@beat_number, title=@title, script_text=@script_text,
      storyboard_text=@storyboard_text, required_asset_ids_json=@required_asset_ids_json,
      linked_canvas_node_ids_json=@linked_canvas_node_ids_json, annotations_json=@annotations_json,
      status=@status, updated_at=@updated_at
    WHERE beat_id=@beat_id
  `).run(next);
  res.json({ success: true, beat: beatFromRow(next) });
});

router.delete('/beats/:beatId', (req, res) => {
  const result = getSqliteDb().prepare(`DELETE FROM script_beats WHERE beat_id = ?`).run(req.params.beatId);
  res.json({ success: true, deleted: result.changes > 0 });
});

router.get('/annotations/:targetType/:targetId', (req, res) => {
  const rows = getSqliteDb().prepare(`
    SELECT * FROM workspace_annotations WHERE target_type = ? AND target_id = ? ORDER BY created_at ASC
  `).all(req.params.targetType, req.params.targetId);
  res.json({ success: true, annotations: rows.map(annotationFromRow) });
});

router.post('/annotations', (req, res) => {
  const now = new Date().toISOString();
  const input = req.body || {};
  const annotation = {
    annotation_id: input.annotation_id || `ann_${Date.now()}_${randomUUID().slice(0, 8)}`,
    group_id: input.group_id,
    project_id: input.project_id,
    target_type: input.target_type,
    target_id: input.target_id,
    content: input.content,
    status: input.status || 'open',
    created_by: input.created_by || 'system',
    created_at: input.created_at || now,
    updated_at: now
  };
  if (!annotation.group_id || !annotation.project_id || !annotation.target_type || !annotation.target_id || !annotation.content) {
    return res.status(400).json({ success: false, error: 'missing required annotation fields' });
  }
  getSqliteDb().prepare(`
    INSERT INTO workspace_annotations (
      annotation_id, group_id, project_id, target_type, target_id, content, status,
      created_by, created_at, updated_at
    ) VALUES (
      @annotation_id, @group_id, @project_id, @target_type, @target_id, @content, @status,
      @created_by, @created_at, @updated_at
    )
  `).run(annotation);
  res.status(201).json({ success: true, annotation: annotationFromRow(annotation) });
});

router.patch('/annotations/:annotationId', (req, res) => {
  const existing = getSqliteDb().prepare(`SELECT * FROM workspace_annotations WHERE annotation_id = ?`).get(req.params.annotationId) as any;
  if (!existing) return res.status(404).json({ success: false, error: 'annotation not found' });
  const input = req.body || {};
  const next = {
    ...existing,
    content: input.content ?? existing.content,
    status: input.status ?? existing.status,
    updated_at: new Date().toISOString()
  };
  getSqliteDb().prepare(`
    UPDATE workspace_annotations SET content=@content, status=@status, updated_at=@updated_at
    WHERE annotation_id=@annotation_id
  `).run(next);
  res.json({ success: true, annotation: annotationFromRow(next) });
});

router.delete('/annotations/:annotationId', (req, res) => {
  const result = getSqliteDb().prepare(`DELETE FROM workspace_annotations WHERE annotation_id = ?`).run(req.params.annotationId);
  res.json({ success: true, deleted: result.changes > 0 });
});

export default router;
