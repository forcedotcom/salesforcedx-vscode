/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { packageJsonIconPaths } from '../src/packageJsonIconPaths';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-icon-paths';

describe('package-json-icon-paths', () => {
  it('should be exported', () => {
    expect(packageJsonIconPaths).toBeDefined();
    expect(packageJsonIconPaths.meta).toBeDefined();
    expect(packageJsonIconPaths.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonIconPaths);

    it('should pass when icon has both light and dark (no missing pair errors)', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [
              {
                command: 'test.cmd',
                icon: { light: 'light.svg', dark: 'dark.svg' }
              }
            ]
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      // Filter for missing light/dark errors only (not file existence errors)
      const pairErrors = messages.filter(m => m.messageId === 'missingLight' || m.messageId === 'missingDark');
      expect(pairErrors).toHaveLength(0);
    });

    it('should error when icon has dark but missing light', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [
              {
                command: 'test.cmd',
                icon: { dark: 'dark.svg' }
              }
            ]
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingLight');
    });

    it('should error when icon has light but missing dark', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [
              {
                command: 'test.cmd',
                icon: { light: 'light.svg' }
              }
            ]
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingDark');
    });

    it('should pass when no icon property exists', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd' }]
          }
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
          name: 'test',
          contributes: {
            commands: [
              {
                command: 'test.cmd',
                icon: { dark: 'dark.svg' }
              }
            ]
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code, 'some/other/file.json'), RULE_NAME);
      expect(errors).toHaveLength(0);
    });
  });
});
