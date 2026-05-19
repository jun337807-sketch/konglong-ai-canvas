import express from "express";
import 'dotenv/config';
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import apiRoutes from './routes/api.js';
import userRoutes from './routes/users.js';
import workspaceRoutes from './routes/workspace.js';
import canvasDocumentRoutes from './routes/canvasDocuments.js';
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import taskRoutes from './routes/tasks.js';
import operationLogRoutes from './routes/operationLogs.js';
import generationRoutes from './routes/generation.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const corsOrigin = process.env.CORS_ORIGIN?.trim();

  // Middleware
  app.use(cors(corsOrigin ? { origin: corsOrigin, credentials: true } : undefined));
  app.use(express.json({ limit: '100mb' })); 

  // API Routes
  app.use('/api', apiRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api', workspaceRoutes);
  app.use('/api/canvas-documents', canvasDocumentRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', assetRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', operationLogRoutes);
  app.use('/api', generationRoutes);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
