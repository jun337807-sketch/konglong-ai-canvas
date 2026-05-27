import { Router } from 'express';
import { getSqliteDb } from '../db/sqlite.js';

const router = Router();

type DbUserRow = {
  id: string;
  username: string;
  display_name: string;
  role: 'admin' | 'user';
  status: string;
};

type DbTaskRow = {
  id: string;
  created_by: string;
  capability: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  input_json: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function safeJson(value: string | null | undefined): any {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function taskTitle(task: DbTaskRow) {
  const input = safeJson(task.input_json);
  const title = firstText(
    input.prompt,
    input.body?.prompt,
    input.payload?.prompt,
    input.description,
    input.title,
    task.capability
  );
  return title || task.capability || '生成任务';
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function durationSeconds(task: DbTaskRow) {
  const start = toTimestamp(task.started_at) || toTimestamp(task.created_at);
  const end =
    toTimestamp(task.completed_at) ||
    (task.status === 'running' || task.status === 'pending' ? Date.now() : toTimestamp(task.updated_at));
  if (!start || !end || end < start) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

function normalizeStatus(status: DbTaskRow['status']) {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'running';
}

router.get('/statistics/usage', (_req, res) => {
  try {
    const db = getSqliteDb();
    const users = db.prepare(`
      SELECT id, username, display_name, role, status
      FROM users
      WHERE status != 'deleted'
      ORDER BY role = 'admin' DESC, created_at ASC
    `).all() as DbUserRow[];

    const tasks = db.prepare(`
      SELECT id, created_by, capability, provider, status, input_json, error_message,
             started_at, completed_at, created_at, updated_at
      FROM tasks
      ORDER BY created_at DESC
    `).all() as DbTaskRow[];

    const userMap = new Map(users.map(user => [user.id, user]));
    const userStats = users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      totalTasks: 0,
      successTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      totalDuration: 0,
      recentTasks: [] as Array<{
        id: string;
        title: string;
        status: 'success' | 'failed' | 'running';
        durationSeconds: number;
        time: string;
        provider: string;
        capability: string;
        errorMessage: string | null;
      }>
    }));
    const statsMap = new Map(userStats.map(stats => [stats.id, stats]));

    let unknownStats = statsMap.get('system');
    for (const task of tasks) {
      let stats = statsMap.get(task.created_by);
      if (!stats) {
        if (!unknownStats) {
          unknownStats = {
            id: 'system',
            username: 'system',
            displayName: '系统任务',
            role: 'user',
            totalTasks: 0,
            successTasks: 0,
            failedTasks: 0,
            runningTasks: 0,
            totalDuration: 0,
            recentTasks: []
          };
          userStats.push(unknownStats);
          statsMap.set('system', unknownStats);
        }
        stats = unknownStats;
      }

      const status = normalizeStatus(task.status);
      const seconds = durationSeconds(task);
      stats.totalTasks += 1;
      if (status === 'success') stats.successTasks += 1;
      if (status === 'failed') stats.failedTasks += 1;
      if (status === 'running') stats.runningTasks += 1;
      stats.totalDuration += seconds;
      if (stats.recentTasks.length < 8) {
        stats.recentTasks.push({
          id: task.id,
          title: taskTitle(task),
          status,
          durationSeconds: seconds,
          time: task.created_at,
          provider: task.provider,
          capability: task.capability,
          errorMessage: task.error_message
        });
      }
    }

    const totals = userStats.reduce(
      (acc, user) => {
        acc.totalTasks += user.totalTasks;
        acc.successTasks += user.successTasks;
        acc.failedTasks += user.failedTasks;
        acc.runningTasks += user.runningTasks;
        acc.totalDuration += user.totalDuration;
        return acc;
      },
      { totalTasks: 0, successTasks: 0, failedTasks: 0, runningTasks: 0, totalDuration: 0 }
    );

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      totals: {
        ...totals,
        registeredUsers: users.length
      },
      users: userStats.filter(stats => userMap.has(stats.id) || stats.totalTasks > 0)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'usage_statistics_failed',
      message: '使用统计读取失败',
      detail: error?.message || String(error)
    });
  }
});

export default router;
