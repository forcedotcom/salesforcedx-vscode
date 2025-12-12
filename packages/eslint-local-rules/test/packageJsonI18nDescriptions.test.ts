/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { Linter } from 'eslint';
import { packageJsonI18nDescriptions } from '../src/packageJsonI18nDescriptions';

// CJS require needed: Jest/ts-jest runs in CJS mode. ESM `import` would resolve to
// `{ default: plugin }` but CJS require gives us `plugin` directly. With esModuleInterop: false,
// `import json from '@eslint/json'` yields undefined at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const json = require('@eslint/json') as (typeof import('@eslint/json'))['default'];

jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('package-json-i18n-descriptions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should be exported', () => {
    expect(packageJsonI18nDescriptions).toBeDefined();
    expect(packageJsonI18nDescriptions.meta).toBeDefined();
    expect(packageJsonI18nDescriptions.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const linter = new Linter({ configType: 'flat' });

    const lintJson = (code: string, nlsContent: Record<string, string>, filename = 'packages/test/package.json') => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify(nlsContent));

      const config = [
        {
          files: ['**/*.json'],
          plugins: {
            json: { rules: json.rules, languages: json.languages },
            local: { rules: { 'package-json-i18n-descriptions': packageJsonI18nDescriptions } }
          },
          language: 'json/json',
          rules: {
            'local/package-json-i18n-descriptions': 'error'
          }
        }
        // Type assertion needed: @eslint/json's .d.ts emits `meta.type: string` instead of
        // the literal union `"problem" | "suggestion" | "layout"` that ESLint's Plugin type expects.
        // Runtime types are correct; only the upstream type declarations are imprecise.
      ] as Linter.Config[];
      return linter.verify(code, config, { filename });
    };

    it('should pass when command title uses valid i18n placeholder', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd', title: '%command.title%' }]
          }
        },
        null,
        2
      );

      const messages = lintJson(code, { 'command.title': 'My Command' });
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(0);
    });

    it('should error when command title is hardcoded string', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd', title: 'Hardcoded Title' }]
          }
        },
        null,
        2
      );

      const messages = lintJson(code, {});
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('hardcodedString');
    });

    it('should error when i18n key is missing from package.nls.json', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd', title: '%missing.key%' }]
          }
        },
        null,
        2
      );

      const messages = lintJson(code, { 'other.key': 'Other Value' });
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingKey');
    });

    it('should check configuration title', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              title: 'Hardcoded Config Title'
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code, {});
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('hardcodedString');
    });

    it('should check configuration property descriptions', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              title: '%config.title%',
              properties: {
                'myExtension.setting': {
                  type: 'boolean',
                  description: 'Hardcoded description'
                }
              }
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code, { 'config.title': 'Config' });
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('hardcodedString');
    });

    it('should check view names', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'myView', name: 'Hardcoded View Name' }]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code, {});
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('hardcodedString');
    });

    it('should check viewsContainers activitybar titles', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            viewsContainers: {
              activitybar: [{ id: 'myContainer', title: 'Hardcoded Container Title', icon: 'icon.svg' }]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code, {});
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('hardcodedString');
    });

    it('should skip files not matching packages/*/package.json', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd', title: 'Hardcoded' }]
          }
        },
        null,
        2
      );

      const messages = lintJson(code, {}, 'some/other/file.json');
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(0);
    });

    it('should pass valid i18n across multiple properties', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd', title: '%cmd.title%' }],
            configuration: {
              title: '%config.title%',
              properties: {
                'ext.setting': {
                  type: 'string',
                  description: '%setting.desc%'
                }
              }
            },
            views: {
              explorer: [{ id: 'myView', name: '%view.name%' }]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code, {
        'cmd.title': 'Command',
        'config.title': 'Configuration',
        'setting.desc': 'Description',
        'view.name': 'View'
      });
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      expect(errors).toHaveLength(0);
    });

    it('should handle missing package.nls.json gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.cmd', title: '%cmd.title%' }]
          }
        },
        null,
        2
      );

      const config = [
        {
          files: ['**/*.json'],
          plugins: {
            json: { rules: json.rules, languages: json.languages },
            local: { rules: { 'package-json-i18n-descriptions': packageJsonI18nDescriptions } }
          },
          language: 'json/json',
          rules: {
            'local/package-json-i18n-descriptions': 'error'
          }
        }
      ] as Linter.Config[];

      const messages = linter.verify(code, config, { filename: 'packages/test/package.json' });
      const errors = messages.filter(m => m.ruleId === 'local/package-json-i18n-descriptions');
      // Should report missingKey since nls file couldn't be loaded
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingKey');
    });
  });
});
