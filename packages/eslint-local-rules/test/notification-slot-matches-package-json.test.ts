/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { notificationSlotMatchesPackageJson } from '../src/notificationSlotMatchesPackageJson';

const ruleTester = new RuleTester();

const fixtureDir = path.join(__dirname, 'fixtures', 'notification-slot');

ruleTester.run('notification-slot-matches-package-json', notificationSlotMatchesPackageJson, {
  valid: [
    {
      // SuccessOnly key with correct success enum shape
      code: `export type SuccessOnlyCommandKey = 'My Success Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts')
    },
    {
      // ProgressOnly key with correct progress enum shape
      code: `export type ProgressOnlyCommandKey = 'My Progress Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts')
    },
    {
      // Multiple keys all with correct shape
      code: `export type SuccessOnlyCommandKey = 'My Success Command';
export type ProgressOnlyCommandKey = 'My Progress Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts')
    },
    {
      // never body is ignored
      code: `export type SuccessOnlyCommandKey = never;`,
      filename: path.join(fixtureDir, 'notificationMode.ts')
    },
    {
      // ProgressAndSuccessCommandKey is ignored because it is not a hand-written slot
      code: `export type ProgressAndSuccessCommandKey = 'My PAS Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts')
    }
  ],
  invalid: [
    {
      // SuccessOnly alias listing a ProgressOnly key
      code: `export type SuccessOnlyCommandKey = 'My Progress Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts'),
      errors: [
        {
          messageId: 'slotMismatch',
          data: {
            key: 'My Progress Command',
            alias: 'SuccessOnlyCommandKey',
            actual: 'ProgressOnly',
            expected: 'SuccessOnly'
          }
        }
      ]
    },
    {
      // ProgressOnly alias listing a SuccessOnly key
      code: `export type ProgressOnlyCommandKey = 'My Success Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts'),
      errors: [
        {
          messageId: 'slotMismatch',
          data: {
            key: 'My Success Command',
            alias: 'ProgressOnlyCommandKey',
            actual: 'SuccessOnly',
            expected: 'ProgressOnly'
          }
        }
      ]
    },
    {
      // SuccessOnly alias listing a PAS key (unknown enum shape)
      code: `export type SuccessOnlyCommandKey = 'My PAS Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts'),
      errors: [
        {
          messageId: 'unknownEnumShape',
          data: {
            key: 'My PAS Command',
            enum: 'progressToastSuccessToast, progressToastSuccessOff, progressStatusBarSuccessStatusBar, progressStatusBarSuccessOff'
          }
        }
      ]
    },
    {
      // Key not present in package.json at all
      code: `export type SuccessOnlyCommandKey = 'Nonexistent Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts'),
      errors: [{ messageId: 'unknownKey', data: { key: 'Nonexistent Command' } }]
    },
    {
      // Union with one valid and one wrong key
      code: `export type SuccessOnlyCommandKey = 'My Success Command' | 'My Progress Command';`,
      filename: path.join(fixtureDir, 'notificationMode.ts'),
      errors: [
        {
          messageId: 'slotMismatch',
          data: {
            key: 'My Progress Command',
            alias: 'SuccessOnlyCommandKey',
            actual: 'ProgressOnly',
            expected: 'SuccessOnly'
          }
        }
      ]
    }
  ]
});
