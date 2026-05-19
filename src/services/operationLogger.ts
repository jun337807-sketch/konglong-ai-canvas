import { CanvasState } from './canvasStateManager';

export interface OperationLog {
  operation_id: string;
  project_id: string;
  type: string;
  target_type: string;
  target_id: string;
  before: any;
  after: any;
  created_at: number;
}

export function logOperation(log: Omit<OperationLog, 'operation_id' | 'created_at'>): OperationLog {
  const fullLog: OperationLog = {
    ...log,
    operation_id: Math.random().toString(36).substr(2, 9),
    created_at: Date.now()
  };
  
  // In a real application, this would sync to the backend
  console.log('[Operation Log]', fullLog);
  
  // Quick local storage save for audit
  try {
    const existingStr = localStorage.getItem(`ops_${log.project_id}`) || '[]';
    const existing = JSON.parse(existingStr);
    existing.push(fullLog);
    localStorage.setItem(`ops_${log.project_id}`, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save operation log', e);
  }
  
  return fullLog;
}

export function getOperations(projectId: string): OperationLog[] {
  try {
    const existingStr = localStorage.getItem(`ops_${projectId}`) || '[]';
    return JSON.parse(existingStr);
  } catch (e) {
    return [];
  }
}
