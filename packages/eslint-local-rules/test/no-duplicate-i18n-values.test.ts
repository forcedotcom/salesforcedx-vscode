/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDuplicateI18nValues } from '../src/noDuplicateI18nValues';

const ruleTester = new RuleTester();

// Resolve fixtures directory relative to this test file
// __dirname works in Jest with ts-jest
const fixturesDir = path.join(__dirname, 'fixtures', 'messages');

ruleTester.run('no-duplicate-i18n-values', noDuplicateI18nValues, {
  valid: [
    {
      name: 'base i18n.ts file with English text is allowed',
      code: `export const messages = { key1: 'English text' } as const;`,
      filename: path.join(fixturesDir, 'i18n.ts')
    },
    {
      name: 'translation file with non-English text',
      code: `export const messages = { key1: '日本語テキスト' } as const;`,
      filename: path.join(fixturesDir, 'i18n.ja.ts')
    },
    {
      name: 'translation file with Chinese text',
      code: `export const messages = { key1: '中文文本' } as const;`,
      filename: path.join(fixturesDir, 'i18n.zh.ts')
    },
    {
      name: 'technical strings like URLs and placeholders are allowed',
      code: `export const messages = {
        technical_only: 'https://example.com',
        with_placeholder: '{0} {1}'
      } as const;`,
      filename: path.join(fixturesDir, 'i18n.ja.ts')
    },
    {
      name: 'non-translation file is ignored',
      code: `export const messages = { key1: 'English text' } as const;`,
      filename: path.join(fixturesDir, '..', 'other-file.ts')
    }
  ],
  invalid: [
    {
      name: 'translation file with English text that duplicates base',
      code: `export const messages = { key1: 'English base text' } as const;`,
      output: `export const messages = {  } as const;`,
      filename: path.join(fixturesDir, 'i18n.ja.ts'),
      errors: [
        {
          messageId: 'duplicateValue',
          data: { key: 'key1' }
        }
      ]
    },
    {
      name: 'translation file with English text that differs from base',
      code: `export const messages = { greeting: 'Hello World' } as const;`,
      output: null, // No fix for non-duplicate English
      filename: path.join(fixturesDir, 'i18n.ja.ts'),
      errors: [
        {
          messageId: 'englishValue',
          data: { key: 'greeting' }
        }
      ]
    },
    {
      name: 'translation file with English text on same line',
      code: `export const messages = { greeting: 'Hello', farewell: 'Goodbye' } as const;`,
      output: `export const messages = {  farewell: 'Goodbye' } as const;`,
      filename: path.join(fixturesDir, 'i18n.es.ts'),
      errors: [
        {
          messageId: 'duplicateValue',
          data: { key: 'greeting' }
        },
        {
          messageId: 'englishValue',
          data: { key: 'farewell' }
        }
      ]
    }
  ]
});
