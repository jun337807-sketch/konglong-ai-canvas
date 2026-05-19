import { Node, Edge } from '@xyflow/react';

class CanvasActionService {
  async exportCurrentCanvas(projectId: string, nodes: Node[], edges: Edge[]) {
    try {
      const data = {
        version: '1.0',
        projectId,
        exportDate: new Date().toISOString(),
        nodes,
        edges
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas_export_${projectId}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('Export failed:', e);
      return false;
    }
  }

  async importCanvas(jsonString: string): Promise<{nodes: Node[], edges: Edge[]} | null> {
    try {
      const data = JSON.parse(jsonString);
      if (data.nodes && Array.isArray(data.nodes) && data.edges && Array.isArray(data.edges)) {
        return { nodes: data.nodes, edges: data.edges };
      }
      return null;
    } catch (e) {
      console.error('Import failed:', e);
      return null;
    }
  }

  async extractAssetsFromNodes(nodes: Node[]) {
    const assets: any[] = [];
    nodes.forEach(n => {
      if (n.data?.imageUrl) assets.push({ type: 'image', url: n.data.imageUrl, nodeId: n.id });
      if (n.data?.videoUrl) assets.push({ type: 'video', url: n.data.videoUrl, nodeId: n.id });
      if (n.data?.audioUrl) assets.push({ type: 'audio', url: n.data.audioUrl, nodeId: n.id });
    });
    return assets;
  }
}

export const canvasActionService = new CanvasActionService();
