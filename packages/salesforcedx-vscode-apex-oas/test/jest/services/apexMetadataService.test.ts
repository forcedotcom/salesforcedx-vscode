/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import { probeReady } from '../../../src/services/apexMetadataService';

type Manager = ApexVSCodeApi['languageClientManager'];

/** Build a fake languageClientManager with a controllable status + client instance. */
const makeManager = (opts: {
  hasClient: boolean;
  isReady: boolean;
  failedToInitialize?: boolean;
  message?: string;
}): Manager =>
  ({
    getClientInstance: () => (opts.hasClient ? ({} as unknown) : undefined),
    getStatus: () => ({
      isReady: () => opts.isReady,
      isIndexing: () => !opts.isReady,
      failedToInitialize: () => opts.failedToInitialize ?? false,
      getStatusMessage: () => opts.message ?? ''
    })
  }) as unknown as Manager;

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect);

describe('probeReady', () => {
  it('succeeds with the client when the LS is ready', async () => {
    const exit = await run(probeReady(makeManager({ hasClient: true, isReady: true })));
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it('fails with ApexLspNotReady (retryable) while still indexing', async () => {
    const exit = await run(probeReady(makeManager({ hasClient: true, isReady: false })));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(String(Exit.causeOption(exit))).toContain('ApexLspNotReady');
  });

  it('fails with ApexLspNotReady when no client instance exists yet', async () => {
    const exit = await run(probeReady(makeManager({ hasClient: false, isReady: false })));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(String(Exit.causeOption(exit))).toContain('ApexLspNotReady');
  });

  it('fails fast with ApexLspRequestFailed (non-retryable) when init failed', async () => {
    const exit = await run(
      probeReady(makeManager({ hasClient: false, isReady: false, failedToInitialize: true, message: 'boom' }))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(String(Exit.causeOption(exit))).toContain('ApexLspRequestFailed');
  });
});
