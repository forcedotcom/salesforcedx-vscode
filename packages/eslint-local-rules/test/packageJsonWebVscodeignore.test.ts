/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { packageJsonWebVscodeignore } from '../src/packageJsonWebVscodeignore';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-web-vscodeignore';

describe('package-json-web-vscodeignore', () => {
  it('should be exported', () => {
    expect(packageJsonWebVscodeignore).toBeDefined();
    expect(packageJsonWebVscodeignore.meta).toBeDefined();
    expect(packageJsonWebVscodeignore.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonWebVscodeignore);

    it('should pass when package has no browser field', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-core',
          engines: { vscode: '^1.90.0' }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when web extension has no .vscodeignore', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-services',
          browser: './dist/web/index.js'
        },
        null,
        2
      );

      // Use a path that definitely won't have a .vscodeignore
      const servicesPkg = path.resolve(__dirname, '../../salesforcedx-vscode-services/package.json');
      const fakePkgPath = path.join(path.dirname(servicesPkg), 'nonexistent/package.json');
      const errors = filterByRule(lintJson(code, fakePkgPath), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingVscodeignore');
    });

    it('should error when web extension .vscodeignore is missing required patterns', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-services',
          browser: './dist/web/index.js'
        },
        null,
        2
      );

      const servicesPkg = path.resolve(__dirname, '../../salesforcedx-vscode-services/package.json');
      const vscodeignorePath = path.resolve(__dirname, '../../salesforcedx-vscode-services/.vscodeignore');
      const originalContent = fs.readFileSync(vscodeignorePath, 'utf-8');
      
      try {
        // Temporarily remove **/*.node from .vscodeignore
        const modifiedContent = originalContent.replace('**/*.node', '');
        fs.writeFileSync(vscodeignorePath, modifiedContent);
        
        const errors = filterByRule(lintJson(code, servicesPkg), RULE_NAME);
        const nodeError = errors.find(e => e.messageId === 'missingRequiredPattern' && (e.data as any).pattern === '**/*.node');
        expect(nodeError).toBeDefined();
      } finally {
        fs.writeFileSync(vscodeignorePath, originalContent);
      }
    });

    it('should pass when web extension .vscodeignore is valid', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-services',
          browser: './dist/web/index.js'
        },
        null,
        2
      );

      const servicesPkg = path.resolve(__dirname, '../../salesforcedx-vscode-services/package.json');
      const errors = filterByRule(lintJson(code, servicesPkg), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when existing directory is not in .vscodeignore', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-services',
          browser: './dist/web/index.js'
        },
        null,
        2
      );

      const servicesPkg = path.resolve(__dirname, '../../salesforcedx-vscode-services/package.json');
      const vscodeignorePath = path.resolve(__dirname, '../../salesforcedx-vscode-services/.vscodeignore');
      const originalContent = fs.readFileSync(vscodeignorePath, 'utf-8');
      
      try {
        // Temporarily remove scripts/** from .vscodeignore
        const modifiedContent = originalContent.replace('scripts/**', '');
        fs.writeFileSync(vscodeignorePath, modifiedContent);
        
        const errors = filterByRule(lintJson(code, servicesPkg), RULE_NAME);
        const scriptError = errors.find(e => e.messageId === 'missingExistingDirPattern' && (e.data as any).pattern === 'scripts/**');
        expect(scriptError).toBeDefined();
      } finally {
        fs.writeFileSync(vscodeignorePath, originalContent);
      }
    });
  });
});
