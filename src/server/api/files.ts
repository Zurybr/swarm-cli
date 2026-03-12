import { Router, Response } from 'express';
import { sessionService } from '../services/sessionService';
import { projectService } from '../services/projectService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';
import { File, FileContent, FileStatusResult, FileStatus } from '../../types/api';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

async function getProjectAndSession(projectId: string, sessionId: string) {
  const project = await projectService.get(projectId);
  if (!project) return null;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) return null;
  
  return { project, session };
}

async function listFilesRecursive(dirPath: string, basePath: string): Promise<File[]> {
  const files: File[] = [];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next'];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(basePath, fullPath);
      
      if (ignoreDirs.includes(entry.name)) continue;
      
      if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        files.push({
          path: relPath,
          status: 'tracked' as FileStatus,
          lastModified: stats.mtime.toISOString()
        });
      } else if (entry.isDirectory()) {
        const subFiles = await listFilesRecursive(fullPath, basePath);
        files.push(...subFiles);
      }
    }
  } catch {
    // Ignore errors
  }
  
  return files;
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const context = await getProjectAndSession(projectId, sessionId);
  if (!context) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const { project } = context;
  const files = await listFilesRecursive(project.path, project.path);
  
  res.json({ files });
});

router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const context = await getProjectAndSession(projectId, sessionId);
  if (!context) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const { project } = context;
  const files = await listFilesRecursive(project.path, project.path);
  
  const statusResults: FileStatusResult[] = files.map(f => ({
    path: f.path,
    status: f.status,
    staged: false,
    conflicts: []
  }));
  
  res.json({ files: statusResults });
});

router.get('/*', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  const filePath = req.params[0];
  
  const context = await getProjectAndSession(projectId, sessionId);
  if (!context) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const { project } = context;
  const fullPath = path.join(project.path, filePath);
  
  try {
    const content = await fs.readFile(fullPath);
    const stats = await fs.stat(fullPath);
    
    const fileContent: FileContent = {
      path: filePath,
      content: content.toString('base64'),
      encoding: 'utf-8',
      size: content.length,
      lastModified: stats.mtime.toISOString()
    };
    
    res.json(fileContent);
  } catch {
    return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
  }
});

export { router as filesRouter };
