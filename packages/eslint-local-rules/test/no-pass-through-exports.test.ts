/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noPassThroughExports } from '../src/noPassThroughExports';

const ruleTester = new RuleTester();
const fixturePath = (...parts: string[]) => path.join(__dirname, 'fixtures/no-pass-through-exports', ...parts);
const internalFilename = fixturePath('src/internal.ts');

ruleTester.run('no-pass-through-exports', noPassThroughExports, {
  valid: [
    { code: 'export const value = 1;', filename: internalFilename },
    { code: 'const value = 1; export { value, value as renamed };', filename: internalFilename },
    { code: 'type Local = string; export type { Local };', filename: internalFilename },
    { code: 'const value = 1; export default value;', filename: internalFilename },
    { code: 'export default function local() {}', filename: internalFilename },
    { code: "import { value } from './other'; export default value + 1;", filename: internalFilename },
    { code: 'export function local() {} export class Local {} export interface Shape {}', filename: internalFilename },
    { code: "import { value } from './other'; export const result = value + 1;", filename: internalFilename },
    {
      code: "import type { Shape } from './other'; export type Local = Shape & { id: string };",
      filename: internalFilename
    },
    { code: "export { value } from './other';", filename: fixturePath('src/public.ts') },
    { code: "export * from 'other';", filename: fixturePath('src/public.ts') },
    { code: "import value from './other'; export default value;", filename: fixturePath('src/public.ts') },
    {
      code: "import type { Shape } from './other'; export type { Shape };",
      filename: fixturePath('src/nested/entry.ts')
    },
    { code: "export type * from './other';", filename: fixturePath('src/source.ts') },
    { code: "export { value } from './other';", filename: fixturePath('src/features/nested/feature.ts') },
    { code: "export { value } from './other';", filename: fixturePath('src/choice.ts') }
  ],
  invalid: [
    ...[
      "export { value } from './other';",
      "export { default as value } from 'other';",
      "export * from '../other';",
      "export * as values from 'other';",
      "export type { Shape } from './other';",
      "export { type Shape } from 'other';",
      "export type * from 'other';",
      "import { value } from './other'; export { value };",
      "export { renamed }; import { value as renamed } from './other';",
      "import * as values from 'other'; export { values };",
      "import value from 'other'; export { value as default };",
      "import value from './other'; export default value;",
      "import { value } from './other'; export default value;",
      "import { value as renamed } from './other'; export default renamed;",
      "import * as values from 'other'; export default values;",
      "import values = require('other'); export default values;",
      "import type { Shape } from 'other'; export type { Shape };",
      "import { type Shape } from 'other'; export { type Shape as Renamed };",
      "import values = require('other'); export { values };",
      "import { value } from 'other'; const local = 1; export { local, value };"
    ].map(code => ({ code, filename: internalFilename, errors: [{ messageId: 'passThrough' as const }] })),
    {
      code: "export { value } from './other';",
      filename: fixturePath('src/index.ts'),
      errors: [{ messageId: 'passThrough' }]
    },
    {
      code: "export { value } from './other';",
      filename: fixturePath('no-exports/index.ts'),
      errors: [{ messageId: 'passThrough' }]
    },
    {
      code: "export { value } from './other';",
      filename: fixturePath('src/disabled.ts'),
      errors: [{ messageId: 'passThrough' }]
    },
    {
      code: "export { value } from './other';",
      filename: fixturePath('test/helper.ts'),
      errors: [{ messageId: 'passThrough' }]
    }
  ]
});
