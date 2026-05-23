/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { packageJsonRequireRootInstall } from '../src/packageJsonRequireRootInstall';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-require-root-install';
const PREINSTALL = 'node ../../scripts/require-root-install.js';

describe('package-json-require-root-install', () => {
  it('should be exported', () => {
    expect(packageJsonRequireRootInstall).toBeDefined();
    expect(packageJsonRequireRootInstall.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonRequireRootInstall);

    it('passes for scoped package with no private or preinstall', () => {
      const code = JSON.stringify(
        { name: '@salesforce/some-util', version: '1.0.0', scripts: { compile: 'tsc' } },
        null,
        2
      );
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('passes for unscoped package with private: true and correct preinstall', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-core',
          private: true,
          scripts: { preinstall: PREINSTALL, compile: 'tsc' }
        },
        null,
        2
      );
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('errors when unscoped package is missing private: true', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-core',
          scripts: { preinstall: PREINSTALL, compile: 'tsc' }
        },
        null,
        2
      );
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingPrivate');
    });

    it('errors when unscoped package is missing preinstall', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-core',
          private: true,
          scripts: { compile: 'tsc' }
        },
        null,
        2
      );
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingPreinstall');
    });

    it('errors when preinstall has wrong value', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-core',
          private: true,
          scripts: { preinstall: 'echo wrong', compile: 'tsc' }
        },
        null,
        2
      );
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingPreinstall');
    });

    it('errors twice when both private and preinstall are missing', () => {
      const code = JSON.stringify({ name: 'salesforcedx-vscode-core', scripts: { compile: 'tsc' } }, null, 2);
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(2);
      expect(errors.map(e => e.messageId)).toContain('missingPrivate');
      expect(errors.map(e => e.messageId)).toContain('missingPreinstall');
    });

    it('ignores package.json files outside packages directory', () => {
      const code = JSON.stringify({ name: 'salesforcedx-vscode-core', scripts: { compile: 'tsc' } }, null, 2);
      expect(filterByRule(lintJson(code, 'other/package.json'), RULE_NAME)).toHaveLength(0);
    });
  });
});
