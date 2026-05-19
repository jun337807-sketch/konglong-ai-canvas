import { Task } from './taskQueueManager';
import { Node } from '@xyflow/react';

class ResultBinder {
  bindResultToNode(node: Node, task: Task): Partial<Node> | null {
    if (task.status !== 'completed' || !task.result) {
      return null;
    }

    const { type } = node;
    const { type: taskType, result } = task;

    if (type === 'imageNode' && taskType === 'image_generation') {
      return {
        ...node,
        data: {
          ...node.data,
          imageUrl: result.url,
          isGenerating: false,
        }
      };
    }

    if (type === 'videoNode' && taskType === 'video_generation') {
      return {
        ...node,
        data: {
          ...node.data,
          videoUrl: result.url,
          isGenerating: false,
        }
      };
    }

    return null;
  }
}

export const resultBinder = new ResultBinder();
