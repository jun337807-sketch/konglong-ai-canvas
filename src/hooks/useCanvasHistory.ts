import { useCallback, useEffect, useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { HistoryManager, HistoryAction } from '../services/historyManager';
import { CanvasState, exportCanvasState } from '../services/canvasStateManager';

export function useCanvasHistory(
  projectId: string,
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void
) {
  const [manager] = useState(() => new HistoryManager(projectId));

  // We need to initialize on first load
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      if (!manager.canUndo() && !manager.canRedo()) {
        manager.initialize(exportCanvasState(projectId, nodes, edges, null));
      }
    }
  }, [nodes, edges, manager, projectId]);

  const saveHistory = useCallback((actionType: string, targetId?: string, targetType?: string) => {
    manager.push(actionType, exportCanvasState(projectId, nodes, edges, null), targetId, targetType);
  }, [manager, projectId, nodes, edges]);

  const undo = useCallback(() => {
    const prevState = manager.undo();
    if (prevState) {
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
    }
  }, [manager, setNodes, setEdges]);

  const redo = useCallback(() => {
    const nextState = manager.redo();
    if (nextState) {
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
    }
  }, [manager, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return { saveHistory, undo, redo, canUndo: manager.canUndo(), canRedo: manager.canRedo() };
}
