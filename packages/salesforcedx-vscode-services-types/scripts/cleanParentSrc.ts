import * as fs from 'fs';
import * as path from 'path';

/** Removes stray .d.ts files from parent package's src directory */
const cleanParentSrc = (): void => {
  const parentSrcDir = path.join(__dirname, '..', '..', 'salesforcedx-vscode-services', 'src');

  const removeFilesRecursively = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        removeFilesRecursively(fullPath);
      } else if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) {
        fs.unlinkSync(fullPath);
        console.log('Removed:', fullPath);
      }
    }
  };

  removeFilesRecursively(parentSrcDir);
  console.log('Cleanup complete!');
};

cleanParentSrc();
