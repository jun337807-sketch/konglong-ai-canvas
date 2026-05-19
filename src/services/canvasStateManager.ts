import { Node, Edge } from '@xyflow/react';

export interface CanvasDocument {
  workspace_project_id: string;
  nodes: Node[];
  edges: Edge[];
  assets: any[];
  tasks: any[];
  viewport: any;
  selected_node_id?: string;
  updated_at: number;
}

// Backward-compatible alias while the codebase is migrated gradually.
export type CanvasState = CanvasDocument;

export function exportCanvasState(projectId: string, nodes: Node[], edges: Edge[], viewport: any = null): CanvasDocument {
  return {
    workspace_project_id: projectId,
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    assets: [],
    tasks: [],
    viewport,
    updated_at: Date.now()
  };
}
