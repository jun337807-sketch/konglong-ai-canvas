import { Node, Edge } from '@xyflow/react';

export interface HealthCheckResult {
  score: number;
  issues: { type: 'error' | 'warning' | 'info'; message: string; nodeId?: string }[];
}

class CanvasHealthCheck {
  async inspect(nodes: Node[], edges: Edge[]): Promise<HealthCheckResult> {
    const issues: HealthCheckResult['issues'] = [];
    let score = 100;

    // Check disconnected nodes
    const connectedNodeIds = new Set<string>();
    edges.forEach(e => {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    });

    nodes.forEach(n => {
      if (!connectedNodeIds.has(n.id) && nodes.length > 1) {
        issues.push({ type: 'warning', message: `节点 ${n.data?.title || n.id} (类型: ${n.type}) 孤立，未与其他节点连接`, nodeId: n.id });
        score -= 5;
      }
    });

    // Check missing resources
    nodes.forEach(n => {
      if (n.type === 'imageNode' && !n.data?.imageUrl) {
        issues.push({ type: 'error', message: `图片节点 ${n.id} 缺少有效资源链接`, nodeId: n.id });
        score -= 10;
      }
      if (n.type === 'videoNode' && !n.data?.videoUrl) {
        issues.push({ type: 'error', message: `视频节点 ${n.id} 缺少有效资源链接`, nodeId: n.id });
        score -= 10;
      }
    });

    score = Math.max(0, score);
    return { score, issues };
  }
}

export const canvasHealthCheck = new CanvasHealthCheck();
