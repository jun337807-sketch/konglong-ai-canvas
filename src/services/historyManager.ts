import { CanvasState } from './canvasStateManager';
import { logOperation } from './operationLogger';

export interface HistoryAction {
  type: string;
  state: CanvasState;
  targetId?: string;
  targetType?: string;
}

export class HistoryManager {
  private past: HistoryAction[] = [];
  private future: HistoryAction[] = [];
  private current: CanvasState | null = null;
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  initialize(state: CanvasState) {
    this.current = JSON.parse(JSON.stringify(state));
    this.past = [];
    this.future = [];
  }

  push(actionType: string, newState: CanvasState, targetId?: string, targetType?: string) {
    if (!this.current) {
      this.current = JSON.parse(JSON.stringify(newState));
      return;
    }

    const previousState = this.current;
    
    this.past.push({
      type: actionType,
      state: previousState,
      targetId,
      targetType
    });
    
    // Limit history stack size if needed
    if (this.past.length > 50) {
      this.past.shift();
    }

    this.current = JSON.parse(JSON.stringify(newState));
    this.future = [];

    // Log the operation
    logOperation({
      project_id: this.projectId,
      type: actionType,
      target_type: targetType || 'canvas',
      target_id: targetId || 'global',
      before: previousState,
      after: this.current
    });
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  undo(): CanvasState | null {
    if (!this.canUndo() || !this.current) return null;

    const previous = this.past.pop()!;
    
    this.future.push({
      type: 'undo',
      state: this.current
    });

    this.current = previous.state;
    return JSON.parse(JSON.stringify(this.current));
  }

  redo(): CanvasState | null {
    if (!this.canRedo() || !this.current) return null;

    const next = this.future.pop()!;
    
    this.past.push({
      type: 'redo',
      state: this.current
    });

    this.current = next.state;
    return JSON.parse(JSON.stringify(this.current));
  }
}
