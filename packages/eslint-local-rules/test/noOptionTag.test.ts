/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noOptionTag } from '../src/noOptionTag';

const fixtureDir = join(__dirname, 'fixtures/no-option-tag');
const filename = join(fixtureDir, 'subject.ts');
const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: fixtureDir
    }
  }
});

const optionImport = `import * as Option from 'effect/Option';
declare const option: Option.Option<number>;
`;

ruleTester.run('no-option-tag', noOptionTag, {
  valid: [
    { filename, code: `${optionImport}Option.isNone(option); Option.isSome(option);` },
    {
      filename,
      code: `${optionImport}Option.match(option, { onNone: () => 0, onSome: value => value });`
    },
    { filename, code: `${optionImport}if (Option.isSome(option)) { option.value; }` },
    { filename, code: `${optionImport}type Tag = Option.Option<number>['_tag'];` },
    {
      filename,
      code: `type Option<A> = { _tag: 'None' } | { _tag: 'Some'; value: A };
declare const option: Option<number>;
option._tag === 'None';`
    },
    {
      filename,
      code: `interface Some { _tag: 'Some'; value: number }
declare const value: Some;
value['_tag'];`
    },
    {
      filename,
      code: `declare const error: { _tag: 'Failed' } | { _tag: 'Cancelled' };
const { _tag } = error;`
    },
    {
      filename,
      code: `import * as Either from 'effect/Either';
declare const either: Either.Either<number, string>;
either._tag === 'Left';`
    },
    {
      filename,
      code: `import * as Exit from 'effect/Exit';
declare const exit: Exit.Exit<number, string>;
exit._tag === 'Success';`
    },
    { filename, code: `declare const value: any; value._tag;` },
    {
      filename,
      code: `declare const value: unknown;
if (typeof value === 'object' && value !== null && '_tag' in value) { value._tag; }`
    },
    { filename, code: `${optionImport}const unrelated = { _tag: 'Some', option }; unrelated._tag;` }
  ],
  invalid: [
    ...[
      `option._tag === 'None';`,
      `'Some' !== option._tag;`,
      `option['_tag'] === 'Some';`,
      'option[`_tag`];',
      `const key = '_tag'; option[key];`,
      `const tag = option._tag;`,
      `switch (option._tag) { case 'None': break; case 'Some': break; }`,
      `const { _tag } = option;`,
      `const { _tag: tag } = option;`,
      `const { ['_tag']: tag } = option;`,
      `let tag: string; ({ _tag: tag } = option);`,
      `const read = ({ _tag }: Option.Option<number>) => _tag;`,
      `const read = (value: Option.Option<number> | undefined) => value?._tag;`,
      `const read = <T extends Option.Option<number>>(value: T) => value._tag;`,
      `type Wrapped = Option.Option<number> & { label: string };
declare const wrapped: Wrapped; wrapped._tag;`,
      `type Alias = Option.Option<number>;
declare const alias: Alias; alias._tag;`,
      `Option.some(1)._tag;`,
      `Option.none()._tag;`,
      `if (Option.isSome(option)) { option._tag; }`,
      `interface ExtendedSome extends Option.Some<number> { label: string }
declare const extended: ExtendedSome; extended._tag;`,
      `declare const nested: { option: Option.Option<number> };
const { option: { _tag } } = nested;`
    ].map(code => ({
      filename,
      code: `${optionImport}${code}`,
      errors: [{ messageId: 'useOptionHelpers' as const }]
    })),
    {
      filename,
      code: `import { Option as Maybe } from 'effect';
declare const value: Maybe.Option<number>;
value._tag;`,
      errors: [{ messageId: 'useOptionHelpers' }]
    },
    {
      filename,
      code: `import type { Option as Maybe } from 'effect/Option';
declare const value: Maybe<number>;
value._tag;`,
      errors: [{ messageId: 'useOptionHelpers' }]
    }
  ]
});
