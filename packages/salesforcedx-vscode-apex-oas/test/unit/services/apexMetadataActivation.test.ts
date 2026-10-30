/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ApexExtensionUnavailable, ApexLspRequestFailed } from '../../../src/errors';
import { ApexMetadataService } from '../../../src/services/apexMetadataService';

const gatherContext = () =>
  ApexMetadataService.gatherOpenAPIContext(URI.file('/project/Example.cls')).pipe(
    Effect.provide(ApexMetadataService.Default)
  );

describe('Apex metadata extension activation', () => {
  it('preserves the missing extension error', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    const error = await Effect.runPromise(Effect.flip(gatherContext()));

    expect(error).toBeInstanceOf(ApexExtensionUnavailable);
    expect(error.message).toBe('Apex extension is not installed');
  });

  it('preserves the activation failure error', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: vi.fn().mockRejectedValue(new Error('activation failed'))
    } as unknown as vscode.Extension<ApexVSCodeApi>);

    const error = await Effect.runPromise(Effect.flip(gatherContext()));

    expect(error).toBeInstanceOf(ApexExtensionUnavailable);
    expect(error.message).toBe('Failed to activate Apex extension: Error: activation failed');
  });

  it('uses activated exports only after the language server becomes ready', async () => {
    vi.useFakeTimers();
    const response = { context: 'OpenAPI context' };
    const gatherOpenAPIContext = vi.fn().mockResolvedValue(response);
    const isOpenAPIEligible = vi.fn().mockResolvedValue(undefined);
    const languageClientManager = {
      statusReads: 0,
      getClientInstance: () => ({}),
      // Model the real class method, which reads manager state through `this`.
      getStatus() {
        this.statusReads += 1;
        return this.statusReads === 1
          ? { isReady: () => false, failedToInitialize: () => false, getStatusMessage: () => '' }
          : { isReady: () => true, failedToInitialize: () => false, getStatusMessage: () => '' };
      }
    };
    const activate = vi.fn().mockResolvedValue({
      languageClientManager,
      gatherOpenAPIContext,
      isOpenAPIEligible
    });
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate
    } as unknown as vscode.Extension<ApexVSCodeApi>);

    try {
      const result = Effect.runPromise(gatherContext());
      await vi.advanceTimersByTimeAsync(0);
      expect(gatherOpenAPIContext).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(500);

      expect(await result).toBe(response);
      expect(activate).toHaveBeenCalledOnce();
      expect(languageClientManager.statusReads).toBe(2);
      expect(gatherOpenAPIContext).toHaveBeenCalledExactlyOnceWith(URI.file('/project/Example.cls'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not issue requests when language server initialization fails', async () => {
    const gatherOpenAPIContext = vi.fn();
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: {
        isOpenAPIEligible: vi.fn(),
        languageClientManager: {
          getClientInstance: () => undefined,
          getStatus: () => ({
            isReady: () => false,
            failedToInitialize: () => true,
            getStatusMessage: () => 'initialization failed'
          })
        },
        gatherOpenAPIContext
      }
    } as unknown as vscode.Extension<ApexVSCodeApi>);

    const error = await Effect.runPromise(Effect.flip(gatherContext()));

    expect(error).toBeInstanceOf(ApexLspRequestFailed);
    expect(error.message).toContain('initialization failed');
    expect(gatherOpenAPIContext).not.toHaveBeenCalled();
  });
});
