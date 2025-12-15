/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { packageJsonCommandRefs } from '../src/packageJsonCommandRefs';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-command-refs';

describe('package-json-command-refs', () => {
  it('should be exported', () => {
    expect(packageJsonCommandRefs).toBeDefined();
    expect(packageJsonCommandRefs.meta).toBeDefined();
    expect(packageJsonCommandRefs.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonCommandRefs);

    it('should pass when command is defined and referenced in menu', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.myCommand', title: 'My Command' }],
            menus: {
              commandPalette: [{ command: 'test.myCommand' }]
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when command is referenced but not defined', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [],
            menus: {
              commandPalette: [{ command: 'test.undefinedCommand' }]
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('undefinedCommand');
    });

    it('should error when command is defined but never referenced (orphaned)', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.orphanedCommand', title: 'Orphaned' }],
            menus: {}
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('orphanedCommand');
    });

    it('should check commands in view/title menu', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.viewCmd', title: 'View Command' }],
            menus: {
              'view/title': [{ command: 'test.viewCmd' }]
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should check commands in editor/context menu', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.editorCmd', title: 'Editor Command' }],
            menus: {
              'editor/context': [{ command: 'test.editorCmd' }]
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should check commands in explorer/context menu', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [{ command: 'test.explorerCmd', title: 'Explorer Command' }],
            menus: {
              'explorer/context': [{ command: 'test.explorerCmd' }]
            }
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
            commands: [],
            menus: {
              commandPalette: [{ command: 'test.undefinedCommand' }]
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code, 'some/other/file.json'), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple commands correctly', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: [
              { command: 'test.cmd1', title: 'Command 1' },
              { command: 'test.cmd2', title: 'Command 2' },
              { command: 'test.orphaned', title: 'Orphaned' }
            ],
            menus: {
              commandPalette: [{ command: 'test.cmd1' }, { command: 'test.cmd2' }, { command: 'test.undefined' }]
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(2);
      expect(errors.map(e => e.messageId).sort()).toEqual(['orphanedCommand', 'undefinedCommand']);
    });
  });
});
