/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { globSync } from 'glob';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { PackageJson } from '../types/packageJson';

// These unit tests check that specified dependencies in package.json do not use
// ^ or ~ in the version range, either because those packages do not use semver
// and minor/patch updates will break functionality, or because they should only
// use an exact version.

const checkedPackagePatterns: RegExp[] = [/^@salesforce/i, /^@lwc/i];
const exemptedPackages = new Set(['@salesforce/core']);

const readJsonFile = async (jsonFilePath: string): Promise<Record<string, unknown>> => {
  try {
    const content = Buffer.from(await vscode.workspace.fs.readFile(URI.file(jsonFilePath))).toString('utf8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Error reading json file from ${jsonFilePath}: ${String(e)}`);
  }
};

const checkFileExists = async (filePath: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(URI.file(filePath));
    return true;
  } catch {
    return false;
  }
};

const runTests = async (): Promise<PackageJson> => {
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

  return packageJson as PackageJson;
};

describe('package.json dependencies', () => {
  let packageJson: PackageJson;

  beforeAll(async () => {
    packageJson = await runTests();
  });

  it('validates package dependencies', () => {
    const dependencies = packageJson.dependencies ?? {};
    const devDependencies = packageJson.devDependencies ?? {};
    let testMatchFound = false;

    const checkEntries = (entries: [string, string][]) =>
      entries
        .filter(([name]) => !exemptedPackages.has(name))
        .forEach(([name, versionRange]) =>
          checkedPackagePatterns.forEach(pattern => {
            if (pattern.test(name)) {
              expect(versionRange.trim().startsWith('^')).toEqual(false);
              expect(versionRange.trim().startsWith('~')).toEqual(false);
              expect(versionRange.trim().startsWith('>')).toEqual(false);
              expect(versionRange.trim().startsWith('<')).toEqual(false);
              testMatchFound = true;
            }
          })
        );

    checkEntries(Object.entries(dependencies));
    checkEntries(Object.entries(devDependencies));

    if (!testMatchFound) {
      console.log(`no dependencies matching expected patterns ${checkedPackagePatterns.join(', ')}`);
    }
  });
});
