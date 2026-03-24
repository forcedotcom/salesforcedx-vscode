/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';

import { packageJsonWebVscodeignore } from '../src/packageJsonWebVscodeignore';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-web-vscodeignore';
const FIXTURES = path.resolve(__dirname, 'fixtures');

const webPkgCode = JSON.stringify(
  { name: 'salesforcedx-vscode-services', browser: './dist/web/index.js' },
  null,
  2
);

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
        { name: 'salesforcedx-vscode-core', engines: { vscode: '^1.90.0' } },
        null,
        2
      );
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when web extension has no .vscodeignore', () => {
      const fakePkgPath = path.join(FIXTURES, 'web-extension-no-ignore/package.json');
      const errors = filterByRule(lintJson(webPkgCode, fakePkgPath), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingVscodeignore');
    });

    it('should error when web extension .vscodeignore is missing required patterns', () => {
      // fixture/.vscodeignore omits **/*.node — all other required entries present
      const pkgPath = path.join(FIXTURES, 'missing-node-pattern/package.json');
      const errors = filterByRule(lintJson(webPkgCode, pkgPath), RULE_NAME);
      const nodeError = errors.find(
        e => e.messageId === 'missingRequiredPattern' && e.message.includes('**/*.node')
      );
      expect(nodeError).toBeDefined();
    });

    it('should pass when web extension .vscodeignore is valid', () => {
      const servicesPkg = path.resolve(__dirname, '../../salesforcedx-vscode-services/package.json');
      const errors = filterByRule(lintJson(webPkgCode, servicesPkg), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when existing directory is not in .vscodeignore', () => {
      // fixture has a scripts/ directory but .vscodeignore omits scripts/**
      const pkgPath = path.join(FIXTURES, 'missing-dir-pattern/package.json');
      const errors = filterByRule(lintJson(webPkgCode, pkgPath), RULE_NAME);
      const scriptError = errors.find(
        e => e.messageId === 'missingExistingDirPattern' && e.message.includes('scripts/**')
      );
      expect(scriptError).toBeDefined();
    });
  });
});
