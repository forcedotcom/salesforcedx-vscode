import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const defaultFolders = ['classes', 'triggers'];
export const createProject = async (baseDir: string) => {
  const defaultDir = path.join(baseDir, 'force-app', 'main', 'default');
  await fs.rm(baseDir, { recursive: true, force: true });
  await Promise.all(defaultFolders.map(folder => fs.mkdir(path.join(defaultDir, folder), { recursive: true })));
  await fs.writeFile(
    path.join(baseDir, 'sfdx-project.json'),
    JSON.stringify({
      packageDirectories: [{ path: 'force-app' }]
    })
  );
};
