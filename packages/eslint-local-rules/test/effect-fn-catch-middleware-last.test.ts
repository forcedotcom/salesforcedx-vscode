/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { effectFnCatchMiddlewareLast } from '../src/effectFnCatchMiddlewareLast';

const ruleTester = new RuleTester();

const filename = 'packages/salesforcedx-vscode-services/src/test.ts';

ruleTester.run('effect-fn-catch-middleware-last', effectFnCatchMiddlewareLast, {
  valid: [
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.void;
});`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.void;
}, Effect.catchTag('NoActiveEditorError', () => Effect.void));`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.void;
}, Effect.catchAll(() => Effect.void));`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  withConfigurableSuccessNotification('ok'),
  Effect.catchTag('NoActiveEditorError', () => Effect.void)
);`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.tap(() => Effect.void),
  Effect.catchAll(() => Effect.void)
);`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  preventOrgChanges
);`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run', { root: true })(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  preventOrgChanges
);`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  Effect.catchAll(() => Effect.void)
);`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.void.pipe(Effect.catchTag('NoActiveEditorError', () => Effect.void));
});`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(function* () {
  yield* Effect.void.pipe(Effect.catchAll(() => Effect.void));
});`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fnUntraced('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  Effect.tap(() => Effect.void)
);`,
      filename
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn(function* () {
  yield* Effect.void;
}, Effect.catchTag('NoActiveEditorError', () => Effect.void), Effect.tap(() => Effect.void));`,
      filename
    }
  ],
  invalid: [
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  Effect.tap(() => Effect.void)
);`,
      filename,
      errors: [{ messageId: 'successAfterCatch' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.catchAll(() => Effect.void),
  withConfigurableSuccessNotification('ok')
);`,
      filename,
      errors: [{ messageId: 'successAfterCatch' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run', { root: true })(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  Effect.tap(() => Effect.void)
);`,
      filename,
      errors: [{ messageId: 'successAfterCatch' }]
    },
    {
      code: `import * as Effect from 'effect/Effect';
const run = Effect.fn('Example.run')(
  function* () {
    yield* Effect.void;
  },
  Effect.catchTag('NoActiveEditorError', () => Effect.void),
  Effect.catchAll(() => Effect.void),
  Effect.tap(() => Effect.void)
);`,
      filename,
      errors: [{ messageId: 'successAfterCatch' }, { messageId: 'successAfterCatch' }]
    }
  ]
});
