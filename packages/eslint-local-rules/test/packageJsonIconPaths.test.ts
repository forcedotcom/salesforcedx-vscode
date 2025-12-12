/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Linter } from 'eslint';
import { packageJsonIconPaths } from '../src/packageJsonIconPaths';

// CJS require needed: Jest/ts-jest runs in CJS mode. ESM `import` would resolve to
// `{ default: plugin }` but CJS require gives us `plugin` directly. With esModuleInterop: false,
// `import json from '@eslint/json'` yields undefined at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const json = require('@eslint/json') as (typeof import('@eslint/json'))['default'];

describe('package-json-icon-paths', () => {
  it('should be exported', () => {
    expect(packageJsonIconPaths).toBeDefined();
    expect(packageJsonIconPaths.meta).toBeDefined();
    expect(packageJsonIconPaths.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const linter = new Linter({ configType: 'flat' });

    const lintJson = (code: string, filename = 'packages/test/package.json') => {
      const config = [
        {
          files: ['**/*.json'],
          plugins: {
            json: { rules: json.rules, languages: json.languages },
            local: { rules: { 'package-json-icon-paths': packageJsonIconPaths } }
          },
          language: 'json/json',
          rules: {
            'local/package-json-icon-paths': 'error'
          }
        }
        // Type assertion needed: @eslint/json's .d.ts emits `meta.type: string` instead of
        // the literal union `"problem" | "suggestion" | "layout"` that ESLint's Plugin type expects.
        // Runtime types are correct; only the upstream type declarations are imprecise.
      ] as Linter.Config[];
      return linter.verify(code, config, { filename });
    };

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

      const messages = lintJson(code);
      const iconErrors = messages.filter(m => m.ruleId === 'local/package-json-icon-paths');
      expect(iconErrors).toHaveLength(1);
      expect(iconErrors[0].messageId).toBe('missingLight');
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

      const messages = lintJson(code);
      const iconErrors = messages.filter(m => m.ruleId === 'local/package-json-icon-paths');
      expect(iconErrors).toHaveLength(1);
      expect(iconErrors[0].messageId).toBe('missingDark');
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

      const messages = lintJson(code);
      const iconErrors = messages.filter(m => m.ruleId === 'local/package-json-icon-paths');
      expect(iconErrors).toHaveLength(0);
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

      const messages = lintJson(code, 'some/other/file.json');
      const iconErrors = messages.filter(m => m.ruleId === 'local/package-json-icon-paths');
      expect(iconErrors).toHaveLength(0);
    });
  });
});
