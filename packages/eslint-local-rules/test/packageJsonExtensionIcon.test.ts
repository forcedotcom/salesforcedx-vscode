/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';

import { packageJsonExtensionIcon } from '../src/packageJsonExtensionIcon';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-extension-icon';

describe('package-json-extension-icon', () => {
  it('should be exported', () => {
    expect(packageJsonExtensionIcon).toBeDefined();
    expect(packageJsonExtensionIcon.meta).toBeDefined();
    expect(packageJsonExtensionIcon.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonExtensionIcon);

    it('should error when published extension has no icon', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-foo',
          engines: { vscode: '^1.90.0' }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('extensionMissingIcon');
    });

    it('should error when icon path does not exist', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-foo',
          engines: { vscode: '^1.90.0' },
          icon: 'images/nonexistent.png'
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('iconNotFound');
      expect(errors[0].message).toContain('images/nonexistent.png');
    });

    it('should pass when extension has icon and file exists', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-apex-log',
          engines: { vscode: '^1.90.0' },
          icon: 'images/VSCodeBundle.png'
        },
        null,
        2
      );

      const apexLogPkg = path.resolve(__dirname, '../../salesforcedx-vscode-apex-log/package.json');
      const errors = filterByRule(lintJson(code, apexLogPkg), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass when package is not a published extension (name not salesforcedx-vscode*)', () => {
      const code = JSON.stringify(
        {
          name: 'some-lib',
          main: 'dist/index.js'
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should skip files not matching packages/*/package.json', () => {
      const code = JSON.stringify(
        {
          name: 'salesforcedx-vscode-foo',
          engines: { vscode: '^1.90.0' }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code, 'some/other/package.json'), RULE_NAME);
      expect(errors).toHaveLength(0);
    });
  });
});
