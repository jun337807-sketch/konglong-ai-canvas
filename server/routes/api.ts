import { Router } from 'express';
import { getBucketName, getTosClient, getTosPublicBaseUrl } from '../services/tosService.js';
import multer from 'multer';
import { getDb } from '../db/database.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// LEGACY: These project routes are kept only for backward compatibility with
// the original AI Studio export flow. New code should use:
// - /api/groups
// - /api/groups/:groupId/projects
// - /api/canvas-documents/:workspaceProjectId
//
// 1. Get Project List (from legacy JSON store)
router.get('/projects', async (req, res) => {
  try {
    const db = await getDb();
    const projects = await db.all('SELECT id, name, updatedAt FROM projects ORDER BY updatedAt DESC');
    res.json({ success: true, projects });
  } catch (err: any) {
    console.error('List projects error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save Project
router.post('/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, projectData } = req.body; 
  try {
    const db = await getDb();
    const now = Date.now();
    
    // Check if project exists
    const existing = await db.get('SELECT id FROM projects WHERE id = ?', [id]);
    
    if (existing) {
        await db.run(
            'UPDATE projects SET name = ?, projectData = ?, updatedAt = ? WHERE id = ?',
            [name || '?????', JSON.stringify(projectData), now, id]
        );
    } else {
        await db.run(
            'INSERT INTO projects (id, name, projectData, updatedAt) VALUES (?, ?, ?, ?)',
            [id, name || '?????', JSON.stringify(projectData), now]
        );
    }
    
    res.json({ success: true, message: 'Saved successfully' });
  } catch (err: any) {
    console.error('Save project error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Single Project
router.get('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const project = await db.get('SELECT projectData FROM projects WHERE id = ?', [id]);
    
    if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    res.json({ success: true, projectData: JSON.parse(project.projectData) });
  } catch (err: any) {
     console.error('Get project error:', err);
     res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Delete Project
router.delete('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    await db.run('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch(err: any) {
    console.error('Delete project error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. TOS File Upload 
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });
  try {
    const client = getTosClient();
    const extension = req.file.originalname.split('.').pop();
    const key = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    await client.putObject({
      bucket: getBucketName(),
      key: key,
      body: req.file.buffer,
    });
    
    const url = `${getTosPublicBaseUrl().replace(/\/$/, '')}/${key}`;
    res.json({ success: true, url });
  } catch (err: any) {
    console.error('Upload Error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/media-proxy', async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ success: false, error: 'invalid media url' });
  }

  try {
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 KonglongCanvas/1.0',
        ...(range ? { Range: range } : {})
      }
    });
    if (!response.ok || !response.body) {
      return res.status(response.status || 502).json({ success: false, error: `media fetch failed: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = response.headers.get('cache-control') || 'public, max-age=86400';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges') || 'bytes';

    res.status(response.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Accept-Ranges', acceptRanges);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    response.body.pipeTo(new WritableStream({
      write(chunk) {
        res.write(Buffer.from(chunk));
      },
      close() {
        res.end();
      },
      abort(err) {
        res.destroy(err);
      }
    })).catch((err) => {
      if (!res.headersSent) res.status(500);
      res.end();
      console.error('Media proxy stream error:', err);
    });
  } catch (err: any) {
    console.error('Media proxy error:', err);
    res.status(502).json({ success: false, error: err.message || 'media proxy failed' });
  }
});

export default router;

