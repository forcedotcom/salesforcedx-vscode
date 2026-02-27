/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noUnusedI18nMessages } from '../src/noUnusedI18nMessages';

const ruleTester = new RuleTester();

const fixturesDir = path.join(__dirname, 'fixtures', 'no-unused-i18n');
const i18nPath = path.join(fixturesDir, 'src', 'messages', 'i18n.ts');

ruleTester.run('no-unused-i18n-messages', noUnusedI18nMessages, {
  valid: [
    {
      name: 'non-i18n file is ignored',
      code: `export const messages = { unused: 'x' } as const;`,
      filename: path.join(fixturesDir, 'src', 'other.ts')
    },
    {
      name: 'all keys used - no report',
      code: `export const messages = {
        used_in_code: 'a',
        used_in_package_nls: 'b',
        used_in_test: 'c',
        used_via_coerce: 'd',
        used_via_literal: 'e',
        used_via_messages_prop: 'f',
        ApexClass: 'g'
      } as const;`,
      filename: i18nPath
    },
    {
      name: 'allowList excludes key from report',
      code: `export const messages = {
        unused_key: 'x',
        used_in_code: 'a'
      } as const;`,
      filename: i18nPath,
      options: [{ allowList: ['unused_key'] }]
    }
  ],
  invalid: [
    {
      name: 'reports unused key',
      code: `export const messages = {
        used_in_code: 'a',
        unused_key: 'Never referenced'
      } as const;`,
      filename: i18nPath,
      errors: [
        {
          messageId: 'unused',
          data: { key: 'unused_key' }
        }
      ]
    },
    {
      name: 'reports multiple unused keys',
      code: `export const messages = {
        used_in_code: 'a',
        unused_one: 'x',
        unused_two: 'y'
      } as const;`,
      filename: i18nPath,
      errors: [
        { messageId: 'unused', data: { key: 'unused_one' } },
        { messageId: 'unused', data: { key: 'unused_two' } }
      ]
    },
    {
      name: 'declaration is not counted as reference - quoted key only in messages object',
      code: `export const messages = {
        used_in_code: 'a',
        'quoted_unused_key': 'value'
      } as const;`,
      filename: i18nPath,
      errors: [{ messageId: 'unused', data: { key: 'quoted_unused_key' } }]
    },
    {
      name: 'allowList entry that does not exist in messages is reported',
      code: `export const messages = {
        used_in_code: 'a'
      } as const;`,
      filename: i18nPath,
      options: [{ allowList: ['nonexistent_key'] }],
      errors: [{ messageId: 'invalidAllowListEntry', data: { key: 'nonexistent_key' } }]
    }
  ]
});
