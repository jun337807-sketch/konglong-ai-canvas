import { createOperationLog } from '../repositories/operationLogRepository.js';

export function writeAuditLog(input: Parameters<typeof createOperationLog>[0]) {
  try {
    createOperationLog(input);
  } catch (err) {
    console.warn('Failed to write audit log:', err);
  }
}
