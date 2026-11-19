/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { Effect, Schema } from 'effect';
import { openCodePrompt } from './openCodePrompt.mts';

await openCodePrompt(process.cwd(), {
  skill:
    'Read .github/workflows/manual-test-plan.yml in the repository. Do not read any other files. Reply with only a JSON object: {"name": "<workflow name>", "referencesModelVariable": <boolean indicating whether it references vars.OPENCODE_MODELS>}. No fences or other text.',
  diff: ''
}).pipe(
  Effect.flatMap(
    Schema.decodeUnknown(
      Schema.parseJson(
        Schema.Struct({ name: Schema.Literal('Manual test plan'), referencesModelVariable: Schema.Literal(true) })
      )
    )
  ),
  Effect.tap(result => Effect.logInfo('OpenCode inference and repository read verified', result)),
  Effect.provide(NodeContext.layer),
  Effect.runPromise
);
