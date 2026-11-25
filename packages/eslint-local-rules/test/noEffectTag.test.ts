/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join, resolve } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { noEffectTag } from '../src/noEffectTag';

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
RuleTester.it = (name, callback) => it(name, callback, 30_000);

const optionImport = `import * as Option from 'effect/Option';
declare const option: Option.Option<number>;
`;

ruleTester.run('no-effect-tag', noEffectTag, {
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
      code: `type Either = { _tag: 'Left' } | { _tag: 'Right' };
type Exit = { _tag: 'Success' } | { _tag: 'Failure' };
declare const either: Either;
declare const exit: Exit;
either._tag; const { ['_tag']: tag } = exit;`
    },
    { filename, code: `declare const value: any; value._tag;` },
    {
      filename,
      code: `declare const value: unknown;
if (typeof value === 'object' && value !== null && '_tag' in value) { value._tag; }`
    },
    { filename, code: `${optionImport}const unrelated = { _tag: 'Some', option }; unrelated._tag;` },
    {
      filename,
      code: `import * as Predicate from 'effect/Predicate';
declare const value: unknown;
if (Predicate.isTagged('Local')(value)) { value._tag; }`
    },
    {
      filename,
      code: `import * as Schema from 'effect/Schema';
const Local = Schema.Struct({ _tag: Schema.Literal('Local') });
declare const value: typeof Local.Type;
value._tag;`
    },
    ...[
      `option._tag = 'None';`,
      `option['_tag'] = 'Some';`,
      `option._tag += 'Some';`,
      `option._tag++;`,
      `delete option._tag;`,
      `delete option['_tag'];`,
      `({ tag: option._tag } = { tag: 'Some' });`,
      `({ tag: option['_tag'] = 'None' } = {});`,
      `({ ...option._tag } = {});`,
      `[option._tag] = ['Some'];`,
      `[...option._tag] = ['Some'];`,
      `for (option._tag of ['Some']) {}`,
      `for (option['_tag'] in {}) {}`,
      `declare const values: { _tag: string }[]; [{ _tag: option._tag }] = values;`,
      `declare const values: { _tag: string }[]; [{ ['_tag']: option['_tag'] }] = values;`,
      `(option._tag as string) = 'Some';`
    ].map(code => ({ filename, code: `${optionImport}${code}` })),
    {
      filename,
      code: `import * as Either from 'effect/Either';
declare const either: Either.Either<number, string>;
Either.isLeft(either); Either.isRight(either);
Either.match(either, { onLeft: error => error, onRight: value => String(value) });`
    },
    {
      filename,
      code: `import * as Exit from 'effect/Exit';
declare const exit: Exit.Exit<number, string>;
Exit.match(exit, { onFailure: () => 0, onSuccess: value => value });`
    },
    {
      filename,
      code: `import * as Data from 'effect/Data';
import * as Match from 'effect/Match';
import * as Predicate from 'effect/Predicate';
declare const value: Data.TaggedEnum<{ First: {}; Second: {} }>;
Predicate.isTagged('First')(value);
Match.value(value).pipe(Match.tag('First', () => 1), Match.tag('Second', () => 2), Match.exhaustive);
Match.value(value).pipe(Match.tag('First', () => 1), Match.option);
Match.value(value).pipe(Match.tag('First', () => 1), Match.orElse(() => 0));`
    }
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
      `const { '_tag': tag } = option;`,
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
const { option: { _tag } } = nested;`,
      `declare const nested: { option: Option.Option<number> };
let tag: string; ({ option: { ['_tag']: tag } } = nested);`,
      `declare const values: Option.Option<number>[];
let tag: string; [{ _tag: tag }] = values;`,
      `declare const values: readonly Option.Option<number>[];
let tag: string; [{ ['_tag']: tag }] = values;`,
      `declare const values: [{ _tag: 'Local' }, Option.Option<number>];
let tag: string; [, { _tag: tag }] = values;`,
      `declare const nested: { values: Option.Option<number>[] };
let tag: string; ({ values: [{ ['_tag']: tag }] } = nested);`,
      `declare const values: { option: Option.Option<number> }[];
let tag: string; [{ option: { _tag: tag } }] = values;`,
      `declare const values: Option.Option<number>[][];
let tag: string; [[{ ['_tag']: tag }]] = values;`,
      `declare const values: Option.Option<number>[];
[{ _tag: option._tag }] = values;`,
      `option._tag = Option.none()._tag;`
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
    },
    ...(
      [
        ['Either', 'Either<number, string>', 'useEitherHelpers'],
        ['Exit', 'Exit<number, string>', 'useExitMatch'],
        ['Cause', 'Cause<string>', 'useEffectMatch'],
        ['Tracer', 'AnySpan', 'useEffectMatch']
      ] as const
    ).flatMap(([module, type, messageId]) =>
      [`value._tag;`, `value['_tag'];`, `const { _tag } = value;`, `const { ['_tag']: tag } = value;`].map(code => ({
        filename,
        code: `import * as ${module} from 'effect/${module}';
declare const value: ${module}.${type};
${code}`,
        errors: [{ messageId }]
      }))
    ),
    ...(
      [
        ['Option', 'Option<number>'],
        ['Either', 'Either<number, string>'],
        ['Exit', 'Exit<number, string>']
      ] as const
    ).flatMap(([module, type]) =>
      [
        `value._tag;`,
        `const { ['_tag']: tag } = value;`,
        `const read = <T extends typeof value>(input: T) => input._tag;`,
        `declare const labeled: typeof value & { label: string }; labeled._tag;`
      ].map(code => ({
        filename,
        code: `import * as ${module} from 'effect/${module}';
declare const value: ${module}.${type} | { _tag: 'Local'; value: string };
${code}`,
        errors: [{ messageId: 'useEffectMatch' as const }]
      }))
    ),
    ...[
      `import * as Data from 'effect/Data';
type Value = Data.TaggedEnum<{ First: {}; Second: {} }>;
declare const value: Value;`,
      `import * as Data from 'effect/Data';
class First extends Data.TaggedClass('First') {};
class Second extends Data.TaggedError('Second') {};
declare const value: First | Second;`,
      `import * as Schema from 'effect/Schema';
class First extends Schema.TaggedError<First>()('First', {}) {};
class Second extends Schema.TaggedError<Second>()('Second', {}) {};
declare const value: First | Second;`,
      `import * as Schema from 'effect/Schema';
const Value = Schema.Union(Schema.TaggedStruct('First', {}), Schema.TaggedStruct('Second', {}));
declare const value: typeof Value.Type;`
    ].map(declaration => ({
      filename,
      code: `${declaration}\nvalue._tag;`,
      errors: [{ messageId: 'useEffectMatch' as const }]
    })),
    {
      filename,
      code: `${optionImport}declare const target: Record<string, string>;
target[option._tag] = 'value';`,
      errors: [{ messageId: 'useOptionHelpers' }]
    },
    {
      filename,
      code: `${optionImport}({ [option._tag]: target } = {});`,
      errors: [{ messageId: 'useOptionHelpers' }]
    },
    {
      filename,
      code: `import * as Option from 'effect/Option';
import * as Either from 'effect/Either';
declare const value: Option.Option<number> | Either.Either<number, string>;
value._tag;`,
      errors: [{ messageId: 'useEffectMatch' }]
    }
  ]
});

describe('no-effect-tag repository scope', () => {
  const eslint = new ESLint({ cwd: resolve(__dirname, '../../..') });

  it('reports specialized and generic guidance without autofixes', async () => {
    const [result] = await eslint.lintText(
      `import * as Option from 'effect/Option';
import * as Either from 'effect/Either';
import * as Exit from 'effect/Exit';
import type { AnySpan } from 'effect/Tracer';
declare const option: Option.Option<number>;
declare const either: Either.Either<number, string>;
declare const exit: Exit.Exit<number, string>;
declare const span: AnySpan;
option._tag; either._tag; exit._tag; span._tag;`,
      { filePath: 'packages/effect-ext-utils/src/annotateRootSpan.ts' }
    );
    const reports = result.messages.filter(message => message.ruleId === 'local/no-effect-tag');
    expect(reports.map(report => report.message)).toEqual([
      'Do not read _tag on an Effect Option. Use Option.isNone or Option.isSome for case checks, or Option.match to handle both cases.',
      'Do not read _tag on an Effect Either. Use Either.isLeft or Either.isRight for case checks, or Either.match to handle both cases.',
      'Do not read _tag on an Effect Exit. Use Exit.match to handle success and failure.',
      'Do not read _tag on an Effect tagged value. Use Predicate.isTagged("Tag") from effect/Predicate for a boolean predicate or type guard, or Match.value(value).pipe(Match.tag(...), Match.exhaustive) for dispatch. Preserve intentional partial matches with Match.option or Match.orElse.'
    ]);
    expect(reports.every(report => report.fix === undefined && report.suggestions === undefined)).toBe(true);
  });

  it('reports mixed unions and array assignment reads without reporting assignment targets', async () => {
    const [result] = await eslint.lintText(
      `import * as Option from 'effect/Option';
declare const value: Option.Option<number> | { _tag: 'Local'; value: string };
declare const values: Option.Option<number>[];
declare const localValues: { _tag: string }[];
declare const option: Option.Option<number>;
let tag: string;
value._tag;
[{ _tag: tag }] = values;
[{ ['_tag']: tag }] = values;
[{ _tag: option._tag }] = localValues;`,
      { filePath: 'packages/effect-ext-utils/src/annotateRootSpan.ts' }
    );
    const reports = result.messages.filter(message => message.ruleId === 'local/no-effect-tag');
    expect(reports.map(report => report.messageId)).toEqual(['useEffectMatch', 'useOptionHelpers', 'useOptionHelpers']);
  });

  it.each(['packages/effect-ext-utils/src/annotateRootSpan.ts', 'scripts/shared/categoryDecision.mts'])(
    'enforces production file %s',
    async path => {
      const config = await eslint.calculateConfigForFile(path);
      expect(config.rules['local/no-effect-tag']).toEqual([2]);
    }
  );

  it.each([
    'packages/effect-ext-utils/test/unit/annotateRootSpan.test.ts',
    'packages/effect-ext-utils/src/example.test.ts',
    'packages/effect-ext-utils/src/example.spec.ts',
    'packages/effect-ext-utils/src/__tests__/example.ts',
    'scripts/manualTestPlan/test/unit/manualTestPlan.test.mts',
    'scripts/example.test.mts',
    'test/ci-ai.test.mts',
    'packages/salesforcedx-vscode-apex-testing/playwright.config.ts',
    'packages/eslint-local-rules/test/noEffectTag.test.ts'
  ])('excludes test file %s', async path => {
    const config = await eslint.calculateConfigForFile(path);
    expect(config.rules['local/no-effect-tag']).toBeUndefined();
  });
});
