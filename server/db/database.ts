import fs from 'fs/promises';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.json');

let dbContent: any = null;

async function loadDb() {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    dbContent = JSON.parse(data);
  } catch (err) {
    dbContent = { projects: [] };
    await saveDb();
  }
}

async function saveDb() {
  await fs.writeFile(dbPath, JSON.stringify(dbContent, null, 2), 'utf8');
}

export async function getDb() {
  if (!dbContent) {
    await loadDb();
  }
  
  return {
    all: async (sql: string) => {
      // Stub for SELECT id, name, updatedAt FROM projects ORDER BY updatedAt DESC
      return dbContent.projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt
      })).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    },
    get: async (sql: string, params: any[]) => {
      // Stub for SELECT
      if (sql.includes('SELECT id FROM projects')) {
        return dbContent.projects.find((p: any) => p.id === params[0]);
      } else if (sql.includes('SELECT projectData FROM projects')) {
        const proj = dbContent.projects.find((p: any) => p.id === params[0]);
        return proj ? { projectData: proj.projectData } : undefined;
      }
      return null;
    },
    run: async (sql: string, params: any[]) => {
      if (sql.includes('UPDATE projects SET')) {
        const id = params[3];
        const projIndex = dbContent.projects.findIndex((p: any) => p.id === id);
        if (projIndex >= 0) {
          dbContent.projects[projIndex].name = params[0];
          dbContent.projects[projIndex].projectData = params[1];
          dbContent.projects[projIndex].updatedAt = params[2];
        }
      } else if (sql.includes('INSERT INTO projects')) {
        dbContent.projects.push({
          id: params[0],
          name: params[1],
          projectData: params[2],
          updatedAt: params[3]
        });
      } else if (sql.includes('DELETE FROM projects')) {
         dbContent.projects = dbContent.projects.filter((p: any) => p.id !== params[0]);
      }
      await saveDb();
    }
  };
}
