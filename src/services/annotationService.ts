import { Annotation } from '../types/workspace';

const ANNOTATIONS_KEY = 'workspace_annotations';

const db = {
  getAnnotations: (): Annotation[] => JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) || '[]'),
  saveAnnotations: (anns: Annotation[]) => localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(anns)),
};

class AnnotationService {
  async getAnnotationsByTarget(targetType: Annotation['target_type'], targetId: string): Promise<Annotation[]> {
    try {
      const res = await fetch(`/api/annotations/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`);
      if (!res.ok) throw new Error(`annotations request failed: ${res.status}`);
      const data = await res.json();
      return data.annotations || [];
    } catch (err) {
      console.warn('Use local annotations fallback:', err);
      return Promise.resolve(db.getAnnotations().filter(a => a.target_type === targetType && a.target_id === targetId));
    }
  }

  async createAnnotation(data: Partial<Annotation> & { group_id: string, project_id: string, target_type: Annotation['target_type'], target_id: string, content: string }): Promise<Annotation> {
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`create annotation failed: ${res.status}`);
      const payload = await res.json();
      return payload.annotation;
    } catch (err) {
      console.warn('Create local annotation fallback:', err);
    }
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
    try {
      const res = await fetch(`/api/annotations/${encodeURIComponent(annotationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`update annotation failed: ${res.status}`);
      const data = await res.json();
      return data.annotation;
    } catch (err) {
      console.warn('Update local annotation fallback:', err);
    }
    const anns = db.getAnnotations();
    const idx = anns.findIndex(a => a.annotation_id === annotationId);
    if (idx === -1) return Promise.resolve(null);
    anns[idx] = { ...anns[idx], ...updates, updated_at: new Date().toISOString() };
    db.saveAnnotations(anns);
    return Promise.resolve(anns[idx]);
  }

  async deleteAnnotation(annotationId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/annotations/${encodeURIComponent(annotationId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`delete annotation failed: ${res.status}`);
      const data = await res.json();
      return Boolean(data.deleted);
    } catch (err) {
      console.warn('Delete local annotation fallback:', err);
    }
    const anns = db.getAnnotations();
    const nextAnns = anns.filter(a => a.annotation_id !== annotationId);
    db.saveAnnotations(nextAnns);
    return Promise.resolve(nextAnns.length !== anns.length);
  }
}

export const annotationService = new AnnotationService();
