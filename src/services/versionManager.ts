import { CanvasState } from './canvasStateManager';

export interface CanvasVersion {
  version_id: string;
  project_id: string;
  version_name: string;
  canvas_state: CanvasState;
  created_at: number;
  note: string;
}

export function saveVersion(projectId: string, versionName: string, state: CanvasState, note: string = ''): CanvasVersion {
  const version: CanvasVersion = {
    version_id: Math.random().toString(36).substr(2, 9),
    project_id: projectId,
    version_name: versionName,
    canvas_state: JSON.parse(JSON.stringify(state)),
    created_at: Date.now(),
    note
  };

  try {
    const existingStr = localStorage.getItem(`versions_${projectId}`) || '[]';
    const existing = JSON.parse(existingStr);
    existing.push(version);
    localStorage.setItem(`versions_${projectId}`, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save version', e);
  }

  return version;
}

export function getVersions(projectId: string): CanvasVersion[] {
  try {
    const existingStr = localStorage.getItem(`versions_${projectId}`) || '[]';
    return JSON.parse(existingStr);
  } catch (e) {
    return [];
  }
}

export function deleteVersion(projectId: string, versionId: string): void {
  try {
    const existingStr = localStorage.getItem(`versions_${projectId}`) || '[]';
    let existing = JSON.parse(existingStr);
    existing = existing.filter((v: CanvasVersion) => v.version_id !== versionId);
    localStorage.setItem(`versions_${projectId}`, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to delete version', e);
  }
}
