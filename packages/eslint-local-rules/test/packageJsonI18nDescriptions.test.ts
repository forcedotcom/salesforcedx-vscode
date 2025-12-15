/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { packageJsonI18nDescriptions } from '../src/packageJsonI18nDescriptions';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

const RULE_NAME = 'package-json-i18n-descriptions';

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
    const lintJson = createJsonLinter(RULE_NAME, packageJsonI18nDescriptions);

    const lintWithNls = (code: string, nlsContent: Record<string, string>, filename = 'packages/test/package.json') => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify(nlsContent));
      return lintJson(code, filename);
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

      const errors = filterByRule(lintWithNls(code, { 'command.title': 'My Command' }), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, {}), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, { 'other.key': 'Other Value' }), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, {}), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, { 'config.title': 'Config' }), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, {}), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, {}), RULE_NAME);
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

      const errors = filterByRule(lintWithNls(code, {}, 'some/other/file.json'), RULE_NAME);
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

      const errors = filterByRule(
        lintWithNls(code, {
          'cmd.title': 'Command',
          'config.title': 'Configuration',
          'setting.desc': 'Description',
          'view.name': 'View'
        }),
        RULE_NAME
      );
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

      const errors = filterByRule(lintJson(code), RULE_NAME);
      // Should report missingKey since nls file couldn't be loaded
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingKey');
    });
  });
});
