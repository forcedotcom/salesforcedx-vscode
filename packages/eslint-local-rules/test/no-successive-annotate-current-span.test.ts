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
    },
    {
      // single annotate tap among non-annotate taps in the SAME pipe — run length < 2, must NOT flag
      code: `const program = x.pipe(
  Effect.tap(v => Effect.annotateCurrentSpan('v', v)),
  Effect.map(f)
);`,
      filename
    },
    {
      // tap-chain where a NON-FIRST tap references its OWN arrow param — merging into the first tap's
      // single param would leave that reference undeclared, so the rule must NOT merge (W-23138529).
      code: `const program = x.pipe(
  Effect.tap(a => Effect.annotateCurrentSpan({ a })),
  Effect.tap(b => Effect.annotateCurrentSpan({ b }))
);`,
      filename
    },
    {
      // 3 adjacent taps where later taps reference their OWN params (id, choice) — not mergeable (model on packageInstall.ts:178-184)
      code: `const program = effect.pipe(
  Effect.tap(id => Effect.annotateCurrentSpan('packageId', id)),
  Effect.tap(key => Effect.annotateCurrentSpan('hasKey', hasKey)),
  Effect.tap(choice => Effect.annotateCurrentSpan('shouldPoll', choice))
);`,
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
      // tap-chain, 3 adjacent taps mergeable (no non-first tap references its own param)
      code: `const program = effect.pipe(
  Effect.tap(() => Effect.annotateCurrentSpan('a', a)),
  Effect.tap(() => Effect.annotateCurrentSpan('b', b)),
  Effect.tap(() => Effect.annotateCurrentSpan('c', c))
);`,
      output: `const program = effect.pipe(
  Effect.tap(() => Effect.annotateCurrentSpan({ a, b, c }))
);`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // generator form, 3 adjacent yield* statements (multi-step run path)
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('a', a);
  yield* Effect.annotateCurrentSpan('b', b);
  yield* Effect.annotateCurrentSpan('c', c);
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ a, b, c });
}`,
      filename,
      errors: [{ messageId: 'successiveAnnotate' }]
    },
    {
      // 2-arg string-literal key that is NOT a valid identifier → quoted key in merged object
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('kebab-key', v);
  yield* Effect.annotateCurrentSpan('plain', p);
}`,
      output: `function* x() {
  yield* Effect.annotateCurrentSpan({ 'kebab-key': v, plain: p });
}`,
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
      // comment between the two annotates → report but NO autofix (range replace would delete the comment)
      code: `function* x() {
  yield* Effect.annotateCurrentSpan('a', a);
  // keep this comment
  yield* Effect.annotateCurrentSpan('b', b);
}`,
      output: null,
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
