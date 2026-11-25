/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWorkflowDispatchEvent } from '../../src/github.js';

describe('workflow_dispatch event', () => {
  it('decodes caller-provided input schema', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'effect-octokit-event-'));
    const eventPath = join(directory, 'event.json');
    writeFileSync(eventPath, JSON.stringify({ inputs: { pull_number: '8497' } }));
    try {
      const event = await readWorkflowDispatchEvent(eventPath, Schema.Struct({ pull_number: Schema.String })).pipe(
        Effect.provide(NodeContext.layer),
        Effect.runPromise
      );
      expect(event.inputs.pull_number).toBe('8497');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
