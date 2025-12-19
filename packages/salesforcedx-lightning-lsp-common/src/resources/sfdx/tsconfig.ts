/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Base TypeScript configuration for SFDX projects.
 * This is written to `.sfdx/tsconfig.sfdx.json` in the workspace root.
 */
export const baseTsConfigJson = {
  compilerOptions: {
    skipLibCheck: true,
    target: 'ESNext',
    module: 'NodeNext',
    paths: {
      'c/*': []
    }
  }
} as const;

/**
 * TypeScript configuration template for SFDX project modules.
 * This template is processed with EJS and written to `tsconfig.json` in each module directory.
 * The template uses `<%= project_root %>` as a placeholder that gets replaced with the relative path to the workspace root.
 */
export const tsConfigTemplateJson = {
  extends: '<%= project_root %>/.sfdx/tsconfig.sfdx.json',
  include: ['**/*.ts', '<%= project_root %>/.sfdx/typings/lwc/**/*.d.ts'],
  exclude: ['**/__tests__/**']
} as const;
