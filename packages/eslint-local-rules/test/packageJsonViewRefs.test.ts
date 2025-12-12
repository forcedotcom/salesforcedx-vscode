/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Linter } from 'eslint';
import { packageJsonViewRefs } from '../src/packageJsonViewRefs';

// CJS require needed: Jest/ts-jest runs in CJS mode. ESM `import` would resolve to
// `{ default: plugin }` but CJS require gives us `plugin` directly. With esModuleInterop: false,
// `import json from '@eslint/json'` yields undefined at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const json = require('@eslint/json') as (typeof import('@eslint/json'))['default'];

describe('package-json-view-refs', () => {
  it('should be exported', () => {
    expect(packageJsonViewRefs).toBeDefined();
    expect(packageJsonViewRefs.meta).toBeDefined();
    expect(packageJsonViewRefs.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const linter = new Linter({ configType: 'flat' });

    const lintJson = (code: string, filename = 'packages/test/package.json') => {
      const config = [
        {
          files: ['**/*.json'],
          plugins: {
            json: { rules: json.rules, languages: json.languages },
            local: { rules: { 'package-json-view-refs': packageJsonViewRefs } }
          },
          language: 'json/json',
          rules: {
            'local/package-json-view-refs': 'error'
          }
        }
        // Type assertion needed: @eslint/json's .d.ts emits `meta.type: string` instead of
        // the literal union `"problem" | "suggestion" | "layout"` that ESLint's Plugin type expects.
        // Runtime types are correct; only the upstream type declarations are imprecise.
      ] as Linter.Config[];
      return linter.verify(code, config, { filename });
    };

    it('should pass when view is defined and referenced in when clause', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'myView', name: 'My View' }]
            },
            menus: {
              'view/title': [{ command: 'test.cmd', when: 'view == myView' }]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(0);
    });

    it('should pass when view is referenced in viewsWelcome', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'myView', name: 'My View' }]
            },
            viewsWelcome: [{ view: 'myView', contents: 'Welcome!' }]
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(0);
    });

    it('should error when view is defined but never referenced (orphaned)', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'orphanedView', name: 'Orphaned View' }]
            },
            menus: {}
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('orphanedView');
    });

    it('should check view references in view/item/context menu', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'itemView', name: 'Item View' }]
            },
            menus: {
              'view/item/context': [{ command: 'test.cmd', when: 'view == itemView' }]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(0);
    });

    it('should skip files not matching packages/*/package.json', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'orphanedView', name: 'Orphaned View' }]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code, 'some/other/file.json');
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple views in different containers', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [{ id: 'explorerView', name: 'Explorer View' }],
              debug: [{ id: 'debugView', name: 'Debug View' }]
            },
            menus: {
              'view/title': [{ command: 'test.cmd', when: 'view == explorerView' }]
            },
            viewsWelcome: [{ view: 'debugView', contents: 'Debug welcome' }]
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(0);
    });

    it('should report multiple orphaned views', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            views: {
              explorer: [
                { id: 'orphan1', name: 'Orphan 1' },
                { id: 'orphan2', name: 'Orphan 2' }
              ]
            }
          }
        },
        null,
        2
      );

      const messages = lintJson(code);
      const errors = messages.filter(m => m.ruleId === 'local/package-json-view-refs');
      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.messageId === 'orphanedView')).toBe(true);
    });
  });
});
