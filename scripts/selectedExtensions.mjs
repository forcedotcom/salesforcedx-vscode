import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const extensionGroups = JSON.parse(readFileSync(path.join(root, 'scripts', 'extension-groups.json'), 'utf8'));
const requiredExtensions = extensionGroups['core-services'];

export async function discoverExtensions() {
  const packagesDir = path.join(root, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const extensions = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let pkg;
    try {
      pkg = JSON.parse(await readFile(path.join(packagesDir, entry.name, 'package.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    if (pkg.publisher === 'salesforce' && pkg.engines?.vscode && pkg.main && pkg.contributes) {
      extensions.push({
        name: entry.name,
        label: pkg.displayName || entry.name,
        dependencies: (pkg.extensionDependencies || [])
          .filter(dependency => dependency.startsWith('salesforce.salesforcedx-vscode-'))
          .map(dependency => dependency.slice('salesforce.'.length))
      });
    }
  }

  extensions.sort((a, b) => a.name.localeCompare(b.name));
  for (const name of requiredExtensions) {
    if (!extensions.some(extension => extension.name === name)) {
      throw new Error(`Required extension is missing: ${name}`);
    }
  }
  return extensions;
}
