/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const checkedPackagePatterns: RegExp[] = [
  /^@salesforce\/lightning-lsp-common/i,
  /^@salesforce\/aura-language-server/i,
  /^@salesforce\/lwc-language-server/i,
  /^@salesforce\/salesforcedx/i
];

const readJsonFile = (jsonFilePath: string): any => {
  try {
    return JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  } catch (e) {
    throw new Error(`Error reading json file from ${jsonFilePath}: ${e}`);
  }
};

const packageJsonPath = path.join(__dirname, '..', '..', '..', '..', 'package.json');
const packageJson = readJsonFile(packageJsonPath);

describe(`package.json dependencies for ${packageJson.name}`, () => {
  const { dependencies, devDependencies } = packageJson;

  Object.keys(dependencies).forEach(name => {
    const versionRange = dependencies[name];
    checkedPackagePatterns.forEach(pattern => {
      if (pattern.test(name)) {
        it(`should use a strict version for dependency ${name}`, () => {
          expect(versionRange.trim()).to.not.include('^');
          expect(versionRange.trim()).to.not.include('~');
          expect(versionRange.trim()).to.not.include('>');
          expect(versionRange.trim()).to.not.include('<');
        });
      }
    });
  });

  Object.keys(devDependencies).forEach(name => {
    const versionRange = devDependencies[name];
    checkedPackagePatterns.forEach(pattern => {
      if (pattern.test(name)) {
        it(`should use a strict version for devDependency ${name}`, () => {
          expect(versionRange.trim()).to.not.include('^');
          expect(versionRange.trim()).to.not.include('~');
          expect(versionRange.trim()).to.not.include('>');
          expect(versionRange.trim()).to.not.include('<');
        });
      }
    });
  });
});
