/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noSchemaIsThrowGuard } from '../src/noSchemaIsThrowGuard';

const ruleTester = new RuleTester();

ruleTester.run('no-schema-is-throw-guard', noSchemaIsThrowGuard, {
  valid: [
    'const isValid = Schema.is(Id);',
    'const valid = Schema.is(Id)(value);',
    'const validIds = values.filter(Schema.is(Id));',
    'const validIds = values.filter(value => Schema.is(Id)(value));',
    'function isId(value) { return Schema.is(Id)(value); }',
    'function parse(value) { if (!Schema.is(Id)(value)) return undefined; return value; }',
    'if (Schema.is(Id)(value)) use(value); else reportInvalid(value);',
    'if (!Schema.is(Id)(value)) { if (shouldThrow) throw new Error("invalid"); }',
    'function parse(value) { if (!Schema.is(Id)(value)) { if (recover) return; throw new Error("invalid"); } }',
    'if (!Schema.is(Id)(value)) { const fail = () => { throw new Error("invalid"); }; reportInvalid(fail); }',
    'if (Schema.is(Id)(value)) throw new Error("already exists");',
    'const valid = Schema.is(Id)(value); if (!valid) reportInvalid(value);',
    'let valid = Schema.is(Id)(value); valid = otherCheck(value); if (!valid) throw new Error("invalid");',
    'const valid = Schema.is(Id)(value); function parse(valid) { if (!valid) throw new Error("invalid"); }',
    'const valid = Schema.is(Id)(value); { const valid = otherCheck(value); if (!valid) throw new Error("invalid"); }',
    'if (!Other.is(Id)(value)) throw new Error("invalid");',
    'Schema.decodeUnknownSync(Id)(value);',
    'const assertId = Schema.asserts(Id); assertId(value);'
  ],
  invalid: [
    {
      code: 'if (!Schema.is(Id)(value)) throw new Error("invalid");',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (!Schema.is(Id)(value)) { throw new Error("invalid"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (!Schema.is(Id)(value)) { log(value); const message = "invalid"; throw new Error(message); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (Schema.is(Id)(value)) use(value); else throw new Error("invalid");',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (Schema.is(Id)(value)) { use(value); } else { throw new Error("invalid"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'const valid = Schema.is(Id)(value); if (!valid) { throw new Error("invalid"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'const valid: boolean = Schema.is(Id)(value); if (valid) use(value); else throw new Error("invalid");',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'const valid = Schema.is(Id)(value); { if (!valid) throw new Error("invalid"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'const valid = false; function parse(value) { const valid = Schema.is(Id)(value); if (!valid) throw new Error("invalid"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (!Schema.is(Id)(value)) { if (reason) throw new Error("one"); else throw new Error("two"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (!Schema.is(Id)(value)) { if (verbose) log(value); throw new Error("invalid"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    },
    {
      code: 'if (!Schema.is(Id)(value)) { if (reason) throw new Error("one"); throw new Error("two"); }',
      errors: [{ messageId: 'useSchemaValidation' }],
      output: null
    }
  ]
});
