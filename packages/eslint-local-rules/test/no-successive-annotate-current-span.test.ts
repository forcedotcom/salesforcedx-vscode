/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noSuccessiveAnnotateCurrentSpan } from '../src/noSuccessiveAnnotateCurrentSpan';

const ruleTester = new RuleTester();

const filename = 'packages/salesforcedx-vscode-metadata/src/test.ts';

ruleTester.run('no-successive-annotate-current-span', noSuccessiveAnnotateCurrentSpan, {
  valid: [
    {
      // single annotate
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('fileName', fileName);
}`,
      filename
    },
    {
      // two annotates with an intervening statement (model on projectInit.ts:45,47)
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('a', a);
  const dirsToCreate = compute();
  yield* Effect.annotateCurrentSpan('b', b);
}`,
      filename
    },
    {
      // Effect.all array: second element is not an annotate (model on connectionService.ts:371)
      code: `const program = Effect.all([Effect.annotateCurrentSpan('k', v), SubscriptionRef.set(ref, x)]);`,
      filename
    },
    {
      // non-Effect annotateCurrentSpan callee
      code: `function* x() {
  yield* foo.annotateCurrentSpan('a', a);
  yield* foo.annotateCurrentSpan('b', b);
}`,
      filename
    },
    {
      // separate single-tap pipes on adjacent const bindings (model on packageInstall.ts:172-185).
      // Each tap is the sole annotate in its OWN .pipe() — not a chain. Rule must NOT merge across pipe boundaries.
      code: `function* x() {
  const packageId = yield* gatherPackageId().pipe(
    Effect.tap(id => Effect.annotateCurrentSpan('packageId', id))
  );
  const hasKey = yield* gatherKey().pipe(
    Effect.tap(key => Effect.annotateCurrentSpan('hasKey', key))
  );
  const shouldPoll = yield* gatherPoll().pipe(
    Effect.tap(choice => Effect.annotateCurrentSpan('shouldPoll', choice))
  );
}`,
      filename
    }
  ],
  invalid: [
    {
      // generator form, 2-arg (model on generateManifest.ts:52-53)
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('fileName', fileName);
  yield* Effect.annotateCurrentSpan('workspacePath', workspacePath.toString());
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ fileName, workspacePath: workspacePath.toString() });
}`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // generator form, two 1-arg objects with a blank line between (model on metadataRetrieveService.ts:165+167).
      // Blank line is whitespace, not an intervening AST statement, so the run is still successive.
      code: `function* x() {
  yield* Effect.annotateCurrentSpan({ retrieveOutcome });

  yield* Effect.annotateCurrentSpan({ fileResponses });
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ retrieveOutcome, fileResponses });
}`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // tap-chain form, 1-arg Identifier + 1-arg ObjectExpression → ...info spread (model on workspaceService.ts:47-48)
      code: `const program = x.pipe(
  Effect.tap(info => Effect.annotateCurrentSpan(info)),
  Effect.tap(() => Effect.annotateCurrentSpan({ a, b }))
);`,
      output: `const program = x.pipe(
  Effect.tap(info => Effect.annotateCurrentSpan({ ...info, a, b }))
);`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // tap-chain form (model on packageInstall.ts:178-184)
      code: `const program = effect.pipe(
  Effect.tap(id => Effect.annotateCurrentSpan('packageId', id)),
  Effect.tap(key => Effect.annotateCurrentSpan('hasKey', hasKey)),
  Effect.tap(choice => Effect.annotateCurrentSpan('shouldPoll', choice))
);`,
      output: `const program = effect.pipe(
  Effect.tap(id => Effect.annotateCurrentSpan({ packageId: id, hasKey, shouldPoll: choice }))
);`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // computed (non-literal) key
      code: `function* x() {
  yield* Effect.annotateCurrentSpan(keyVar, a);
  yield* Effect.annotateCurrentSpan('b', x);
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ [keyVar]: a, b: x });
}`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // spread (1-arg object)
      code: `function* x() {
  yield* Effect.annotateCurrentSpan(authInfo.getFields());
  yield* Effect.annotateCurrentSpan({ username });
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ ...authInfo.getFields(), username });
}`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // duplicate key, keep-last
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('foo', 1);
  yield* Effect.annotateCurrentSpan('foo', 2);
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ foo: 2 });
}`,
      filename,
      errors: [{ messageId: 'duplicateKey' }]
    }
  ]
});
