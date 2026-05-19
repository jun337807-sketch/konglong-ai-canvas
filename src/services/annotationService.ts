import { Annotation } from '../types/workspace';

const ANNOTATIONS_KEY = 'workspace_annotations';

const db = {
  getAnnotations: (): Annotation[] => JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) || '[]'),
  saveAnnotations: (anns: Annotation[]) => localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(anns)),
};

class AnnotationService {
  async getAnnotationsByTarget(targetType: Annotation['target_type'], targetId: string): Promise<Annotation[]> {
    return Promise.resolve(db.getAnnotations().filter(a => a.target_type === targetType && a.target_id === targetId));
  }

  async createAnnotation(data: Partial<Annotation> & { group_id: string, project_id: string, target_type: Annotation['target_type'], target_id: string, content: string }): Promise<Annotation> {
    const anns = db.getAnnotations();
    const newAnn: Annotation = {
      annotation_id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      group_id: data.group_id,
      project_id: data.project_id,
      target_type: data.target_type,
      target_id: data.target_id,
      content: data.content,
      status: data.status || 'open',
      created_by: data.created_by || 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    anns.push(newAnn);
    db.saveAnnotations(anns);
    return Promise.resolve(newAnn);
  }

  async updateAnnotation(annotationId: string, updates: Partial<Annotation>): Promise<Annotation | null> {
    const anns = db.getAnnotations();
    const idx = anns.findIndex(a => a.annotation_id === annotationId);
    if (idx === -1) return Promise.resolve(null);
    anns[idx] = { ...anns[idx], ...updates, updated_at: new Date().toISOString() };
    db.saveAnnotations(anns);
    return Promise.resolve(anns[idx]);
  }
}

export const annotationService = new AnnotationService();
