/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noRawDuration } from '../src/noRawDuration';

const fixtureDir = join(__dirname, 'fixtures/no-raw-duration');
const filename = join(fixtureDir, 'subject.ts');

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: fixtureDir
    }
  }
});

const effectImport = `import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
`;

ruleTester.run('no-raw-duration', noRawDuration, {
  valid: [
    {
      filename,
      code: `${effectImport}
Effect.sleep(Duration.millis(30_000));`
    },
    {
      filename,
      code: `${effectImport}
Duration.millis(5000);`
    },
    {
      filename,
      code: `${effectImport}
const opts: { timeout: number } = { timeout: 30_000 };`
    },
    {
      filename,
      code: `${effectImport}
Schedule.exponential(Duration.seconds(1), 2);`
    },
    {
      filename,
      code: `${effectImport}
Effect.sleep(1n);`
    },
    {
      filename,
      code: `${effectImport}
Effect.sleep('2 seconds');`
    }
  ],
  invalid: [
    {
      filename,
      code: `${effectImport}
Effect.sleep(30_000);`,
      errors: [{ messageId: 'useMillis' }]
    },
    {
      filename,
      code: `${effectImport}
const ms: number = 30_000;
Effect.sleep(ms);`,
      errors: [{ messageId: 'useMillis' }]
    },
    {
      filename,
      code: `${effectImport}
const opts: { timeout?: Duration.DurationInput } = { timeout: 1 };`,
      errors: [{ messageId: 'useMillis' }]
    }
  ]
});
