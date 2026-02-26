/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { globSync } from 'glob';
import * as path from 'node:path';
import * as vscode from 'vscode';

// These unit tests check that specified dependencies in package.json do not use
// ^ or ~ in the version range, either because those packages do not use semver
// and minor/patch updates will break functionality, or because they should only
// use an exact version.

const checkedPackagePatterns: RegExp[] = [/^@salesforce/i, /^@lwc/i];

const readJsonFile = async (jsonFilePath: string): Promise<Record<string, unknown>> => {
  try {
    const content = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(jsonFilePath))).toString('utf8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Error reading json file from ${jsonFilePath}: ${String(e)}`);
  }
};

const checkFileExists = async (filePath: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
};

const runTests = async (): Promise<Record<string, unknown>> => {
  const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
  const packageJson = await readJsonFile(packageJsonPath);

  // if we're in a monorepo, find other packages in the monorepo and make sure
  // references to those also use exact versions
  const monorepoRootPath = path.join(packageJsonPath, '..', '..', '..');
  const monorepoConfigPath = path.join(monorepoRootPath, 'lerna.json');
  if (await checkFileExists(monorepoConfigPath)) {
    const monorepoConfig = await readJsonFile(monorepoConfigPath);
    if (monorepoConfig.packages && Array.isArray(monorepoConfig.packages)) {
      for (const packageGlob of monorepoConfig.packages) {
        const matches = globSync(packageGlob, {
          cwd: monorepoRootPath
        });
        for (const match of matches) {
          const peerPackageJsonPath = path.join(monorepoRootPath, match, 'package.json');
          const peerPackageJson = await readJsonFile(peerPackageJsonPath);
          if (peerPackageJson.name !== packageJson.name) {
            checkedPackagePatterns.push(new RegExp(`^${String(peerPackageJson.name)}`, 'i'));
          }
        }
      }
    }
  }

  return packageJson;
};

describe('package.json dependencies', () => {
  let packageJson: Record<string, unknown>;

  beforeAll(async () => {
    packageJson = await runTests();
  });

  it('validates package dependencies', () => {
    const dependencies: Record<string, string> = packageJson.dependencies as Record<string, string>;
    const devDependencies: Record<string, string> = packageJson.devDependencies as Record<string, string>;
    let testMatchFound = false;

    for (const [name, versionRange] of Object.entries(dependencies)) {
      checkedPackagePatterns.forEach(pattern => {
        if (pattern.test(name)) {
          expect(versionRange.trim().startsWith('^')).toEqual(false);
          expect(versionRange.trim().startsWith('~')).toEqual(false);
          expect(versionRange.trim().startsWith('>')).toEqual(false);
          expect(versionRange.trim().startsWith('<')).toEqual(false);
          testMatchFound = true;
        }
      });
    }

    for (const [name, versionRange] of Object.entries(devDependencies)) {
      checkedPackagePatterns.forEach(pattern => {
        if (pattern.test(name)) {
          expect(versionRange.trim().startsWith('^')).toEqual(false);
          expect(versionRange.trim().startsWith('~')).toEqual(false);
          expect(versionRange.trim().startsWith('>')).toEqual(false);
          expect(versionRange.trim().startsWith('<')).toEqual(false);
          testMatchFound = true;
        }
      });
    }

    if (!testMatchFound) {
      console.log(`no dependencies matching expected patterns ${checkedPackagePatterns.join(', ')}`);
    }
  });
});
