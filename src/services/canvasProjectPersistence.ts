export interface CanvasProjectData {
  nodes: unknown[];
  edges: unknown[];
  viewport?: unknown;
}

export interface CanvasProjectPersistence {
  load(projectId: string): Promise<CanvasProjectData | null>;
  save(projectId: string, projectName: string, data: CanvasProjectData): Promise<void>;
}

class ApiFirstCanvasProjectPersistence implements CanvasProjectPersistence {
  async load(projectId: string): Promise<CanvasProjectData | null> {
    try {
      const res = await fetch(`/api/canvas-documents/${projectId}`).then(r => r.json());
      if (res.success && res.document) {
        return {
          nodes: res.document.nodes || [],
          edges: res.document.edges || [],
          viewport: res.document.viewport || null
        };
      }
    } catch (e) {
      console.warn('Failed to load canvas document from API', e);
    }
    return null;
  }

  async save(projectId: string, _projectName: string, data: CanvasProjectData): Promise<void> {
    try {
      await fetch(`/api/canvas-documents/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('Failed to save canvas document via API', e);
    }
  }
}

export const canvasProjectPersistence: CanvasProjectPersistence = new ApiFirstCanvasProjectPersistence();
