/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as FileSystem from '@effect/platform/FileSystem';
import * as NodeContext from '@effect/platform-node/NodeContext';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import { Effect } from 'effect';
import { classifyWithJev } from './shared/categoryJev.mts';

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const policy = yield* fs.readFileString('APPROVAL_POLICY.md');
  const diff =
    'diff --git a/test/example.test.ts b/test/example.test.ts\n--- a/test/example.test.ts\n+++ b/test/example.test.ts\n@@ -1 +1,2 @@\n assert.ok(true);\n+assert.equal(1, 1);\n';
  const result = yield* classifyWithJev({
    policy,
    files: [{ filename: 'test/example.test.ts', diff }],
    hasCoveredHunks: false
  });
  if (result.uncoveredFiles.length > 0 || !result.categories.includes('tests-only')) {
    return yield* Effect.fail(new Error('Jev did not classify the test addition'));
  }
  yield* Effect.log('Live Jev classified the test addition as tests-only');
}).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
