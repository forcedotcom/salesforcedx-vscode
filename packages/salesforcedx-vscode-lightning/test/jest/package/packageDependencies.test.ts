/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isPackageJson, PackageJson } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as fs from 'node:fs';
import * as path from 'node:path';

const checkedPackagePatterns: RegExp[] = [
  /^@salesforce\/lightning-lsp-common/i,
  /^@salesforce\/aura-language-server/i,
  /^@salesforce\/lwc-language-server/i,
  /^@salesforce\/salesforcedx/i
];

const readJsonFile = (jsonFilePath: string): PackageJson => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  } catch (e) {
    throw new Error(`Error reading json file from ${jsonFilePath}: ${String(e)}`);
  }
  if (!isPackageJson(parsed)) {
    throw new Error(`File does not conform to PackageJson shape: ${jsonFilePath}`);
  }
  return parsed;
};

const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
const packageJson = readJsonFile(packageJsonPath);

describe(`package.json dependencies for ${packageJson.name ?? ''}`, () => {
  const dependencies = packageJson.dependencies ?? {};
  const devDependencies = packageJson.devDependencies ?? {};

  Object.keys(dependencies).forEach(name => {
    const versionRange = dependencies[name];
    checkedPackagePatterns.forEach(pattern => {
      if (pattern.test(name)) {
        test(`should use a strict version for dependency ${name}`, () => {
          expect(versionRange.trim()).not.toContain('^');
          expect(versionRange.trim()).not.toContain('~');
          expect(versionRange.trim()).not.toContain('>');
          expect(versionRange.trim()).not.toContain('<');
        });
      }
    });
  });

  Object.keys(devDependencies).forEach(name => {
    const versionRange = devDependencies[name];
    checkedPackagePatterns.forEach(pattern => {
      if (pattern.test(name)) {
        test(`should use a strict version for devDependency ${name}`, () => {
          expect(versionRange.trim()).not.toContain('^');
          expect(versionRange.trim()).not.toContain('~');
          expect(versionRange.trim()).not.toContain('>');
          expect(versionRange.trim()).not.toContain('<');
        });
      }
    });
  });
});
