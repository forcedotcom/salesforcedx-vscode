/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { forceignore } from './forceignore';
import { gitignore } from './gitignore';
import { jestConfig } from './jestConfig';
import { metadataDirs } from './metadataDirs';
import { prettierignore } from './prettierignore';
import { prettierrc } from './prettierrc';
import { readme } from './readme';
import { sfdxProjectJson } from './sfdxProject';
import { tsconfig } from './tsconfig';

export const TEMPLATES = {
  '.forceignore': forceignore,
  '.gitignore': gitignore,
  'sfdx-project.json': sfdxProjectJson,
  '.prettierrc': prettierrc,
  '.prettierignore': prettierignore,
  'jest.config.js': jestConfig,
  'README.md': readme,
  'tsconfig.json': tsconfig
};

export { metadataDirs };
