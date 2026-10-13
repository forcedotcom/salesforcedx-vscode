/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { inlineSingleUseYieldBinding } from '../src/inlineSingleUseYieldBinding';

const ruleTester = new RuleTester();

ruleTester.run('inline-single-use-yield-binding', inlineSingleUseYieldBinding, {
  valid: [
    'function* g() { const x = yield* e; return x + x; }',
    'function* g() { const x = yield* e; yield* f(x); return x; }',
    'function* g() { let x = yield* e; return x; }',
    'function* g() { const { x } = yield* e; return x; }',
    'function* g() { const x = e; return x; }',
    'function* g() { const x = yield e; return x; }',
    'function* g() { const x = yield* e; yield* sideEffect; return x; }',
    'function* g() { const x = yield* e; return () => x; }',
    'function* g() { const x = yield* e; return f(sideEffect(), x); }',
    'function* g() { const x = yield* e; return { x }; }',
    'function* g() { const x = yield* e; return x.field; }',
    'function* g() { const x = yield* e; return other.x; }',
    'function* g() { const x = yield* e; { const x = 1; return x; } return x + x; }',
    'function* g() { const x = yield* e, y = 1; return x; }',
    'function* g() { const x = yield* e; return f(...x); }',
    'function* g() { const x = yield* e; return x = 1; }'
  ],
  invalid: [
    {
      code: 'function* g() { const x = yield* e; return x; }',
      output: 'function* g() { return yield* e; }',
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = yield* e; yield* f(x); }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = yield* e; return f(x); }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = yield* e; return f(x, y); }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'let f = oldF; function* g() { const x = yield* e; return f(x); }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'let f = oldF; function* g() { const x = yield* e; yield* f(x); }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g(kind) { switch (kind) { case 1: const x = yield* e; return x; } }',
      output: 'function* g(kind) { switch (kind) { case 1: return yield* e; } }',
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g(kind) { switch (kind) { case 1: const x = yield* e; return f(x); } }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = yield* e; // preserve\n return x; }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const /* keep */ x = yield* e; return x; }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = /* explanation */ yield* e; return x; }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = yield* e /* why this delegates */; return x; }',
      output: null,
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    },
    {
      code: 'function* g() { const x = yield* /* kept in initializer */ e; return x; }',
      output: 'function* g() { return yield* /* kept in initializer */ e; }',
      errors: [{ messageId: 'inlineSingleUseYieldBinding' }]
    }
  ]
});
